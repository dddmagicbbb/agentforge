// github 수집: REST(commits -> git/trees?recursive=1 -> git/blobs). 토큰은 Authorization 헤더에만 쓴다.
import { Buffer } from "node:buffer";
import { ServerError, type Collected, type FetchLike, type RawEntry, type SourceRecord } from "./types.js";

export interface GithubDeps {
  fetch: FetchLike;
  env: Readonly<Record<string, string | undefined>>;
  timeoutMs: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export async function collectGithub(src: SourceRecord, deps: GithubDeps): Promise<Collected> {
  const base = (src.baseUrl ?? "https://api.github.com").replace(/\/+$/, "");
  // 토큰을 보내는 소스는 https 만(등록 시 검증하지만 손으로 고친 sources.json 에 대비해 다시 확인)
  if (src.tokenEnv && !base.startsWith("https://")) throw new ServerError("SOURCE_INVALID", 400, { field: "baseUrl" });
  const token = src.tokenEnv ? deps.env[src.tokenEnv] : undefined;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // 오류는 코드와 상태 번호만 남긴다(응답 본문·내부 메시지 금지)
  const api = async (path: string): Promise<Record<string, unknown>> => {
    let res;
    try {
      res = await deps.fetch(`${base}${path}`, { headers, signal: AbortSignal.timeout(deps.timeoutMs) });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "TimeoutError" || name === "AbortError") throw new ServerError("SOURCE_TIMEOUT", 504);
      throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "network" });
    }
    if (!res.ok) throw new ServerError("SOURCE_FETCH_FAILED", 502, { status: res.status });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "response" });
    }
    if (!isRecord(body)) throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "response" });
    return body;
  };

  const repo = `/repos/${src.owner}/${src.repo}`;
  const commit = await api(`${repo}/commits/${encodeURIComponent(src.ref ?? "HEAD")}`);
  const sha = commit["sha"];
  if (typeof sha !== "string" || !/^[0-9a-f]{40}$/.test(sha)) throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "response" });

  const tree = await api(`${repo}/git/trees/${sha}?recursive=1`);
  if (tree["truncated"] === true || !Array.isArray(tree["tree"])) throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: tree["truncated"] === true ? "truncated" : "response" });

  const entries: RawEntry[] = [];
  for (const t of tree["tree"] as unknown[]) {
    // 일반 파일만(심볼릭 링크 120000·서브모듈은 제외)
    if (!isRecord(t) || t["type"] !== "blob" || (t["mode"] !== "100644" && t["mode"] !== "100755")) continue;
    const { path, sha: blobSha, size } = t;
    if (typeof path !== "string" || typeof blobSha !== "string" || typeof size !== "number") continue;
    entries.push({
      path,
      size,
      load: async () => {
        const blob = await api(`${repo}/git/blobs/${encodeURIComponent(blobSha)}`);
        if (blob["encoding"] !== "base64" || typeof blob["content"] !== "string") throw new ServerError("SOURCE_FETCH_FAILED", 502, { reason: "response" });
        return Buffer.from(blob["content"], "base64");
      },
    });
  }
  return { sha, entries };
}
