import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { AppError, type GithubTargetT, type RenderedFile } from "@agentforge/core";
import { pushToGithub } from "../src/github.js";
import { toZip } from "../src/zip.js";

const TOKEN = "ghp_SECRET_TOKEN_VALUE_123";

const FILES: RenderedFile[] = [
  { path: "README.md", content: "# 안녕\n", mode: 0o644, author: "template" },
  { path: "scripts/setup.sh", content: "#!/usr/bin/env bash\n", mode: 0o755, author: "template" },
  { path: ".claude/settings.json", content: "{}\n", mode: 0o644, author: "template" },
];

interface Call {
  method: string;
  url: string;
  headers: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}
interface Reply {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}
type Routes = Record<string, Reply | ((call: Call) => Reply)>;

// 요청을 기록하는 가짜 GitHub API. 키 형식: "METHOD /path"
function fake(routes: Routes) {
  const calls: Call[] = [];
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const call: Call = {
      method: init?.method ?? "GET",
      url,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const path = new URL(url).pathname.replace(/^\/api\/v3/, "");
    const r = routes[`${call.method} ${path}`];
    if (!r) return new Response(JSON.stringify({ message: "route missing " + path }), { status: 599, headers: { "content-type": "application/json" } });
    const rep = typeof r === "function" ? r(call) : r;
    return new Response(JSON.stringify(rep.body ?? {}), { status: rep.status ?? 200, headers: { "content-type": "application/json", ...rep.headers } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

function createRoutes(extra: Routes = {}, orgOwner = false): Routes {
  let b = 0;
  const blob = () => ({ status: 201, body: { sha: `blob${++b}` } });
  return {
    "GET /user": { body: { login: orgOwner ? "someone" : "alice" } },
    "POST /user/repos": { status: 201, body: { name: "proj", default_branch: "main", html_url: "https://github.com/alice/proj" } },
    "POST /orgs/acme/repos": { status: 201, body: { name: "proj", default_branch: "trunk", html_url: "https://github.com/acme/proj" } },
    "POST /repos/alice/proj/git/blobs": blob,
    "POST /repos/acme/proj/git/blobs": blob,
    "POST /repos/alice/proj/git/trees": { status: 201, body: { sha: "tree1" } },
    "POST /repos/acme/proj/git/trees": { status: 201, body: { sha: "tree1" } },
    "POST /repos/alice/proj/git/commits": { status: 201, body: { sha: "commit1" } },
    "POST /repos/acme/proj/git/commits": { status: 201, body: { sha: "commit1" } },
    "PATCH /repos/alice/proj/git/refs/heads/main": { body: { ref: "refs/heads/main" } },
    "PATCH /repos/acme/proj/git/refs/heads/trunk": { body: { ref: "refs/heads/trunk" } },
    ...extra,
  };
}

const T: GithubTargetT = { owner: "alice", repo: "proj", visibility: "private" };
const seq = (calls: Call[]) => calls.map((c) => `${c.method} ${new URL(c.url).pathname}`);

describe("pushToGithub create", () => {
  it("순서: user → repos → blobs → trees(base_tree 없음) → commits(부모 없음) → refs force", async () => {
    const { f, calls } = fake(createRoutes());
    const r = await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "ko" });
    const s = seq(calls);
    expect(s[0]).toBe("GET /user");
    expect(s[1]).toBe("POST /user/repos");
    expect(s.filter((x) => x.endsWith("/git/blobs"))).toHaveLength(3);
    expect(s.slice(-3)).toEqual(["POST /repos/alice/proj/git/trees", "POST /repos/alice/proj/git/commits", "PATCH /repos/alice/proj/git/refs/heads/main"]);
    const tree = calls.find((c) => c.url.endsWith("/git/trees"))!;
    expect(tree.body.base_tree).toBeUndefined();
    const commit = calls.find((c) => c.url.endsWith("/git/commits"))!;
    expect(commit.body.parents).toEqual([]);
    expect(commit.body.tree).toBe("tree1");
    expect(commit.body.message).toBe("AgentForge 환경 생성");
    expect(calls.at(-1)!.body).toEqual({ sha: "commit1", force: true });
    expect(r).toEqual({ url: "https://github.com/alice/proj", commitSha: "commit1" });
  });

  it("영어 커밋 메시지", async () => {
    const { f, calls } = fake(createRoutes());
    await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "en" });
    expect(calls.find((c) => c.url.endsWith("/git/commits"))!.body.message).toBe("Generate AgentForge environment");
  });

  it("tree mode: RenderedFile.mode 기준(0o755 만 100755), type blob", async () => {
    const { f, calls } = fake(createRoutes());
    await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "ko" });
    const items = calls.find((c) => c.url.endsWith("/git/trees"))!.body.tree as { path: string; mode: string; type: string; sha: string }[];
    expect(Object.fromEntries(items.map((i) => [i.path, i.mode]))).toEqual({ "README.md": "100644", "scripts/setup.sh": "100755", ".claude/settings.json": "100644" });
    expect(items.every((i) => i.type === "blob" && i.sha.startsWith("blob"))).toBe(true);
  });

  it("mode 0o644 인 .sh(가져온 스킬)는 100644", async () => {
    const { f, calls } = fake(createRoutes());
    const imported: RenderedFile[] = [{ path: ".claude/skills/x/run.sh", content: "echo", mode: 0o644, author: "ai-fill" }];
    await pushToGithub(imported, T, TOKEN, { fetch: f, language: "ko" });
    expect(calls.find((c) => c.url.endsWith("/git/trees"))!.body.tree[0].mode).toBe("100644");
  });

  it("owner 가 인증 사용자가 아니면 /orgs/{owner}/repos, 기본 브랜치는 응답 값, visibility 반영", async () => {
    const { f, calls } = fake(createRoutes({}, true));
    await pushToGithub(FILES, { owner: "acme", repo: "proj", visibility: "public" }, TOKEN, { fetch: f, language: "ko" });
    const mk = calls.find((c) => c.url.endsWith("/orgs/acme/repos"))!;
    expect(mk.body).toMatchObject({ name: "proj", private: false, auto_init: true });
    expect(calls.at(-1)!.url).toContain("/git/refs/heads/trunk");
  });

  it("user 경로는 private: true", async () => {
    const { f, calls } = fake(createRoutes());
    await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "ko" });
    expect(calls.find((c) => c.url.endsWith("/user/repos"))!.body).toMatchObject({ name: "proj", private: true, auto_init: true });
  });

  it("env.local 경로가 있으면 어떤 요청도 보내기 전에 EXPORT_SECRET_PATH", async () => {
    const { f, calls } = fake(createRoutes());
    const bad: RenderedFile[] = [...FILES, { path: ".agentforge/env.local", content: "K=1", mode: 0o644, author: "template" }];
    await expect(pushToGithub(bad, T, TOKEN, { fetch: f, language: "ko" })).rejects.toMatchObject({ code: "EXPORT_SECRET_PATH" });
    expect(calls).toHaveLength(0);
  });

  it("GHES baseUrl 사용, 토큰은 Authorization 헤더로만", async () => {
    const { f, calls } = fake(createRoutes());
    await pushToGithub(FILES, { ...T, baseUrl: "https://ghe.example.com/api/v3" }, TOKEN, { fetch: f, language: "ko" });
    expect(calls.every((c) => c.url.startsWith("https://ghe.example.com/api/v3/"))).toBe(true);
    expect(calls.every((c) => c.headers["authorization"]?.includes(TOKEN))).toBe(true);
    expect(calls.some((c) => c.url.includes(TOKEN) || JSON.stringify(c.body ?? "").includes(TOKEN))).toBe(false);
  });

  it("기본 baseUrl 은 api.github.com", async () => {
    const { f, calls } = fake(createRoutes());
    await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "ko" });
    expect(calls[0]!.url.startsWith("https://api.github.com/")).toBe(true);
  });
});

describe("pushToGithub pr", () => {
  const prRoutes = (extra: Routes = {}): Routes => ({
    "GET /repos/alice/proj": { body: { default_branch: "main", html_url: "https://github.com/alice/proj" } },
    "GET /repos/alice/proj/git/ref/heads/main": { body: { object: { sha: "base1" } } },
    "GET /repos/alice/proj/git/commits/base1": { body: { tree: { sha: "basetree" } } },
    "POST /repos/alice/proj/git/blobs": { status: 201, body: { sha: "blobX" } },
    "POST /repos/alice/proj/git/trees": { status: 201, body: { sha: "tree2" } },
    "POST /repos/alice/proj/git/commits": { status: 201, body: { sha: "commit2" } },
    "POST /repos/alice/proj/git/refs": { status: 201, body: {} },
    "POST /repos/alice/proj/pulls": { status: 201, body: { html_url: "https://github.com/alice/proj/pull/7" } },
    ...extra,
  });
  const P: GithubTargetT = { ...T, mode: "pr" };

  it("순서와 base_tree·부모 1·refs·pulls", async () => {
    const { f, calls } = fake(prRoutes());
    const r = await pushToGithub(FILES, P, TOKEN, { fetch: f, language: "en" });
    const s = seq(calls);
    expect(s[0]).toBe("GET /repos/alice/proj");
    expect(s.indexOf("GET /repos/alice/proj/git/ref/heads/main")).toBeLessThan(s.indexOf("GET /repos/alice/proj/git/commits/base1"));
    expect(s.slice(-4)).toEqual(["POST /repos/alice/proj/git/trees", "POST /repos/alice/proj/git/commits", "POST /repos/alice/proj/git/refs", "POST /repos/alice/proj/pulls"]);
    expect(calls.find((c) => c.url.endsWith("/git/trees"))!.body.base_tree).toBe("basetree");
    expect(calls.find((c) => c.url.endsWith("/git/commits"))!.body.parents).toEqual(["base1"]);
    expect(calls.find((c) => c.url.endsWith("/git/refs"))!.body).toEqual({ ref: "refs/heads/agentforge/setup", sha: "commit2" });
    expect(calls.at(-1)!.body).toMatchObject({ head: "agentforge/setup", base: "main" });
    expect(r).toEqual({ url: "https://github.com/alice/proj", commitSha: "commit2", prUrl: "https://github.com/alice/proj/pull/7" });
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("branch 지정", async () => {
    const { f, calls } = fake(prRoutes());
    await pushToGithub(FILES, { ...P, branch: "feat/x" }, TOKEN, { fetch: f, language: "ko" });
    expect(calls.find((c) => c.url.endsWith("/git/refs"))!.body.ref).toBe("refs/heads/feat/x");
  });

  it("브랜치가 이미 있으면(422) GITHUB_BRANCH_EXISTS", async () => {
    const { f } = fake(prRoutes({ "POST /repos/alice/proj/git/refs": { status: 422, body: { message: "Reference already exists" } } }));
    await expect(pushToGithub(FILES, P, TOKEN, { fetch: f, language: "ko" })).rejects.toMatchObject({ code: "GITHUB_BRANCH_EXISTS" });
  });
});

describe("pushToGithub 오류 매핑", () => {
  const run = (routes: Routes, t: GithubTargetT = T) => pushToGithub(FILES, t, TOKEN, { fetch: fake(routes).f, language: "ko" }).then(() => { throw new Error("오류가 나야 한다"); }, (e: unknown) => e as AppError);
  const secretBody = { message: `bad credentials ${TOKEN}` };

  it("401 → GITHUB_AUTH", async () => {
    const e = await run(createRoutes({ "GET /user": { status: 401, body: secretBody } }));
    expect(e).toBeInstanceOf(AppError);
    expect(e.code).toBe("GITHUB_AUTH");
  });
  it("403 → GITHUB_AUTH, rate limit 헤더·429 면 GITHUB_RATE_LIMIT", async () => {
    expect((await run(createRoutes({ "GET /user": { status: 403 } }))).code).toBe("GITHUB_AUTH");
    expect((await run(createRoutes({ "GET /user": { status: 403, headers: { "x-ratelimit-remaining": "0" } } }))).code).toBe("GITHUB_RATE_LIMIT");
    expect((await run(createRoutes({ "GET /user": { status: 429 } }))).code).toBe("GITHUB_RATE_LIMIT");
  });
  it("404 → GITHUB_NOT_FOUND", async () => {
    const e = await run(createRoutes({ "POST /orgs/acme/repos": { status: 404 } }, true), { owner: "acme", repo: "proj", visibility: "private" });
    expect(e.code).toBe("GITHUB_NOT_FOUND");
  });
  it("create 의 422 → GITHUB_REPO_EXISTS", async () => {
    expect((await run(createRoutes({ "POST /user/repos": { status: 422, body: secretBody } }))).code).toBe("GITHUB_REPO_EXISTS");
  });
  it("500 → GITHUB_FAILED", async () => {
    expect((await run(createRoutes({ "POST /repos/alice/proj/git/trees": { status: 500 } }))).code).toBe("GITHUB_FAILED");
  });
  it("네트워크 오류 → GITHUB_NETWORK", async () => {
    const f = (async () => {
      throw new TypeError(`fetch failed ${TOKEN}`);
    }) as unknown as typeof fetch;
    const e = await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "ko" }).then(() => { throw new Error("오류가 나야 한다"); }, (x: unknown) => x as AppError);
    expect(e.code).toBe("GITHUB_NETWORK");
  });
  it("오류 message·params·직렬화에 토큰과 응답 본문이 없다", async () => {
    const cases = [
      createRoutes({ "GET /user": { status: 401, body: secretBody } }),
      createRoutes({ "POST /user/repos": { status: 422, body: secretBody } }),
      createRoutes({ "POST /repos/alice/proj/git/blobs": { status: 500, body: secretBody } }),
    ];
    for (const routes of cases) {
      const e = await run(routes);
      const dump = JSON.stringify({ m: e.message, p: e.params, s: e.stack ?? "", c: (e as { cause?: unknown }).cause ?? null });
      expect(dump).not.toContain(TOKEN);
      expect(dump).not.toContain("bad credentials");
      expect(Object.keys(e.params).every((k) => k === "status")).toBe(true);
    }
  });
});

describe("ZIP 동등", () => {
  it("tree 의 path·content·실행 권한이 toZip 항목과 같다", async () => {
    const { f, calls } = fake(createRoutes());
    await pushToGithub(FILES, T, TOKEN, { fetch: f, language: "ko" });
    const blobs = calls.filter((c) => c.url.endsWith("/git/blobs")).map((c) => c.body as { content: string; encoding: string });
    const items = calls.find((c) => c.url.endsWith("/git/trees"))!.body.tree as { path: string; mode: string }[];
    const zip = await JSZip.loadAsync(await toZip(FILES, "proj"));
    const names = Object.keys(zip.files).filter((n) => !zip.files[n]!.dir);
    expect(items.map((i) => `proj/${i.path}`).sort()).toEqual(names.sort());
    for (const [i, it] of items.entries()) {
      const entry = zip.files[`proj/${it.path}`]!;
      const text = await entry.async("string");
      const blob = blobs[i]!;
      const got = blob.encoding === "base64" ? Buffer.from(blob.content, "base64").toString("utf8") : blob.content;
      expect(got).toBe(text);
      expect((Number(entry.unixPermissions ?? 0) & 0o111) !== 0).toBe(it.mode === "100755");
    }
  });
});
