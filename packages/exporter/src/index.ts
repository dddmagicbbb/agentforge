import { AppError, type GithubTargetT, type RenderedFile } from "@agentforge/core";

export { toZip } from "./zip.js";

export interface PushResult {
  readonly url: string;
  readonly commitSha: string;
}

/** GitHub·GHES 저장소 생성/PR. 토큰은 이 호출에서만 쓰고 저장하지 않는다. — EXP-02(P1) */
export async function pushToGitHub(_files: readonly RenderedFile[], _target: GithubTargetT, _token: string): Promise<PushResult> {
  throw new AppError("NOT_IMPLEMENTED", { api: "pushToGitHub", task: "EXP-02" });
}
