import type { Issue } from "@agentforge/core";
import type { StepIndex } from "./components/StepNav";

/**
 * Issue.path 첫 요소 → 원인을 고칠 수 있는 단계(0 기준).
 * 요구사항(0) · 루틴 agents(1) · 개발자 devs(2) · 스킬 skills/imported(3) · 연결 connections·tmux·devcontainer(4).
 * 알 수 없는 경로는 입력의 시작인 1단계로 보낸다.
 */
export function stepOfPath(path: readonly (string | number)[]): StepIndex {
  switch (String(path[0])) {
    case "agents":
      return 1;
    case "devs":
      return 2;
    case "skills":
    case "imported":
      return 3;
    case "connections":
    case "tmux":
    case "devcontainer":
      return 4;
    case "existingClaudeMd":
      return 5;
    default:
      return 0;
  }
}

/** 오류(error) 수준 항목이 있는 단계 집합 */
export function errorSteps(issues: readonly Issue[]): ReadonlySet<StepIndex> {
  return new Set(issues.filter((i) => i.level === "error").map((i) => stepOfPath(i.path)));
}

/** path 가 비어 있어도 원인을 고칠 단계가 정해진 코드 → 5단계(연결·실행, 0 기준 4) */
const CODE_STEP: Readonly<Record<string, StepIndex>> = {
  OPENROUTER_FREE_LIMIT: 4,
  GATEWAY_REQUIRED: 4,
  VLLM_TOOL_PARSER: 4,
};

/** "해당 단계로 이동" 버튼 대상. 없으면 undefined(path 있는 error·warn 이거나 code 매핑이 있는 항목만 버튼) */
export function gotoStepOf(i: Issue): StepIndex | undefined {
  if (i.path.length > 0) return i.level === "error" || i.level === "warn" ? stepOfPath(i.path) : undefined;
  return CODE_STEP[i.code];
}
