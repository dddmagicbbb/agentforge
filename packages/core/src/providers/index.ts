import type { ProviderIdT } from "../schema/index.js";
import { claude } from "./claude.js";
import { gemini, openai } from "./litellm.js";
import { ollama } from "./ollama.js";
import { openrouter } from "./openrouter.js";
import type { ProviderDef } from "./types.js";
import { vllm } from "./vllm.js";

export type { ProviderDef, Via } from "./types.js";

/** 화면 표시 순서(PoC PROVIDERS) */
export const PROVIDERS: readonly ProviderDef[] = [claude, openrouter, ollama, vllm, openai, gemini];

const BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

export function provider(id: ProviderIdT): ProviderDef {
  return BY_ID.get(id) ?? claude;
}
