// 시험 보조: 가짜 GitHub fetch, 임시 git 저장소, 임시 dataDir
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

// 시험이 만든 임시 폴더는 파일 단위로 afterAll(setup.ts)에서 삭제한다
const created: string[] = [];
export function tmpDir(prefix = "af-srv-"): string {
  const d = mkdtempSync(join(tmpdir(), prefix));
  created.push(d);
  return d;
}
export function cleanupTmp(): void {
  for (const d of created.splice(0)) rmSync(d, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

export async function makeServer(extra: Partial<ServerOptions> = {}) {
  const dataDir = tmpDir("af-data-");
  // 관리 API 는 기본 켬(시험 편의). 끄는 시험은 env 로 AF_MARKET_ADMIN 을 덮어쓴다
  const env = { AF_MARKET_ADMIN: "1", ...extra.env };
  const app = await createServer({ dataDir, scan: fakeScan, defaultSourcesFile: join(dataDir, "none.json"), ...extra, env });
  return { app, dataDir };
}

export type RepoFiles = Record<string, string | Buffer>;

/** 로컬 git 저장소를 만들고 file:// 주소를 돌려준다 */
export function makeGitRepo(files: RepoFiles, symlinks: Record<string, string> = {}): { url: string; dir: string } {
  const dir = tmpDir("af-repo-");
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.com", "-c", "commit.gpgsign=false", ...a], { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), c);
  }
  git("add", "-A");
  // 심볼릭 링크(mode 120000)는 OS 와 무관하게 인덱스에 직접 넣는다
  for (const [p, target] of Object.entries(symlinks)) {
    const blob = execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: dir, input: target }).toString().trim();
    git("update-index", "--add", "--cacheinfo", `120000,${blob},${p}`);
  }
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
