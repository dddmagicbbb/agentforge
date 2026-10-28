import type { Issue } from "@agentforge/core";
import type { StepIndex } from "./components/StepNav";

/**
 * Issue.path 첫 요소 → 원인을 고칠 수 있는 단계(0 기준).
 * 요구사항(0) · 루틴 agents(1) · 개발자 devs(2) · 스킬 skills/imported(3) · 연결 connections(4).
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
      return 4;
    default:
      return 0;
  }
}

/** 오류(error) 수준 항목이 있는 단계 집합 */
export function errorSteps(issues: readonly Issue[]): ReadonlySet<StepIndex> {
  return new Set(issues.filter((i) => i.level === "error").map((i) => stepOfPath(i.path)));
}
