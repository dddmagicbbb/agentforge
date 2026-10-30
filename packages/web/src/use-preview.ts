import { useMemo } from "react";
import { FREE, toLicenseResult, type LicenseState } from "./license/license";
import { AppError, canExport, checks, mergeClaudeMd, render, validate, type Issue, type ProjectInput, type RenderedFile } from "@agentforge/core";

export interface Preview {
  /** validate 오류 + checks 경고를 합친 목록(중복 제거) */
  readonly issues: readonly Issue[];
  readonly files: readonly RenderedFile[];
  /** 오류(error)가 없을 때만 true — ZIP 활성 조건 */
  readonly exportable: boolean;
}

const keyOf = (i: Issue) => `${i.code}|${JSON.stringify(i.path)}|${JSON.stringify(Object.entries(i.params).sort())}`;

/** validate 와 checks 는 같은 위반(PATH_OVERLAP·MODEL_MISSING 등)을 함께 보고하므로 한 번만 남긴다. */
export function mergeIssues(validated: readonly Issue[], warned: readonly Issue[]): Issue[] {
  const nameInvalid = warned.some((i) => i.code === "NAME_INVALID");
  const seen = new Set<string>();
  const out: Issue[] = [];
  // checks 가 먼저(PoC 순서). 같은 이름 오류는 NAME_INVALID 로 대체한다
  for (const i of [...warned, ...validated]) {
    if (nameInvalid && i.code === "PROJECT_NAME") continue;
    const k = keyOf(i);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  // 오류·경고가 있으면 "문제 없음" 항목은 쓰지 않는다
  return out.some((i) => i.level === "error" || i.level === "warn") ? out.filter((i) => i.code !== "ALL_OK") : out;
}

/**
 * checks 호출 한 곳. TODO(통합): core 가 `checks(input, { license })` 를 지원하면 본문을
 * `return checks(draft, { license: toLicenseResult(license) });` 로 바꾸고 licenseIssues 를 지운다.
 */
function runChecks(draft: ProjectInput, license: LicenseState): Issue[] {
  return checks(draft, { license: toLicenseResult(license) });
}

/** 입력 → 검증 → 렌더. 오류가 있으면 파일은 비운다. 라이선스가 없으면 Free 기준(LIC-01). */
export function buildPreview(draft: ProjectInput, license: LicenseState = FREE): Preview {
  const v = validate(draft);
  const issues = mergeIssues(v.issues, runChecks(draft, license));
  return { issues, files: v.project ? render(v.project) : [], exportable: canExport(issues) };
}

export function usePreview(draft: ProjectInput, license: LicenseState = FREE): Preview {
  return useMemo(() => buildPreview(draft, license), [draft, license]);
}

/**
 * 기존 CLAUDE.md(DOC-03): 값이 있으면 생성된 CLAUDE.md 를 mergeClaudeMd(old, next) 결과로 바꾼다.
 * 비어 있으면 같은 배열을 돌려준다. 마커 오류는 error issue 로 바꾸고 파일은 원본 그대로 둔다.
 */
export function applyExistingClaudeMd(files: readonly RenderedFile[], oldMd: string): { files: readonly RenderedFile[]; issues: readonly Issue[] } {
  const target = files.find((f) => f.path === "CLAUDE.md");
  if (oldMd.trim() === "" || !target) return { files, issues: [] };
  try {
    const content = mergeClaudeMd(oldMd, target.content);
    return { files: files.map((f) => (f === target ? { ...f, content } : f)), issues: [] };
  } catch (e) {
    if (!(e instanceof AppError) || e.code !== "CLAUDE_MD_MARKERS") throw e;
    return { files, issues: [{ level: "error", code: e.code, path: ["existingClaudeMd"], params: { ...e.params } }] };
  }
}
