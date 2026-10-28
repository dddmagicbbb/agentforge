import { SEQ_AGENT_IDS, type DevT, type ProviderIdT, type SeqAgentIdT } from "@agentforge/core";

// 화면용 상수. core 가 PROVIDERS·CORE_SKILLS 를 공개하면 이 사본을 제거한다(report 참조).

export interface ProviderOption {
  readonly id: ProviderIdT;
  /** 추천 모델(datalist). 첫 값이 기본값(claude 제외) */
  readonly models: readonly string[];
}

/** core/providers 와 같은 순서·추천 모델 */
export const PROVIDER_OPTIONS: readonly ProviderOption[] = [
  { id: "claude", models: ["opus", "sonnet", "haiku"] },
  { id: "openrouter", models: ["qwen/qwen3-coder:free", "minimax/minimax-m3.1-flash:free", "poolside/laguna-s-2.1:free"] },
  { id: "ollama", models: ["qwen3.5:9b", "gemma4:12b"] },
  { id: "vllm", models: ["exaone-32b"] },
  { id: "openai", models: ["gpt-5.5"] },
  { id: "gemini", models: ["gemini-2.5-pro"] },
];

export function modelsOf(p: ProviderIdT): readonly string[] {
  return PROVIDER_OPTIONS.find((o) => o.id === p)?.models ?? [];
}

/** 제공자 변경 시 모델 기본값: claude 는 sonnet, 그 외는 추천 첫 값(PoC 동작) */
export function defaultModel(p: ProviderIdT): string {
  return p === "claude" ? "sonnet" : (modelsOf(p)[0] ?? "");
}

/** 순차 단계 6종(마지막은 통합 검증). 문자열은 routine.seq.<id>.* */
export const ROUTINE_IDS: readonly SeqAgentIdT[] = SEQ_AGENT_IDS;
export const OPTIONAL_AGENT: SeqAgentIdT = "ux-designer";
export const FINAL_AGENT: SeqAgentIdT = "integrator";

export type CoreSkillId = "conventions" | "tdd" | "detail-design" | "code-review" | "forge-init" | "forge-agents";
export type SkillLayer = "common" | "role" | "gen";

export interface CoreSkillDef {
  readonly id: CoreSkillId;
  readonly layer: SkillLayer;
  /** 고정 스킬은 끌 수 없다 */
  readonly fixed: boolean;
}

export const CORE_SKILLS: readonly CoreSkillDef[] = [
  { id: "conventions", layer: "common", fixed: false },
  { id: "tdd", layer: "common", fixed: false },
  { id: "detail-design", layer: "role", fixed: true },
  { id: "code-review", layer: "role", fixed: true },
  { id: "forge-init", layer: "gen", fixed: true },
  { id: "forge-agents", layer: "gen", fixed: true },
];

/** 개발자 전용 스킬 이름: core 렌더러와 같은 규칙 */
export function devSkillName(d: Pick<DevT, "domain">, n: number): string {
  return `dev${n}-${d.domain}`;
}
