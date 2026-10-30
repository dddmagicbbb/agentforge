// review-2 보안 보강(design.md 9.7) 시험
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createServer, listenServer, startFromEnv } from "../src/index.js";
import { cloneArgs, gitEnv } from "../src/fetch-git.js";
import { parseDescription } from "../src/indexer.js";
import { fakeGithub, fakeScan, gitAvailable, makeGitRepo, makeServer, SKILL_MD, tmpDir } from "./helpers.js";

const SHA = "c".repeat(40);
const GH = { "o/r": { sha: SHA, files: { "x/SKILL.md": SKILL_MD("x", "d") } } };
const src = (extra: object = {}) => ({ id: "s", kind: "github", owner: "o", repo: "r", ...extra });
const post = (app: Awaited<ReturnType<typeof makeServer>>["app"], payload: object) => app.inject({ method: "POST", url: "/api/market/sources", payload });
const results = async (app: Awaited<ReturnType<typeof makeServer>>["app"]) => (await app.inject({ method: "POST", url: "/api/market/refresh", payload: {} })).json().results[0];

describe("1) tokenEnv 접두 · 토큰 소스는 https 만", () => {
  it("AF_MARKET_TOKEN_ 접두가 아니면 거부, 접두면 허용", async () => {
    const { app } = await makeServer();
    for (const t of ["PATH", "HOME", "AF_MARKET_TOKEN", "AF_MARKET_TOKEN_", "AF_MARKET_ADMIN"]) expect((await post(app, src({ id: "a", tokenEnv: t }))).statusCode, t).toBe(400);
    expect((await post(app, src({ id: "b", tokenEnv: "AF_MARKET_TOKEN_GHE" }))).statusCode).toBe(201);
  });

  it("토큰 + http baseUrl 거부, 토큰 없는 http 는 허용, 토큰 + https 허용", async () => {
    const { app } = await makeServer();
    expect((await post(app, src({ id: "a", tokenEnv: "AF_MARKET_TOKEN_A", baseUrl: "http://ghe.local/api/v3" }))).statusCode).toBe(400);
    expect((await post(app, src({ id: "b", baseUrl: "http://ghe.local/api/v3" }))).statusCode).toBe(201);
    expect((await post(app, src({ id: "c", tokenEnv: "AF_MARKET_TOKEN_C", baseUrl: "https://ghe.local/api/v3" }))).statusCode).toBe(201);
  });

  it("토큰 + file:// git 주소 거부", async () => {
    const { app } = await makeServer({ env: { AF_ALLOW_FILE_SOURCES: "1" } });
    const r = await post(app, { id: "g", kind: "git", url: "file:///tmp/x", tokenEnv: "AF_MARKET_TOKEN_G" });
    expect(r.statusCode).toBe(400);
  });

  it("갱신 시점에도 재검사: 손으로 쓴 sources.json 의 http+토큰은 요청을 보내지 않는다", async () => {
    const dataDir = tmpDir("af-data-");
    writeFileSync(join(dataDir, "sources.json"), JSON.stringify({ sources: [{ id: "s", kind: "github", trust: "unverified", owner: "o", repo: "r", baseUrl: "http://ghe.local/api/v3", tokenEnv: "AF_MARKET_TOKEN_A" }] }));
    const gh = fakeGithub(GH);
    const app = await createServer({ dataDir, scan: fakeScan, fetch: gh.fetch, env: { AF_MARKET_ADMIN: "1", AF_MARKET_TOKEN_A: "SECRET" }, defaultSourcesFile: join(dataDir, "none.json") });
    expect(await results(app)).toMatchObject({ ok: false, code: "SOURCE_INVALID" });
    expect(gh.calls).toHaveLength(0);
  });
});

describe("2) owner·repo·path 의 . / .. 금지", () => {
  it.each([
    ["repo", { repo: ".." }],
    ["repo", { repo: "." }],
    ["path", { path: "a/./b" }],
    ["path", { path: "a/../b" }],
    ["path", { path: ".." }],
  ])("%s %j 거부", async (_n, extra) => {
    const { app } = await makeServer();
    expect((await post(app, src(extra))).statusCode).toBe(400);
  });
});

describe("3) 관리 POST 는 Content-Type application/json 만", () => {
  it("본문·Content-Type 없는 refresh, text/plain 은 415 SOURCE_INVALID 이고 갱신하지 않는다", async () => {
    const gh = fakeGithub(GH);
    const { app } = await makeServer({ fetch: gh.fetch });
    await post(app, src());
    for (const headers of [{}, { "content-type": "text/plain" }, { "content-type": "application/x-www-form-urlencoded" }]) {
      const r = await app.inject({ method: "POST", url: "/api/market/refresh", headers, payload: headers["content-type" as keyof typeof headers] ? "{}" : undefined });
      expect(r.statusCode, JSON.stringify(headers)).toBe(415);
      expect(r.json().code).toBe("SOURCE_INVALID");
    }
    const reg = await app.inject({ method: "POST", url: "/api/market/sources", headers: { "content-type": "text/plain" }, payload: JSON.stringify(src({ id: "z" })) });
    expect(reg.statusCode).toBe(415);
    expect(gh.calls).toHaveLength(0);
    expect(((await app.inject({ url: "/api/market/sources" })).json() as { sources: unknown[] }).sources).toHaveLength(1);
  });

  it("charset 이 붙은 application/json 은 허용, 관리 꺼짐이면 415 보다 403 이 먼저", async () => {
    const { app } = await makeServer();
    const ok = await app.inject({ method: "POST", url: "/api/market/refresh", headers: { "content-type": "application/json; charset=utf-8" }, payload: "{}" });
    expect(ok.statusCode).toBe(200);
    const { app: off } = await makeServer({ env: { AF_MARKET_ADMIN: "0" } });
    expect((await off.inject({ method: "POST", url: "/api/market/refresh" })).statusCode).toBe(403);
  });
});

describe("4) Host 허용 목록", () => {
  it("localhost·127.0.0.1·[::1] (포트 포함) 허용", async () => {
    const { app } = await makeServer();
    for (const host of ["localhost", "localhost:3000", "127.0.0.1:8787", "[::1]:8787", "LOCALHOST"]) {
      expect((await app.inject({ url: "/api/market/health", headers: { host } })).statusCode, host).toBe(200);
    }
  });

  it("그 밖의 Host 는 모든 API 에서 403 HOST_DENIED (관리 API 포함)", async () => {
    const { app } = await makeServer();
    for (const host of ["evil.com", "evil.com:80", "127.0.0.1.evil.com", "localhost.evil.com", "[::2]"]) {
      for (const [method, url] of [["GET", "/api/market/health"], ["GET", "/api/market/search"], ["POST", "/api/market/refresh"], ["GET", "/"]] as const) {
        const r = await app.inject({ method, url, headers: { host, "content-type": "application/json" }, payload: method === "POST" ? "{}" : undefined });
        expect(r.statusCode, `${host} ${url}`).toBe(403);
        expect(r.json()).toEqual({ code: "HOST_DENIED", params: {} });
      }
    }
  });

  it("AF_MARKET_HOSTS 쉼표 목록 추가 허용", async () => {
    const { app } = await makeServer({ env: { AF_MARKET_HOSTS: "market.example.com, Other.Local" } });
    for (const host of ["market.example.com", "market.example.com:8080", "other.local"]) expect((await app.inject({ url: "/api/market/health", headers: { host } })).statusCode, host).toBe(200);
    expect((await app.inject({ url: "/api/market/health", headers: { host: "evil.com" } })).statusCode).toBe(403);
  });
});

describe("6) listen 진입점", () => {
  it("listenServer 기본 host 는 127.0.0.1", async () => {
    const { app } = await makeServer();
    const addr = await listenServer(app, { port: 0 });
    try {
      expect(addr.host).toBe("127.0.0.1");
      expect(addr.port).toBeGreaterThan(0);
      const res = await fetch(`http://127.0.0.1:${addr.port}/api/market/health`);
      expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("startFromEnv: PORT·AF_MARKET_DATA·AF_WEB_DIST 를 읽는다", async () => {
    const dataDir = tmpDir("af-data-");
    const web = tmpDir("af-web-");
    writeFileSync(join(web, "index.html"), "<html>WEB</html>");
    const { app, address } = await startFromEnv({ PORT: "0", AF_MARKET_DATA: dataDir, AF_WEB_DIST: web, AF_MARKET_ADMIN: "1" }, fakeScan);
    try {
      expect(address.host).toBe("127.0.0.1");
      expect(await (await fetch(`http://127.0.0.1:${address.port}/`)).text()).toContain("WEB");
      expect(readdirSync(dataDir)).toContain("sources.json");
    } finally {
      await app.close();
    }
  });

  it("startFromEnv: 잘못된 PORT 는 거부", async () => {
    await expect(startFromEnv({ PORT: "abc", AF_MARKET_DATA: tmpDir() }, fakeScan)).rejects.toThrow();
    await expect(startFromEnv({ PORT: "70000", AF_MARKET_DATA: tmpDir() }, fakeScan)).rejects.toThrow();
  });
});

describe("7) 생존 변이 대응", () => {
  it("INTERNAL 응답에 내부 메시지가 없다", async () => {
    const { app, dataDir } = await makeServer();
    writeFileSync(join(dataDir, "sources.json"), "{ broken SECRET-INTERNAL");
    const r = await app.inject({ url: "/api/market/sources" });
    expect(r.statusCode).toBe(500);
    expect(r.json()).toEqual({ code: "INTERNAL", params: {} });
    expect(r.body).not.toContain("SECRET-INTERNAL");
    expect(r.body).not.toContain("JSON");
  });

  it("50개 경계: 50개는 허용, 51개는 tooLarge", async () => {
    const mk = (n: number) => {
      const f: Record<string, string> = { "x/SKILL.md": SKILL_MD("x", "d") };
      for (let i = 1; i < n; i++) f[`x/f${i}.md`] = "a";
      return f;
    };
    for (const [n, blocked] of [[50, undefined], [51, "tooLarge"]] as const) {
      const gh = fakeGithub({ "o/r": { sha: SHA, files: mk(n) } });
      const { app } = await makeServer({ fetch: gh.fetch });
      await post(app, src());
      await results(app);
      const s = (await app.inject({ url: "/api/market/search" })).json().skills[0];
      expect(s.fileCount).toBe(n);
      expect(s.blocked).toBe(blocked);
    }
  });

  it("파일 문자 수 경계: 200,000자는 허용, 200,001자는 tooLarge / 합계 512,000자 초과도 tooLarge", async () => {
    const run = async (files: Record<string, string>) => {
      const gh = fakeGithub({ "o/r": { sha: SHA, files: { "x/SKILL.md": SKILL_MD("x", "d"), ...files } } });
      const { app } = await makeServer({ fetch: gh.fetch });
      await post(app, src());
      await results(app);
      return (await app.inject({ url: "/api/market/search" })).json().skills[0].blocked as string | undefined;
    };
    expect(await run({ "x/a.md": "a".repeat(200_000) })).toBeUndefined();
    expect(await run({ "x/a.md": "a".repeat(200_001) })).toBe("tooLarge");
    expect(await run({ "x/a.md": "a".repeat(200_000), "x/b.md": "a".repeat(200_000), "x/c.md": "a".repeat(120_000) })).toBe("tooLarge");
    // 한글은 바이트가 3배여도 문자 수 기준으로 허용(바이트 150,000자 = 450,000B)
    expect(await run({ "x/k.md": "가".repeat(150_000) })).toBeUndefined();
  });

  it("badPath: 공백·한글 파일명, 깊이 6 이상은 스킬 전체 차단(SKILL_BLOCKED badPath)", async () => {
    for (const bad of ["x/a b.md", "x/한글.md", "x/a/b/c/d/e/f.md"]) {
      const gh = fakeGithub({ "o/r": { sha: SHA, files: { "x/SKILL.md": SKILL_MD("x", "d"), [bad]: "z" } } });
      const { app } = await makeServer({ fetch: gh.fetch });
      await post(app, src());
      await results(app);
      expect((await app.inject({ url: "/api/market/search" })).json().skills[0].blocked, bad).toBe("badPath");
      expect((await app.inject({ url: "/api/market/skills/s/x" })).json()).toEqual({ code: "SKILL_BLOCKED", params: { reason: "badPath" } });
    }
    // 깊이 5 는 허용
    const gh = fakeGithub({ "o/r": { sha: SHA, files: { "x/SKILL.md": SKILL_MD("x", "d"), "x/a/b/c/d/e.md": "z" } } });
    const { app } = await makeServer({ fetch: gh.fetch });
    await post(app, src());
    await results(app);
    expect((await app.inject({ url: "/api/market/search" })).json().skills[0].blocked).toBeUndefined();
  });

  it("gitEnv: file 소스는 GIT_ALLOW_PROTOCOL=file, https 는 https, 토큰은 env 로만", () => {
    const deps = { gitBin: "git", env: { AF_MARKET_TOKEN_A: "TOK" }, timeoutMs: 1 };
    const f = gitEnv({ id: "a", kind: "git", trust: "unverified", url: "file:///x" }, deps);
    expect(f["GIT_ALLOW_PROTOCOL"]).toBe("file");
    expect(f["GIT_TERMINAL_PROMPT"]).toBe("0");
    const h = gitEnv({ id: "a", kind: "git", trust: "unverified", url: "https://h/x.git", tokenEnv: "AF_MARKET_TOKEN_A" }, deps);
    expect(h["GIT_ALLOW_PROTOCOL"]).toBe("https");
    expect(h["GIT_CONFIG_VALUE_0"]).toContain(Buffer.from("x-access-token:TOK").toString("base64"));
    expect(Object.keys(f)).not.toContain("GIT_CONFIG_COUNT");
  });

  it("cloneArgs: -- 구분자 뒤에 주소, 값에 토큰 없음, --branch 는 ref 일 때만", () => {
    const a = cloneArgs({ id: "a", kind: "git", trust: "unverified", url: "https://h/x.git", ref: "main", tokenEnv: "AF_MARKET_TOKEN_A" }, "/tmp/d");
    const dd = a.indexOf("--");
    expect(a.slice(dd)).toEqual(["--", "https://h/x.git", "/tmp/d"]);
    expect(a[a.indexOf("--branch") + 1]).toBe("main");
    expect(a.join(" ")).not.toContain("AF_MARKET_TOKEN_A");
    expect(cloneArgs({ id: "a", kind: "git", trust: "unverified", url: "https://h/x.git" }, "/d")).not.toContain("--branch");
  });
});

const d = gitAvailable ? describe : describe.skip;
d("5) git symlink 제외 · 갱신 시 file:// 재검사", () => {
  it("mode 120000 항목은 파일에서 제외, SKILL.md 가 링크면 스킬로 보지 않음", async () => {
    const repo = makeGitRepo(
      { "sk/SKILL.md": SKILL_MD("sk", "d"), "sk/real.md": "real", "lk/other.md": "o" },
      { "sk/link.md": "real.md", "lk/SKILL.md": "../sk/SKILL.md" },
    );
    const { app } = await makeServer({ env: { AF_ALLOW_FILE_SOURCES: "1" } });
    await post(app, { id: "g", kind: "git", url: repo.url });
    expect(await results(app)).toMatchObject({ ok: true, skillCount: 1 });
    const detail = (await app.inject({ url: "/api/market/skills/g/sk" })).json();
    expect(detail.files.map((f: { path: string }) => f.path).sort()).toEqual(["SKILL.md", "real.md"]);
  });

  it("갱신 시점에도 file:// 재검사(손으로 쓴 sources.json)", async () => {
    const repo = makeGitRepo({ "a/SKILL.md": SKILL_MD("a", "d") });
    const dataDir = tmpDir("af-data-");
    writeFileSync(join(dataDir, "sources.json"), JSON.stringify({ sources: [{ id: "g", kind: "git", trust: "unverified", url: repo.url }] }));
    const app = await createServer({ dataDir, scan: fakeScan, env: { AF_MARKET_ADMIN: "1" }, defaultSourcesFile: join(dataDir, "none.json") });
    expect(await results(app)).toMatchObject({ ok: false, code: "SOURCE_INVALID" });
  });

  it("path 가 스킬 폴더 자체이면 루트 SKILL.md 를 인식", async () => {
    const repo = makeGitRepo({ "tools/pdf/SKILL.md": SKILL_MD("pdf", "d"), "tools/pdf/ref/a.md": "a", "tools/other/SKILL.md": SKILL_MD("other", "d") });
    const { app } = await makeServer({ env: { AF_ALLOW_FILE_SOURCES: "1" } });
    await post(app, { id: "g", kind: "git", url: repo.url, path: "tools/pdf" });
    expect(await results(app)).toMatchObject({ ok: true, skillCount: 1 });
    const detail = (await app.inject({ url: "/api/market/skills/g/pdf" })).json();
    expect(detail.files.map((f: { path: string }) => f.path).sort()).toEqual(["SKILL.md", "ref/a.md"]);
  });

  it("clone 임시 폴더는 실패해도 남지 않는다", async () => {
    const workDir = tmpDir("af-work-");
    const repo = makeGitRepo({ "a/SKILL.md": SKILL_MD("a", "d") });
    const { app } = await makeServer({ env: { AF_ALLOW_FILE_SOURCES: "1" }, workDir });
    await post(app, { id: "g", kind: "git", url: repo.url, ref: "nope" });
    await results(app);
    expect(readdirSync(workDir)).toEqual([]);
  });
});

describe("9) BOM", () => {
  it("BOM 이 붙은 SKILL.md 도 description 을 읽는다", () => {
    expect(parseDescription("﻿---\nname: x\ndescription: 설명\n---\n")).toBe("설명");
  });
});
