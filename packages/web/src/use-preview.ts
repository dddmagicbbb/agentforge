import { useMemo } from "react";
import { render, validate, type Issue, type ProjectInput, type RenderedFile } from "@agentforge/core";

export interface Preview {
  readonly issues: readonly Issue[];
  readonly files: readonly RenderedFile[];
}

/** 입력 → 검증 → 렌더. 오류가 있으면 파일은 비운다. */
export function buildPreview(draft: ProjectInput): Preview {
  const v = validate(draft);
  return { issues: v.issues, files: v.project ? render(v.project) : [] };
}

export function usePreview(draft: ProjectInput): Preview {
  return useMemo(() => buildPreview(draft), [draft]);
}
