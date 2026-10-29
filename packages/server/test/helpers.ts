// 시험 보조: 가짜 GitHub fetch, 임시 git 저장소, 임시 dataDir
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer, type FetchLike, type ServerOptions } from "../src/index.js";

export const gitAvailable = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

/** 시험용 위험 검사: scripts/ 파일이 있으면 SCRIPTS (core scanSkillRisk 대역) */
export const fakeScan: ServerOptions["scan"] = (files) => (files.some((f) => f.path.startsWith("scripts/")) ? ["SCRIPTS"] : []);

export function tmpDir(prefix = "af-srv-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export async function makeServer(extra: Partial<ServerOptions> = {}) {
  const dataDir = tmpDir("af-data-");
  const app = await createServer({ dataDir, scan: fakeScan, defaultSourcesFile: join(dataDir, "none.json"), ...extra });
  return { app, dataDir };
}

export type RepoFiles = Record<string, string | Buffer>;

/** 로컬 git 저장소를 만들고 file:// 주소를 돌려준다 */
export function makeGitRepo(files: RepoFiles): { url: string; dir: string } {
  const dir = tmpDir("af-repo-");
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...a], { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return { url: pathToFileURL(dir).href, dir };
}

export interface FakeGithub {
  fetch: FetchLike;
  calls: { url: string; auth: string | undefined }[];
}

/** 가짜 GitHub REST. repoFiles 로 commits/trees/blobs 응답을 만든다. override 로 특정 요청을 대체 */
export function fakeGithub(
  repos: Record<string, { sha: string; files: RepoFiles }>,
  override?: (url: string) => { status: number } | undefined,
): FakeGithub {
  const calls: FakeGithub["calls"] = [];
  const fetchFn: FetchLike = async (url, init) => {
    calls.push({ url, auth: init?.headers?.["Authorization"] ?? init?.headers?.["authorization"] });
    const o = override?.(url);
    if (o) return { ok: false, status: o.status, json: async () => ({ message: "SECRET-BODY" }) };
    const m = /\/repos\/([^/]+\/[^/]+)\/(commits|git\/trees|git\/blobs)\/([^?]+)/.exec(url);
    const repo = m && repos[m[1]!];
    if (!m || !repo) return { ok: false, status: 404, json: async () => ({}) };
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (m[2] === "commits") return ok({ sha: repo.sha });
    const entries = Object.entries(repo.files);
    if (m[2] === "git/trees") {
      return ok({
        sha: repo.sha,
        truncated: false,
        tree: entries.map(([path, c]) => ({ path, type: "blob", mode: "100644", sha: `blob:${path}`, size: Buffer.byteLength(c) })),
      });
    }
    const hit = entries.find(([p]) => `blob:${p}` === decodeURIComponent(m[3]!));
    if (!hit) return { ok: false, status: 404, json: async () => ({}) };
    return ok({ encoding: "base64", content: Buffer.from(hit[1]).toString("base64") });
  };
  return { fetch: fetchFn, calls };
}

export const SKILL_MD = (name: string, desc: string) => `---\nname: ${name}\ndescription: ${desc}\n---\n\n# ${name}\n`;
