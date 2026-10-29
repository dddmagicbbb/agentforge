// git 수집: 시스템 git 을 execFile 인자 배열로 실행(셸 금지). 임시 폴더에 얕은 clone 후 호출자가 cleanup 한다.
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { ServerError, type Collected, type RawEntry, type SourceRecord } from "./types.js";

const run = promisify(execFile);

export interface GitDeps {
  gitBin: string;
  env: Readonly<Record<string, string | undefined>>;
  timeoutMs: number;
}

/** git 에 넘길 환경: 필요한 변수만 복사하고 프롬프트·프로토콜을 제한한다. 토큰은 인자가 아니라 환경 변수로 넘긴다 */
function gitEnv(src: SourceRecord, deps: GitDeps): NodeJS.ProcessEnv {
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

async function walk(root: string, dir: string, out: RawEntry[]): Promise<void> {
  for (const d of await readdir(join(root, dir), { withFileTypes: true })) {
    if (d.name === ".git" || d.isSymbolicLink()) continue;
    const rel = dir === "" ? d.name : `${dir}/${d.name}`;
    if (d.isDirectory()) await walk(root, rel, out);
    else if (d.isFile()) {
      const full = join(root, rel);
      out.push({ path: rel, size: (await stat(full)).size, load: () => readFile(full) });
    }
  }
}

/** 반환된 cleanup 으로 임시 폴더를 지운다(성공·실패 모두 호출자가 finally 에서 부른다) */
export async function collectGit(src: SourceRecord, deps: GitDeps): Promise<{ collected: Collected; cleanup: () => Promise<void> }> {
  const tmp = await mkdtemp(join(tmpdir(), "af-market-"));
  const cleanup = () => rm(tmp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => undefined);
  try {
    const dir = join(tmp, "repo");
    const opts = { timeout: deps.timeoutMs, env: gitEnv(src, deps), maxBuffer: 1024 * 1024, windowsHide: true };
    const args = ["-c", "core.autocrlf=false", "clone", "--depth", "1", "--no-tags", ...(src.ref ? ["--branch", src.ref] : []), "--", src.url!, dir];
    try {
      await run(deps.gitBin, args, opts);
      const { stdout } = await run(deps.gitBin, ["-C", dir, "rev-parse", "HEAD"], opts);
      const sha = stdout.trim();
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "response" });
      const entries: RawEntry[] = [];
      await walk(dir, "", entries);
      return { collected: { sha, entries }, cleanup };
    } catch (e) {
      throw e instanceof ServerError ? e : toServerError(e);
    }
  } catch (e) {
    await cleanup();
    throw e;
  }
}
