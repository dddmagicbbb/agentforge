import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gitAvailable, makeGitRepo, makeServer, SKILL_MD, tmpDir } from "./helpers.js";

const d = gitAvailable ? describe : describe.skip;
type App = Awaited<ReturnType<typeof makeServer>>["app"];

const reg = (app: App, url: string, extra: object = {}) => app.inject({ method: "POST", url: "/api/market/sources", payload: { id: "loc", kind: "git", url, ...extra } });
const refresh = (app: App) => app.inject({ method: "POST", url: "/api/market/refresh", payload: {} });
const search = async (app: App, qs = "") =>
  ((await app.inject({ url: `/api/market/search${qs}` })).json() as { skills: { id: string; blocked?: string; fileCount: number; flags: string[] }[] }).skills;

const repoFiles = {
  "a/SKILL.md": SKILL_MD("a", "Alpha tool"),
  "a/scripts/x.sh": "echo hi",
  "grp/b/SKILL.md": SKILL_MD("b", "Beta 도구"),
  "grp/deep/c/SKILL.md": SKILL_MD("c", "깊이 3 - 인식 안 함"),
  "Bad_Name/SKILL.md": SKILL_MD("bad", "폴더명 오류"),
  "huge/SKILL.md": SKILL_MD("huge", "큼"),
  "huge/big.md": "x".repeat(200_001),
  "bin/SKILL.md": SKILL_MD("bin", "바이너리"),
  "bin/logo.png": Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff, 0xfe, 0x00, 0x01]),
};
const ALLOW = { AF_ALLOW_FILE_SOURCES: "1" };

d("MKT-01 git 소스(file://)", () => {
  it("AF_ALLOW_FILE_SOURCES 없으면 SOURCE_INVALID", async () => {
    const repo = makeGitRepo(repoFiles);
    const { app } = await makeServer();
    const r = await reg(app, repo.url);
    expect(r.statusCode).toBe(400);
    expect(r.json().code).toBe("SOURCE_INVALID");
  });

  it("http:// 와 셸 메타문자·옵션 주입 주소는 거부", async () => {
    const { app } = await makeServer({ env: ALLOW });
    for (const url of ["http://example.com/a.git", "--upload-pack=x", "https://a.com/x;rm -rf", "ext::sh -c id", "https://user:pw@a.com/x.git"]) {
      expect((await reg(app, url)).json().code).toBe("SOURCE_INVALID");
    }
  });

  it("색인: 깊이 2 인식, 깊이 3·잘못된 폴더명 건너뜀, tooLarge·binary 표시, 임시 폴더 삭제", async () => {
    const repo = makeGitRepo(repoFiles);
    const workDir = tmpDir("af-work-");
    const { app } = await makeServer({ env: ALLOW, workDir });
    expect((await reg(app, repo.url)).statusCode).toBe(201);
    const r = (await refresh(app)).json();
    expect(r.results[0]).toMatchObject({ id: "loc", ok: true, skillCount: 4 });
    expect(r.results[0].sha).toMatch(/^[0-9a-f]{40}$/);
    const skills = await search(app);
    expect(skills.map((s) => s.id)).toEqual(["a", "b", "bin", "huge"]);
    expect(skills.find((s) => s.id === "a")).toMatchObject({ flags: ["SCRIPTS"], fileCount: 2 });
    expect(skills.find((s) => s.id === "huge")!.blocked).toBe("tooLarge");
    expect(skills.find((s) => s.id === "bin")!.blocked).toBe("binary");
    expect(readdirSync(workDir)).toEqual([]);
  });

  it("차단 스킬 상세는 SKILL_BLOCKED, 정상은 파일 원문", async () => {
    const repo = makeGitRepo(repoFiles);
    const { app } = await makeServer({ env: ALLOW });
    await reg(app, repo.url);
    await refresh(app);
    for (const [id, reason] of [["huge", "tooLarge"], ["bin", "binary"]] as const) {
      const r = await app.inject({ url: `/api/market/skills/loc/${id}` });
      expect(r.statusCode).toBe(409);
      expect(r.json()).toEqual({ code: "SKILL_BLOCKED", params: { reason } });
    }
    const ok = (await app.inject({ url: "/api/market/skills/loc/a" })).json();
    expect(ok.files.map((f: { path: string }) => f.path).sort()).toEqual(["SKILL.md", "scripts/x.sh"]);
    expect(ok.files.find((f: { path: string }) => f.path === "SKILL.md").content).toBe(SKILL_MD("a", "Alpha tool"));
    expect(ok.ref).toMatch(/^[0-9a-f]{40}$/);
  });

  it("path 지정 시 그 아래만, path 기준 깊이 2 인식", async () => {
    const repo = makeGitRepo(repoFiles);
    const { app } = await makeServer({ env: ALLOW });
    await reg(app, repo.url, { path: "grp" });
    await refresh(app);
    expect((await search(app)).map((s) => s.id)).toEqual(["b", "c"]); // path 기준 깊이 2 (grp/deep/c)
  });

  it("없는 ref → SOURCE_FETCH_FAILED(git 메시지·경로 미노출)", async () => {
    const repo = makeGitRepo(repoFiles);
    const { app } = await makeServer({ env: ALLOW });
    await reg(app, repo.url, { ref: "nope" });
    const r = await refresh(app);
    expect(r.json().results[0]).toMatchObject({ ok: false, code: "SOURCE_FETCH_FAILED" });
    expect(r.body).not.toContain("fatal");
    expect(r.body).not.toContain(repo.dir.replace(/\\/g, "/"));
  });

  it("시간 제한 초과 → SOURCE_TIMEOUT", async () => {
    const repo = makeGitRepo(repoFiles);
    const { app } = await makeServer({ env: ALLOW, gitTimeoutMs: 1 });
    await reg(app, repo.url);
    const r = await refresh(app);
    expect(r.json().results[0]).toMatchObject({ ok: false, code: "SOURCE_TIMEOUT" });
  });

  it("git 실행 파일이 없으면 SOURCE_FETCH_FAILED", async () => {
    const repo = makeGitRepo(repoFiles);
    const { app } = await makeServer({ env: ALLOW, gitBin: "git-does-not-exist-xyz" });
    await reg(app, repo.url);
    expect((await refresh(app)).json().results[0]).toMatchObject({ ok: false, code: "SOURCE_FETCH_FAILED" });
  });
});
