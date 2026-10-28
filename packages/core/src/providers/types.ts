import type { ProviderIdT } from "../schema/index.js";

/** 연결 방식. agent-env.sh 의 _af_use 첫 인자와 같다. */
export type Via = "claude" | "openrouter" | "ollama" | "vllm" | "litellm";

export interface ProviderDef {
  readonly id: ProviderIdT;
  /** 화면 표시 이름(PoC label) */
  readonly label: string;
  readonly via: Via;
  /** 추천 모델(화면 datalist). 정식 목록은 catalog/ 로 이관 예정 */
  readonly models: readonly string[];
  /** LiteLLM 경유 시 litellm.yaml·env.local 의 API 키 변수명 */
  readonly litellmKeyVar?: string;
}
