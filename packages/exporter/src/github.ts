import { Octokit } from "@octokit/core";
import { AppError, planGithubTree, type GithubTargetT, type RenderedFile } from "@agentforge/core";

export interface PushResult {
  readonly url: string;
  readonly commitSha: string;
  readonly prUrl?: string;
}

export interface PushOptions {
  /** 시험·프록시용 fetch 주입. 없으면 전역 fetch */
  readonly fetch?: typeof fetch;
  /** 커밋 메시지 언어 */
  readonly language: "ko" | "en";
  /** 재시도 대기 주입(시험용). 없으면 setTimeout */
  readonly sleep?: (ms: number) => Promise<void>;
}

// 브랜치 이름의 `/` 가 %2F 로 인코딩되지 않도록 세그먼트별 자리표시로 푼다
function refRoute(method: string, prefix: string, branch: string): { route: string; params: Record<string, string> } {
  const parts = branch.split("/");
  const params: Record<string, string> = {};
  parts.forEach((p, i) => (params[`b${i}`] = p));
  return { route: `${method} /repos/{owner}/{repo}/git/${prefix}/heads/${parts.map((_, i) => `{b${i}}`).join("/")}`, params };
}

const noop = (): void => {};
const RETRY_MAX = 3;
const RETRY_MS = 1000;

const MESSAGES = { ko: "AgentForge 환경 생성", en: "Generate AgentForge environment" } as const;

/** 상태 코드 → AppError. 응답 본문·토큰은 쓰지 않는다. */
function mapError(e: unknown, networkFailed: boolean, onUnprocessable?: string): AppError {
  if (e instanceof AppError) return e;
  if (networkFailed) return new AppError("GITHUB_NETWORK");
  const err = e as { status?: unknown; message?: unknown; response?: { headers?: Record<string, string | number | undefined>; data?: { message?: unknown } } };
  const status = typeof err.status === "number" ? err.status : 0;
  const h = err.response?.headers ?? {};
  // 메시지는 분류에만 쓰고 밖으로 내보내지 않는다
  const text = `${typeof err.message === "string" ? err.message : ""} ${typeof err.response?.data?.message === "string" ? err.response.data.message : ""}`;
  const limited = status === 429 || (status === 403 && (String(h["x-ratelimit-remaining"]) === "0" || h["retry-after"] !== undefined || /secondary rate limit/i.test(text)));
  if (limited) return new AppError("GITHUB_RATE_LIMIT", { status });
  if (status === 401 || status === 403) return new AppError("GITHUB_AUTH", { status });
  if (status === 404) return new AppError("GITHUB_NOT_FOUND", { status });
  if (status === 422 && onUnprocessable) return new AppError(onUnprocessable, { status });
  return new AppError("GITHUB_FAILED", { status });
}

/**
 * GitHub·GHES 로 내보낸다(EXP-02). 토큰은 Authorization 헤더로만 쓰고 저장·기록하지 않는다.
 * create: 부모 없는 커밋 1건으로 기본 브랜치를 교체, pr: 새 브랜치 + PR.
 */
export async function pushToGithub(files: readonly RenderedFile[], target: GithubTargetT, token: string, opts: PushOptions): Promise<PushResult> {
  const items = planGithubTree(files); // 요청 전에 검사한다(core 규칙: mode 기준, env.local 차단)
  let networkFailed = false;
  const baseFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  // 네트워크 예외(응답 없음)는 octokit 이 500 으로 감싸므로 따로 표시한다
  const wrapped = (async (...args: Parameters<typeof fetch>) => {
    try {
      return await baseFetch(...args);
    } catch (e) {
      networkFailed = true;
      throw e;
    }
  }) as typeof fetch;
  const kit = new Octokit({ auth: token, baseUrl: target.baseUrl ?? "https://api.github.com", request: { fetch: wrapped }, log: { debug: noop, info: noop, warn: noop, error: noop } });
  const { owner, repo } = target;
  const message = MESSAGES[opts.language];
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  // 단계별 오류 매핑: 422 의 의미는 호출하는 단계가 정한다
  const step = async <T>(fn: () => Promise<T>, onUnprocessable?: string): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      throw mapError(e, networkFailed, onUnprocessable);
    }
  };

  // blob 을 따로 만들지 않고 tree 항목에 content 를 넣는다(2차 rate limit 회피)
  const makeTree = async (baseTree?: string): Promise<string> => {
    const tree = items.map((it) => ({ path: it.path, mode: it.mode, type: "blob" as const, content: it.content }));
    const t = await kit.request("POST /repos/{owner}/{repo}/git/trees", { owner, repo, tree, ...(baseTree ? { base_tree: baseTree } : {}) });
    return t.data.sha;
  };

  if ((target.mode ?? "create") === "create") {
    const me = await step(() => kit.request("GET /user"));
    const priv = target.visibility === "private";
    const created =
      me.data.login.toLowerCase() === owner.toLowerCase()
        ? await step(() => kit.request("POST /user/repos", { name: repo, private: priv, auto_init: true }), "GITHUB_REPO_EXISTS")
        : await step(() => kit.request("POST /orgs/{org}/repos", { org: owner, name: repo, private: priv, auto_init: true }), "GITHUB_REPO_EXISTS");
    const branch = created.data.default_branch ?? "main";
    const repoUrl = created.data.html_url;
    // 저장소가 이미 만들어졌으므로 이후 실패는 부분 실패다. auto_init 직후 409·404 는 재시도한다.
    const after = async <T>(fn: () => Promise<T>): Promise<T> => {
      for (let i = 0; ; i++) {
        try {
          return await fn();
        } catch (e) {
          const st = (e as { status?: unknown }).status;
          if (!networkFailed && (st === 409 || st === 404) && i < RETRY_MAX) {
            await sleep(RETRY_MS);
            continue;
          }
          throw new AppError("GITHUB_PARTIAL", { stage: "commit", url: repoUrl });
        }
      }
    };
    const treeSha = await after(() => makeTree());
    const commit = await after(() => kit.request("POST /repos/{owner}/{repo}/git/commits", { owner, repo, message, tree: treeSha, parents: [] }));
    const upd = refRoute("PATCH", "refs", branch);
    await after(() => kit.request(upd.route, { owner, repo, ...upd.params, sha: commit.data.sha, force: true }));
    return { url: repoUrl, commitSha: commit.data.sha };
  }

  const info = await step(() => kit.request("GET /repos/{owner}/{repo}", { owner, repo }));
  const base = info.data.default_branch;
  const get = refRoute("GET", "ref", base);
  const ref = await step(() => kit.request(get.route, { owner, repo, ...get.params }));
  const baseSha = ref.data.object.sha;
  const baseCommit = await step(() => kit.request("GET /repos/{owner}/{repo}/git/commits/{commit_sha}", { owner, repo, commit_sha: baseSha }));
  const treeSha = await step(() => makeTree(baseCommit.data.tree.sha));
  const commit = await step(() => kit.request("POST /repos/{owner}/{repo}/git/commits", { owner, repo, message, tree: treeSha, parents: [baseSha] }));
  const branch = target.branch ?? "agentforge/setup";
  await step(() => kit.request("POST /repos/{owner}/{repo}/git/refs", { owner, repo, ref: `refs/heads/${branch}`, sha: commit.data.sha }), "GITHUB_BRANCH_EXISTS");
  // 브랜치가 만들어진 뒤의 PR 실패는 부분 실패다
  const pr = await step(() => kit.request("POST /repos/{owner}/{repo}/pulls", { owner, repo, title: message, head: branch, base })).catch(() => {
    throw new AppError("GITHUB_PARTIAL", { stage: "pr", url: `${info.data.html_url}/tree/${branch}` });
  });
  return { url: info.data.html_url, commitSha: commit.data.sha, prUrl: pr.data.html_url };
}
