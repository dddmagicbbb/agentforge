import { provider } from "../providers/index.js";
import type { RenderContext } from "./context.js";
import { text } from "./text.js";

// .agentforge/litellm.yaml: OpenAI·Gemini → Anthropic 형식 중계(PRV-02). 모델 ID 는 스키마 패턴으로 YAML 안전.

export function renderLitellm(c: RenderContext): string {
  const seen = new Set<string>();
  let s = `${text(c.p.language).litellmHead}\nmodel_list:\n`;
  for (const [, a] of c.allAgents()) {
    const def = provider(a.provider);
    if (def.via !== "litellm") continue;
    const m = a.model || "MODEL_ID";
    if (seen.has(m)) continue;
    seen.add(m);
    s += `  - model_name: ${m}\n    litellm_params:\n      model: ${a.provider}/${m}\n      api_key: os.environ/${def.litellmKeyVar ?? "OPENAI_API_KEY"}\n`;
  }
  return `${s}general_settings:\n  master_key: os.environ/LITELLM_MASTER_KEY\n`;
}
