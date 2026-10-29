import { AppError, type ProjectInput, type RenderedFile } from "@agentforge/core";

export type GithubTargetInput = NonNullable<NonNullable<ProjectInput["export"]>["github"]>;
export interface PushResult { readonly url: string; readonly commitSha: string; readonly prUrl?: string }
/** exporter 계약(design 9.5) pushToGithub 와 같은 모양. 시험에서는 주입한다. */
export type PushFn = (files: readonly RenderedFile[], target: GithubTargetInput, token: string, opt: { language: "ko" | "en" }) => Promise<PushResult>;

/** exporter 는 내보낼 때만 불러온다. 아직 노출되지 않았으면 GITHUB_FAILED(리드 통합 때 경로 확정) */
export const defaultPush: PushFn = async (files, target, token, opt) => {
  const m = (await import("@agentforge/exporter")) as unknown as { pushToGithub?: (...a: Parameters<PushFn>) => ReturnType<PushFn> };
  if (typeof m.pushToGithub !== "function") throw new AppError("GITHUB_FAILED", {});
  return m.pushToGithub(files, target, token, opt);
};

export const GITHUB_ERROR_CODES = ["GITHUB_AUTH", "GITHUB_NOT_FOUND", "GITHUB_REPO_EXISTS", "GITHUB_BRANCH_EXISTS", "GITHUB_RATE_LIMIT", "GITHUB_NETWORK", "GITHUB_FAILED", "EXPORT_SECRET_PATH"] as const;

/** 알려진 코드만 통과, 나머지는 GITHUB_FAILED (원문·토큰이 화면에 나가지 않게) */
export function errorCodeOf(e: unknown): (typeof GITHUB_ERROR_CODES)[number] {
  const c = typeof e === "object" && e !== null && "code" in e ? (e as { code: unknown }).code : undefined;
  return (GITHUB_ERROR_CODES as readonly unknown[]).includes(c) ? (c as (typeof GITHUB_ERROR_CODES)[number]) : "GITHUB_FAILED";
}
