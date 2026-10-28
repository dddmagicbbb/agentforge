import type { ProviderDef } from "./types.js";

// Anthropic 호환 API 직접 연결(https://openrouter.ai/api)
export const openrouter: ProviderDef = {
  id: "openrouter", label: "OpenRouter", via: "openrouter",
  models: ["qwen/qwen3-coder:free", "minimax/minimax-m3.1-flash:free", "poolside/laguna-s-2.1:free"],
};
