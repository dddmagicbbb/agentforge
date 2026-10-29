import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fakeGithub, makeServer, SKILL_MD } from "./helpers.js";

const SHA = "a".repeat(40);
const files = {
  "README.md": "# repo",
  "skills/pdf/SKILL.md": SKILL_MD("pdf", "PDF 처리"),
  "skills/pdf/scripts/run.py": "print(1)",
  "skills/pdf/ref/guide.md": "guide",
  "skills/docx/SKILL.md": SKILL_MD("docx", "Word 문서"),
  "other/x.md": "x",
};

const register = (app: Awaited<ReturnType<typeof makeServer>>["app"], extra: object = {}) =>
  app.inject({ method: "POST", url: "/api/market/sources", payload: { id: "gh", kind: "github", owner: "acme", repo: "skills", trust: "org", path: "skills", ...extra } });

describe("MKT-01 github 소스", () => {
  it("색인: ref→sha, path 아래 스킬, flags(scan 주입), 파일 내용", async () => {
    const gh = fakeGithub({ "acme/skills": { sha: SHA, files } });
    const { app } = await makeServer({ fetch: gh.fetch });
    expect((await register(app)).statusCode).toBe(201);
    const r = await app.inject({ method: "POST", url: "/api/market/refresh", payload: { id: "gh" } });
    expect(r.json()).toEqual({ results: [{ id: "gh", ok: true, sha: SHA, skillCount: 2 }] });
    expect(gh.calls[0]!.url).toBe("https://api.github.com/repos/acme/skills/commits/HEAD");

    const s = (await app.inject({ url: "/api/market/search" })).json() as { skills: { id: string; flags: string[]; fileCount: number; ref: string; src: string; trust: string }[] };
    expect(s.skills.map((x) => x.id)).toEqual(["docx", "pdf"]);
    const pdf = s.skills.find((x) => x.id === "pdf")!;
    expect(pdf).toMatchObject({ flags: ["SCRIPTS"], fileCount: 3, ref: SHA, trust: "org", sourceId: "gh", description: "PDF 처리" });
    expect(pdf.src).toContain("acme/skills");

    const d = (await app.inject({ url: "/api/market/skills/gh/pdf" })).json() as { files: { path: string; content: string }[]; ref: string; trust: string };
    expect(d.files.map((f) => f.path).sort()).toEqual(["SKILL.md", "ref/guide.md", "scripts/run.py"]);
    expect(d.files.find((f) => f.path === "SKILL.md")!.content).toBe(SKILL_MD("pdf", "PDF 처리"));
    expect(d.ref).toBe(SHA);
  });

  it("ref 지정 시 해당 ref 로 조회, GHES baseUrl 사용", async () => {
    const gh = fakeGithub({ "acme/skills": { sha: SHA, files } });
    const { app } = await makeServer({ fetch: gh.fetch });
    await register(app, { ref: "release/1.0", baseUrl: "https://ghe.example.com/api/v3" });
    await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    expect(gh.calls[0]!.url).toBe("https://ghe.example.com/api/v3/repos/acme/skills/commits/release%2F1.0");
    expect(gh.calls.every((c) => c.url.startsWith("https://ghe.example.com/api/v3/"))).toBe(true);
  });

  it("tokenEnv: Authorization 에만 쓰고 응답·색인 파일에는 없다", async () => {
    const TOKEN = "ghp_SUPERSECRET123";
    const gh = fakeGithub({ "acme/skills": { sha: SHA, files } });
    const { app, dataDir } = await makeServer({ fetch: gh.fetch, env: { AF_MARKET_TOKEN_MY: TOKEN } });
    const reg = await register(app, { tokenEnv: "AF_MARKET_TOKEN_MY" });
    const refresh = await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    const list = await app.inject({ url: "/api/market/sources" });
    const all = reg.body + refresh.body + list.body + (await app.inject({ url: "/api/market/search" })).body;
    expect(all).not.toContain(TOKEN);
    expect(gh.calls.every((c) => c.auth === `Bearer ${TOKEN}`)).toBe(true);
    const dump = [join(dataDir, "sources.json"), ...readdirSync(join(dataDir, "index")).map((f) => join(dataDir, "index", f))].map((f) => readFileSync(f, "utf8")).join("\n");
    expect(dump).not.toContain(TOKEN);
    expect(dump).toContain("AF_MARKET_TOKEN_MY");
  });

  it("토큰 값 필드를 보내면 거부(SOURCE_INVALID)", async () => {
    const { app } = await makeServer();
    const r = await register(app, { token: "ghp_x" });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toEqual({ code: "SOURCE_INVALID", params: expect.any(Object) });
    expect(r.body).not.toContain("ghp_x");
  });

  it.each([404, 403, 429, 500])("HTTP %i → SOURCE_FETCH_FAILED, 본문 미노출, 기존 색인 유지·오류 코드 기록", async (status) => {
    let fail = false;
    const gh = fakeGithub({ "acme/skills": { sha: SHA, files } }, () => (fail ? { status } : undefined));
    const { app } = await makeServer({ fetch: gh.fetch });
    await register(app);
    await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    fail = true;
    const r = await app.inject({ method: "POST", url: "/api/market/refresh", payload: { id: "gh" } });
    expect(r.json()).toEqual({ results: [{ id: "gh", ok: false, code: "SOURCE_FETCH_FAILED", params: { status } }] });
    expect(r.body).not.toContain("SECRET-BODY");
    const src = (await app.inject({ url: "/api/market/sources" })).json() as { sources: { id: string; lastError?: string; lastSha?: string }[] };
    expect(src.sources[0]).toMatchObject({ id: "gh", lastError: "SOURCE_FETCH_FAILED", lastSha: SHA });
    expect(((await app.inject({ url: "/api/market/search" })).json() as { skills: unknown[] }).skills).toHaveLength(2);
  });

  it("네트워크 예외·시간 초과도 코드로만 응답", async () => {
    const { app } = await makeServer({
      fetch: async () => {
        throw new Error("connect ECONNREFUSED token=zzz");
      },
    });
    await register(app);
    const r = await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    expect(r.json().results[0]).toMatchObject({ ok: false, code: "SOURCE_FETCH_FAILED" });
    expect(r.body).not.toContain("zzz");
    const { app: app2 } = await makeServer({
      fetch: async () => {
        throw Object.assign(new Error("t"), { name: "TimeoutError" });
      },
    });
    await register(app2);
    const r2 = await app2.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    expect(r2.json().results[0]).toMatchObject({ ok: false, code: "SOURCE_TIMEOUT" });
  });

  it("경로 조작 항목(.., .git, 절대 경로)은 무시", async () => {
    const evil = { ...files, "skills/bad/../../x/SKILL.md": "x", "skills/.git/SKILL.md": "x", "/abs/SKILL.md": "x" };
    const gh = fakeGithub({ "acme/skills": { sha: SHA, files: evil } });
    const { app } = await makeServer({ fetch: gh.fetch });
    await register(app);
    await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
    const s = (await app.inject({ url: "/api/market/search" })).json() as { skills: { id: string }[] };
    expect(s.skills.map((x) => x.id)).toEqual(["docx", "pdf"]);
  });
});
