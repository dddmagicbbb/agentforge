import { shWord } from "../util/sh.js";
import type { RenderContext } from "./context.js";

// .agentforge/env.local.example: 키 이름만(값 없음). 주소 기본값은 bash 가 source 하므로 shWord 로 인용.

export function renderEnvExample(c: RenderContext): string {
  const L = ["# .agentforge/env.local 로 복사해 직접 입력 (git 제외, chmod 600). AgentForge는 값을 받거나 저장하지 않습니다."];
  const { connections } = c.p;
  if (c.usesVia("openrouter")) L.push("OPENROUTER_API_KEY=");
  if (c.usesVia("ollama")) L.push(`OLLAMA_URL=${shWord(connections.ollamaUrl)}`);
  if (c.usesVia("vllm")) L.push(`VLLM_URL=${connections.vllmUrl === "" ? "" : shWord(connections.vllmUrl)}`, "VLLM_TOKEN=");
  if (c.usesVia("litellm")) {
    L.push("LITELLM_URL=http://localhost:4000", "LITELLM_MASTER_KEY=");
    const all = c.allAgents();
    if (all.some(([, a]) => a.provider === "openai")) L.push("OPENAI_API_KEY=");
    if (all.some(([, a]) => a.provider === "gemini")) L.push("GEMINI_API_KEY=");
  }
  if (L.length === 1) L.push("# 모든 에이전트가 Claude 로그인을 사용합니다. 넣을 값이 없습니다.");
  return `${L.join("\n")}\n`;
}
