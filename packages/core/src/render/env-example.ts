import { shWord } from "../util/sh.js";
import type { RenderContext } from "./context.js";
import { text } from "./text.js";

// .agentforge/env.local.example: 키 이름만(값 없음). 주소 기본값은 bash 가 source 하므로 shWord 로 인용.

export function renderEnvExample(c: RenderContext): string {
  const L = [text(c.p.language).envHead];
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
  if (L.length === 1) L.push(text(c.p.language).envNone);
  return `${L.join("\n")}\n`;
}
