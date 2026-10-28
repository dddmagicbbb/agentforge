import { AppError, type GithubTargetT, type RenderedFile } from "@agentforge/core";

// RenderedFile[] 를 그대로 내보낸다. content·mode 를 바꾸지 않는다(ADR-0001).

/** ZIP 생성: root/<path>, unixPermissions = mode, platform UNIX. — T-307(기본), T-411(완성) */
export async function toZip(_files: readonly RenderedFile[], _root: string): Promise<Uint8Array> {
  throw new AppError("NOT_IMPLEMENTED", { api: "toZip", task: "T-307" });
}

export interface PushResult {
  readonly url: string;
  readonly commitSha: string;
}

/** GitHub·GHES 저장소 생성/PR. 토큰은 이 호출에서만 쓰고 저장하지 않는다. — EXP-02(P1) */
export async function pushToGitHub(_files: readonly RenderedFile[], _target: GithubTargetT, _token: string): Promise<PushResult> {
  throw new AppError("NOT_IMPLEMENTED", { api: "pushToGitHub", task: "EXP-02" });
}
