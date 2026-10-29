// git 수집: 시스템 git 을 execFile 인자 배열로 실행(셸 금지). 임시 폴더에 얕은 clone 후 호출자가 cleanup 한다.
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ServerError, type Collected, type RawEntry, type SourceRecord } from "./types.js";

const run = promisify(execFile);

export interface GitDeps {
  gitBin: string;
  env: Readonly<Record<string, string | undefined>>;
  timeoutMs: number;
  /** clone 임시 폴더를 만들 위치(기본 OS 임시 폴더) */
  workDir?: string;
}

/** git 에 넘길 환경: 필요한 변수만 복사하고 프롬프트·프로토콜을 제한한다. 토큰은 인자가 아니라 환경 변수로 넘긴다 */
export function gitEnv(src: SourceRecord, deps: GitDeps): NodeJS.ProcessEnv {
  const keep = ["PATH", "Path", "HOME", "USERPROFILE", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "TMPDIR", "LANG", "HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy", "GIT_SSL_CAINFO", "SSL_CERT_FILE"];
  const env: NodeJS.ProcessEnv = {};
  for (const k of keep) if (process.env[k] !== undefined) env[k] = process.env[k];
  const isFile = src.url?.startsWith("file://") === true;
  env["GIT_TERMINAL_PROMPT"] = "0";
  env["GIT_ALLOW_PROTOCOL"] = isFile ? "file" : "https";
  const token = src.tokenEnv ? deps.env[src.tokenEnv] : undefined;
  if (token && !isFile) {
    env["GIT_CONFIG_COUNT"] = "1";
    env["GIT_CONFIG_KEY_0"] = "http.extraHeader";
    env["GIT_CONFIG_VALUE_0"] = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
  }
  return env;
}

function toServerError(e: unknown): ServerError {
  const err = e as { code?: unknown; killed?: unknown };
  if (err.code === "ENOENT") return new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "gitMissing" });
  if (err.killed === true) return new ServerError("SOURCE_TIMEOUT", 504);
  return new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "git" });
}

/** git 이 추적하는 일반 파일 수 상한(거대한 저장소 방지) */
const MAX_TREE_ENTRIES = 20_000;

/** git ls-tree 로 일반 파일(100644·100755)만 모은다. 심볼릭 링크(120000)·서브모듈(160000)은 OS 와 무관하게 제외 */
async function listFiles(gitBin: string, dir: string, opts: object): Promise<RawEntry[]> {
  const { stdout } = await run(gitBin, ["-C", dir, "ls-tree", "-r", "-z", "HEAD"], { ...opts, maxBuffer: 64 * 1024 * 1024 });
  const entries: RawEntry[] = [];
  for (const line of stdout.split("\0")) {
    const m = /^(\d{6}) blob [0-9a-f]+\t([\s\S]+)$/.exec(line);
    if (!m || (m[1] !== "100644" && m[1] !== "100755")) continue;
    if (entries.length >= MAX_TREE_ENTRIES) throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "tooMany" });
    const rel = m[2]!;
    const full = join(dir, rel);
    // 인덱서가 경로를 검증하므로 여기서는 읽기 실패(부분 checkout 등)만 건너뛴다
    let size: number;
    try {
      size = (await stat(full)).size;
    } catch {
      continue;
    }
    entries.push({ path: rel, size, load: () => readFile(full) });
  }
  return entries;
}

/** git clone 인자. 주소 앞에 -- 를 두어 옵션으로 해석되지 않게 한다 */
export function cloneArgs(src: SourceRecord, dir: string): string[] {
  return ["-c", "core.autocrlf=false", "clone", "--depth", "1", "--no-tags", ...(src.ref ? ["--branch", src.ref] : []), "--", src.url!, dir];
}

/** 반환된 cleanup 으로 임시 폴더를 지운다(성공·실패 모두 호출자가 finally 에서 부른다) */
export async function collectGit(src: SourceRecord, deps: GitDeps): Promise<{ collected: Collected; cleanup: () => Promise<void> }> {
  if (src.tokenEnv && !src.url?.startsWith("https://")) throw new ServerError("SOURCE_INVALID", 400, { field: "url" });
  const tmp = await mkdtemp(join(deps.workDir ?? tmpdir(), "af-market-"));
  const cleanup = () => rm(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => undefined);
  try {
    const dir = join(tmp, "repo");
    const opts = { timeout: deps.timeoutMs, env: gitEnv(src, deps), maxBuffer: 1024 * 1024, windowsHide: true };
    try {
      await run(deps.gitBin, cloneArgs(src, dir), opts);
      const { stdout } = await run(deps.gitBin, ["-C", dir, "rev-parse", "HEAD"], opts);
      const sha = stdout.trim();
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "response" });
      const entries = await listFiles(deps.gitBin, dir, opts);
      return { collected: { sha, entries }, cleanup };
    } catch (e) {
      throw e instanceof ServerError ? e : toServerError(e);
    }
  } catch (e) {
    await cleanup();
    throw e;
  }
}
