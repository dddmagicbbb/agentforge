// Fastify 앱: 마켓 색인 API 7종(design.md 9.4). listen 은 호출자가 한다.
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { collectGit } from "./fetch-git.js";
import { collectGithub } from "./fetch-github.js";
import { buildSkills } from "./indexer.js";
import { RefreshInput, SearchQuery, SkillParams, SourceInput, SourceParams } from "./schemas.js";
import { Store } from "./store.js";
import { ServerError, type Collected, type FetchLike, type IndexFile, type ScanFn, type SourceRecord } from "./types.js";

export const SERVER_VERSION = "0.3.0";

export interface ServerOptions {
  dataDir: string;
  /**
   * 위험 검사 함수(필수 주입).
   * TODO(통합): 기본값을 @agentforge/core 의 scanSkillRisk 로 연결한다(T-701 병합 후). 지금은 core 에 export 가 없어 주입을 요구한다.
   */
  scan: ScanFn;
  fetch?: FetchLike;
  gitBin?: string;
  webDist?: string;
  /**
   * 서버 환경 변수(tokenEnv 조회, AF_ALLOW_FILE_SOURCES, AF_MARKET_ADMIN). 기본 process.env.
   * AF_MARKET_ADMIN=1 이 아니면 관리 API(소스 등록·삭제, 갱신)는 403 ADMIN_DISABLED (SSRF 대책).
   * listen 은 호출자 책임이며, 기본 host 는 127.0.0.1 로 둘 것(외부 노출 시 별도 접근 통제 필요).
   */
  env?: Record<string, string | undefined>;
  /** 기본 소스 파일(기본: 저장소 catalog/market-sources.json) */
  defaultSourcesFile?: string;
  /** git clone 시간 제한(기본 60초) */
  gitTimeoutMs?: number;
  /** github REST 요청 1건당 시간 제한(기본 30초) */
  fetchTimeoutMs?: number;
}

/** zod 검증 실패는 입력 값을 되돌려 주지 않고 필드 경로만 알린다 */
function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new ServerError("SOURCE_INVALID", 400, { field: r.error.issues[0]?.path.join(".") ?? "" });
  return r.data;
}

export async function createServer(opts: ServerOptions): Promise<FastifyInstance> {
  const env = opts.env ?? process.env;
  const doFetch: FetchLike = opts.fetch ?? ((url, init) => fetch(url, init));
  const defaultSourcesFile = opts.defaultSourcesFile ?? fileURLToPath(new URL("../../../catalog/market-sources.json", import.meta.url));
  const store = new Store(opts.dataDir);
  await store.init(defaultSourcesFile);

  const app = Fastify({ logger: false, bodyLimit: 64 * 1024 });

  // JSON 본문: 비어 있으면 {} 로 본다. 파싱 실패는 SOURCE_INVALID
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    const text = typeof body === "string" ? body : body.toString("utf8");
    if (text.trim() === "") return done(null, {});
    try {
      done(null, JSON.parse(text));
    } catch {
      done(new ServerError("SOURCE_INVALID", 400, { field: "body" }), undefined);
    }
  });

  // 오류는 {code, params} 만 응답한다(내부 메시지·스택 금지)
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ServerError) return reply.status(err.status).send({ code: err.code, params: err.params });
    const status = (err as { statusCode?: number }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) return reply.status(status).send({ code: "SOURCE_INVALID", params: {} });
    return reply.status(500).send({ code: "INTERNAL", params: {} });
  });
  app.setNotFoundHandler((_req, reply) => reply.status(404).send({ code: "NOT_FOUND", params: {} }));

  if (opts.webDist) await app.register(fastifyStatic, { root: opts.webDist });

  const allowFile = env["AF_ALLOW_FILE_SOURCES"] === "1";
  const admin = env["AF_MARKET_ADMIN"] === "1";
  // 관리 API 보호: 라우트 config.admin 이 true 인 요청은 본문 파싱 전에 차단한다
  app.addHook("onRequest", async (req) => {
    if ((req.routeOptions.config as { admin?: boolean } | undefined)?.admin && !admin) throw new ServerError("ADMIN_DISABLED", 403);
  });

  // ---- 색인 갱신 -------------------------------------------------------------------
  async function collect(src: SourceRecord): Promise<{ collected: Collected; cleanup?: () => Promise<void> }> {
    if (src.kind === "github") {
      return { collected: await collectGithub(src, { fetch: doFetch, env, timeoutMs: opts.fetchTimeoutMs ?? 30_000 }) };
    }
    if (src.url?.startsWith("file://") && !allowFile) throw new ServerError("SOURCE_INVALID", 400, { field: "url" });
    return collectGit(src, { gitBin: opts.gitBin ?? "git", env, timeoutMs: opts.gitTimeoutMs ?? 60_000 });
  }

  type RefreshResult = { id: string; ok: true; sha: string; skillCount: number } | { id: string; ok: false; code: string; params: Record<string, string | number | boolean> };

  async function refreshOne(src: SourceRecord): Promise<RefreshResult> {
    let cleanup: (() => Promise<void>) | undefined;
    try {
      const c = await collect(src);
      cleanup = c.cleanup;
      const srcPrefix = src.kind === "github" ? `${src.owner}/${src.repo}` : (src.url ?? "");
      const skills = await buildSkills({ collected: c.collected, basePath: src.path, srcPrefix, scan: opts.scan });
      const index: IndexFile = { sourceId: src.id, sha: c.collected.sha, indexedAt: new Date().toISOString(), skills };
      await store.lock(async () => {
        const all = await store.readSources();
        const cur = all.find((s) => s.id === src.id);
        if (!cur) return; // 갱신 중에 삭제됨
        await store.writeIndex(src.id, index);
        cur.lastIndexedAt = index.indexedAt;
        cur.lastSha = index.sha;
        delete cur.lastError;
        await store.writeSources(all);
      });
      return { id: src.id, ok: true, sha: index.sha, skillCount: skills.length };
    } catch (e) {
      const se = e instanceof ServerError ? e : new ServerError("INTERNAL", 500);
      await store.lock(async () => {
        const all = await store.readSources();
        const cur = all.find((s) => s.id === src.id);
        if (!cur) return;
        cur.lastError = se.code;
        await store.writeSources(all);
      });
      return { id: src.id, ok: false, code: se.code, params: se.params };
    } finally {
      await cleanup?.();
    }
  }

  // ---- 라우트 ----------------------------------------------------------------------
  app.get("/api/market/health", async () => ({ ok: true, version: SERVER_VERSION, admin }));

  app.get("/api/market/sources", async () => ({ sources: await store.readSources() }));

  app.post("/api/market/sources", { config: { admin: true } }, async (req, reply) => {
    const input = parse(SourceInput, req.body);
    if (input.kind === "git" && input.url.startsWith("file://") && !allowFile) throw new ServerError("SOURCE_INVALID", 400, { field: "url" });
    const rec = input as SourceRecord;
    await store.lock(async () => {
      const all = await store.readSources();
      if (all.some((s) => s.id === rec.id)) throw new ServerError("SOURCE_EXISTS", 409, { id: rec.id });
      all.push(rec);
      await store.writeSources(all);
    });
    return reply.status(201).send(rec);
  });

  app.delete("/api/market/sources/:id", { config: { admin: true } }, async (req) => {
    const { id } = parse(SourceParams, req.params);
    await store.lock(async () => {
      const all = await store.readSources();
      if (!all.some((s) => s.id === id)) throw new ServerError("NOT_FOUND", 404);
      await store.writeSources(all.filter((s) => s.id !== id));
      await store.deleteIndex(id);
    });
    return { ok: true };
  });

  app.post("/api/market/refresh", { config: { admin: true } }, async (req) => {
    const { id } = parse(RefreshInput, req.body ?? {});
    const all = await store.readSources();
    const targets = id ? all.filter((s) => s.id === id) : all;
    if (id && targets.length === 0) throw new ServerError("NOT_FOUND", 404);
    const results: RefreshResult[] = [];
    for (const s of targets) results.push(await refreshOne(s));
    return { results };
  });

  app.get("/api/market/search", async (req) => {
    const { q, trust } = parse(SearchQuery, req.query);
    const needle = q?.toLowerCase();
    const sources = (await store.readSources()).filter((s) => !trust || s.trust === trust).sort((a, b) => (a.id < b.id ? -1 : 1));
    const skills = [];
    for (const s of sources) {
      const idx = await store.readIndex(s.id);
      for (const k of idx?.skills ?? []) {
        if (needle && !k.id.toLowerCase().includes(needle) && !k.description.toLowerCase().includes(needle)) continue;
        skills.push({ sourceId: s.id, id: k.id, description: k.description, trust: s.trust, src: k.src, ref: k.ref, flags: k.flags, fileCount: k.fileCount, ...(k.blocked ? { blocked: k.blocked } : {}) });
      }
    }
    return { skills };
  });

  app.get("/api/market/skills/:sourceId/:skillId", async (req) => {
    const { sourceId, skillId } = parse(SkillParams, req.params);
    const src = (await store.readSources()).find((s) => s.id === sourceId);
    const skill = src ? (await store.readIndex(sourceId))?.skills.find((k) => k.id === skillId) : undefined;
    if (!src || !skill) throw new ServerError("NOT_FOUND", 404);
    if (skill.blocked) throw new ServerError("SKILL_BLOCKED", 409, { reason: skill.blocked });
    return { id: skill.id, src: skill.src, trust: src.trust, ref: skill.ref, description: skill.description, flags: skill.flags, files: skill.files };
  });

  return app;
}
