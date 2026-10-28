import type { ProviderDef } from "./types.js";

// OpenAI·Gemini 는 LiteLLM 게이트웨이를 거쳐 Anthropic 형식으로 중계한다.
export const openai: ProviderDef = { id: "openai", label: "OpenAI·LiteLLM", via: "litellm", models: ["gpt-5.5"], litellmKeyVar: "OPENAI_API_KEY" };
export const gemini: ProviderDef = { id: "gemini", label: "Gemini·LiteLLM", via: "litellm", models: ["gemini-2.5-pro"], litellmKeyVar: "GEMINI_API_KEY" };
