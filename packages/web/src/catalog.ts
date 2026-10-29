import { FINAL, PROVIDERS, SEQ, provider, type ProviderIdT, type SeqAgentIdT } from "@agentforge/core";

// 화면용 파생 값. 제공자·순차 단계·내장 스킬 원본은 모두 core export 에서 읽는다(사본 금지).
// core 의 label·layer·to·IMPORT_TARGET_LABEL 은 생성물 문구이므로 화면에 쓰지 않고 i18n 키를 쓴다.

/** 제공자 표시 순서(core PROVIDERS) */
export const PROVIDER_IDS: readonly ProviderIdT[] = PROVIDERS.map((p) => p.id);

export function modelsOf(p: ProviderIdT): readonly string[] {
  return provider(p).models;
}

/** 제공자 변경 시 모델 기본값: claude 는 sonnet, 그 외는 추천 첫 값(PoC 동작) */
export function defaultModel(p: ProviderIdT): string {
  return p === "claude" ? "sonnet" : (modelsOf(p)[0] ?? "");
}

/** 순차 단계 6종(마지막은 통합 검증). 문자열은 routine.seq.<id>.* */
export const ROUTINE_IDS: readonly SeqAgentIdT[] = [...SEQ.map((s) => s.id), FINAL.id];
export const OPTIONAL_AGENT: SeqAgentIdT = SEQ.find((s) => s.optional)?.id ?? "ux-designer";
export const FINAL_AGENT: SeqAgentIdT = FINAL.id;
