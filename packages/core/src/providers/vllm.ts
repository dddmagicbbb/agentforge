import type { ProviderDef } from "./types.js";

// 사내 vLLM(/v1/messages 지원 버전). 주소는 connections.vllmUrl
export const vllm: ProviderDef = { id: "vllm", label: "사내 vLLM", via: "vllm", models: ["exaone-32b"] };
