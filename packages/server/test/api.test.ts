import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/index.js";
import { fakeGithub, fakeScan, makeServer, SKILL_MD, tmpDir } from "./helpers.js";

const SHA = "b".repeat(40);
const gh = () =>
  fakeGithub({
    "o/r": { sha: SHA, files: { "x/SKILL.md": SKILL_MD("x", "Excel 도구"), "y/SKILL.md": SKILL_MD("y", "Word helper") } },
    "o/s": { sha: SHA, files: { "z/SKILL.md": SKILL_MD("z", "Excel 변환기") } },
  });

async function setup() {
  const g = gh();
  const ctx = await makeServer({ fetch: g.fetch });
  const post = (payload: object) => ctx.app.inject({ method: "POST", url: "/api/market/sources", payload });
  await post({ id: "one", kind: "github", owner: "o", repo: "r", trust: "official" });
  await post({ id: "two", kind: "github", owner: "o", repo: "s" });
  await ctx.app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
  return { ...ctx, post };
}

describe("MKT-01 API", () => {
  it("health", async () => {
    const { app } = await makeServer();
    const r = await app.inject({ url: "/api/market/health" });
    expect(r.json()).toMatchObject({ ok: true, version: expect.any(String), admin: true });
  });

  it("관리 API 꺼짐: 3개 관리 API 는 403 ADMIN_DISABLED, 읽기는 정상, health.admin=false", async () => {
    const { app } = await makeServer({ env: { AF_MARKET_ADMIN: "0" } });
    for (const [method, url, payload] of [
      ["POST", "/api/market/sources", { id: "n", kind: "github", owner: "o", repo: "r" }],
      ["DELETE", "/api/market/sources/n", undefined],
      ["POST", "/api/market/refresh", {}],
    ] as const) {
      const r = await app.inject({ method, url, payload });
      expect(r.statusCode, url).toBe(403);
      expect(r.json()).toEqual({ code: "ADMIN_DISABLED", params: {} });
    }
    // 깨진 본문이어도 파싱 전에 403
    const bad = await app.inject({ method: "POST", url: "/api/market/sources", headers: { "content-type": "application/json" }, payload: "{bad" });
    expect(bad.statusCode).toBe(403);
    expect((await app.inject({ url: "/api/market/sources" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/market/search" })).statusCode).toBe(200);
    expect((await app.inject({ url: "/api/market/skills/a/b" })).statusCode).toBe(404);
    const h = (await app.inject({ url: "/api/market/health" })).json();
    expect(h.admin).toBe(false);
  });

  it("AF_MARKET_ADMIN 미설정도 꺼짐", async () => {
    const dataDir = tmpDir("af-data-");
    const app = await createServer({ dataDir, scan: fakeScan, env: {}, defaultSourcesFile: join(dataDir, "none.json") });
    expect((await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} })).statusCode).toBe(403);
  });

  it("등록 기본 trust=unverified, 중복은 SOURCE_EXISTS(409), 목록에 색인 상태", async () => {
    const { app, post } = await setup();
    const dup = await post({ id: "one", kind: "github", owner: "o", repo: "r" });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ code: "SOURCE_EXISTS", params: { id: "one" } });
    const list = (await app.inject({ url: "/api/market/sources" })).json() as { sources: { id: string; trust: string; lastSha?: string; lastIndexedAt?: string }[] };
    expect(list.sources.map((s) => [s.id, s.trust])).toEqual([["one", "official"], ["two", "unverified"]]);
    expect(list.sources[0]!.lastSha).toBe(SHA);
    expect(list.sources[0]!.lastIndexedAt).toMatch(/^\d{4}-/);
  });

  it("입력 검증: id·owner·repo·ref·path·baseUrl 패턴", async () => {
    const { post } = await setup();
    const base = { kind: "github", owner: "o", repo: "r" };
    for (const bad of [
      { id: "Bad Id", ...base },
      { id: "n1", ...base, owner: "o/../x" },
      { id: "n2", ...base, repo: "r r" },
      { id: "n3", ...base, ref: "a..b" },
      { id: "n4", ...base, path: "../etc" },
      { id: "n5", ...base, path: "/abs" },
      { id: "n6", ...base, baseUrl: "https://u:p@h/x" },
      { id: "n7", ...base, tokenEnv: "lower-case" },
      { id: "n7b", ...base, tokenEnv: "MY_TOKEN" },
      { id: "n7c", ...base, tokenEnv: "PATH" },
      { id: "n8", ...base, trust: "root" },
      { id: "n9", kind: "svn", url: "x" },
    ]) {
      const r = await post(bad);
      expect(r.statusCode, JSON.stringify(bad)).toBe(400);
      expect(r.json().code).toBe("SOURCE_INVALID");
    }
  });

  it("검색: q(이름·설명, 대소문자 무시)·trust 필터", async () => {
    const { app } = await setup();
    const ids = async (qs: string) => ((await app.inject({ url: `/api/market/search${qs}` })).json() as { skills: { id: string }[] }).skills.map((s) => s.id);
    expect(await ids("")).toEqual(["x", "y", "z"]);
    expect(await ids("?q=EXCEL")).toEqual(["x", "z"]);
    expect(await ids("?q=y")).toEqual(["y"]);
    expect(await ids("?trust=official")).toEqual(["x", "y"]);
    expect(await ids("?q=excel&trust=unverified")).toEqual(["z"]);
    expect(await ids("?q=nomatch")).toEqual([]);
    expect((await app.inject({ url: "/api/market/search?trust=bogus" })).json().code).toBe("SOURCE_INVALID");
  });

  it("상세: ImportedSkill 로 바꿀 수 있는 형태", async () => {
    const { app } = await setup();
    const d = (await app.inject({ url: "/api/market/skills/one/x" })).json();
    expect(d).toMatchObject({ id: "x", trust: "official", ref: SHA, description: "Excel 도구", flags: [] });
    expect(typeof d.src).toBe("string");
    expect(d.files).toEqual([{ path: "SKILL.md", content: SKILL_MD("x", "Excel 도구") }]);
  });

  it("없는 소스·스킬은 NOT_FOUND(404)", async () => {
    const { app } = await setup();
    expect((await app.inject({ url: "/api/market/skills/one/nope" })).json().code).toBe("NOT_FOUND");
    expect((await app.inject({ url: "/api/market/skills/nope/x" })).statusCode).toBe(404);
    expect((await app.inject({ method: "DELETE", url: "/api/market/sources/nope" })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/market/refresh", payload: { id: "nope" } })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/unknown" })).json().code).toBe("NOT_FOUND");
  });

  it("삭제하면 색인도 삭제", async () => {
    const { app, dataDir } = await setup();
    expect(existsSync(join(dataDir, "index", "one.json"))).toBe(true);
    const r = await app.inject({ method: "DELETE", url: "/api/market/sources/one" });
    expect(r.statusCode).toBe(200);
    expect(existsSync(join(dataDir, "index", "one.json"))).toBe(false);
    expect(((await app.inject({ url: "/api/market/search" })).json() as { skills: { id: string }[] }).skills.map((s) => s.id)).toEqual(["z"]);
  });

  it("경로 조작 거부: ../ 와 인코딩 변형은 파일을 읽지 않는다", async () => {
    const { app, dataDir } = await setup();
    writeFileSync(join(dataDir, "secret.json"), '{"skills":[{"id":"leak"}]}');
    for (const url of ["/api/market/skills/..%2Fsecret/x", "/api/market/skills/../x", "/api/market/skills/one/..%2F..%2Fsources", "/api/market/skills/%2e%2e/x"]) {
      const r = await app.inject({ url });
      expect([400, 404], url).toContain(r.statusCode);
      expect(r.body).not.toContain("leak");
    }
    expect((await app.inject({ method: "DELETE", url: "/api/market/sources/..%2Fsources" })).statusCode).toBeGreaterThanOrEqual(400);
    expect(existsSync(join(dataDir, "sources.json"))).toBe(true);
  });

  it("깨진 JSON 본문은 SOURCE_INVALID", async () => {
    const { app } = await makeServer();
    const r = await app.inject({ method: "POST", url: "/api/market/sources", headers: { "content-type": "application/json" }, payload: "{bad" });
    expect(r.statusCode).toBe(400);
    expect(r.json().code).toBe("SOURCE_INVALID");
  });

  it("scan 이 던지면 소스별 오류(내부 메시지 미노출)", async () => {
    const g = gh();
    const { app } = await makeServer({
      fetch: g.fetch,
      scan: () => {
        throw new Error("boom-internal");
      },
    });
    await app.inject({ method: "POST", url: "/api/market/sources", payload: { id: "one", kind: "github", owner: "o", repo: "r" } });
    const r = await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    expect(r.body).not.toContain("boom-internal");
    expect(r.json().results[0].ok).toBe(false);
  });
});

describe("기본 소스·저장", () => {
  it("dataDir 에 sources.json 이 없으면 catalog 기본 소스를 복사, 있으면 건드리지 않음", async () => {
    const dataDir = tmpDir("af-data-");
    const cat = join(tmpDir("af-cat-"), "market-sources.json");
    writeFileSync(cat, JSON.stringify({ sources: [{ id: "anthropic-skills", kind: "github", owner: "anthropics", repo: "skills", trust: "official" }] }));
    const app = await createServer({ dataDir, scan: fakeScan, env: { AF_MARKET_ADMIN: "1" }, defaultSourcesFile: cat });
    const list = (await app.inject({ url: "/api/market/sources" })).json() as { sources: { id: string; trust: string }[] };
    expect(list.sources.map((s) => [s.id, s.trust])).toEqual([["anthropic-skills", "official"]]);
    await app.inject({ method: "DELETE", url: "/api/market/sources/anthropic-skills" });
    const again = await createServer({ dataDir, scan: fakeScan, env: { AF_MARKET_ADMIN: "1" }, defaultSourcesFile: cat });
    expect(((await again.inject({ url: "/api/market/sources" })).json() as { sources: unknown[] }).sources).toEqual([]);
  });

  it("defaultSourcesFile 기본값은 저장소 catalog/market-sources.json", async () => {
    const dataDir = tmpDir("af-data-");
    const app = await createServer({ dataDir, scan: fakeScan });
    const list = (await app.inject({ url: "/api/market/sources" })).json() as { sources: { id: string }[] };
    expect(list.sources.map((s) => s.id)).toContain("anthropic-skills");
  });

  it("재시작해도 등록·색인이 유지", async () => {
    const g = gh();
    const { app, dataDir } = await makeServer({ fetch: g.fetch });
    await app.inject({ method: "POST", url: "/api/market/sources", payload: { id: "one", kind: "github", owner: "o", repo: "r" } });
    await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    const app2 = await createServer({ dataDir, scan: fakeScan, env: { AF_MARKET_ADMIN: "1" }, fetch: g.fetch, defaultSourcesFile: join(dataDir, "none.json") });
    expect(((await app2.inject({ url: "/api/market/search" })).json() as { skills: unknown[] }).skills).toHaveLength(2);
  });

  it("webDist 가 있으면 / 에서 정적 파일 제공, API 는 그대로", async () => {
    const dist = tmpDir("af-web-");
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "index.html"), "<html>AF</html>");
    const { app } = await makeServer({ webDist: dist });
    expect((await app.inject({ url: "/" })).body).toContain("AF");
    expect((await app.inject({ url: "/api/market/health" })).json().ok).toBe(true);
    expect(readFileSync(join(dist, "index.html"), "utf8")).toContain("AF");
    expect((await app.inject({ url: "/api/nope" })).json().code).toBe("NOT_FOUND");
  });
});
