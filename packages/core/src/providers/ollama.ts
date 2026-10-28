import type { ProviderDef } from "./types.js";

// 로컬 Ollama(Anthropic 호환). 주소는 connections.ollamaUrl
export const ollama: ProviderDef = { id: "ollama", label: "Ollama 로컬", via: "ollama", models: ["qwen3.5:9b", "gemma4:12b"] };
