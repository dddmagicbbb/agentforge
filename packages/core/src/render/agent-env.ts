import { provider } from "../providers/index.js";
import { shWord } from "../util/sh.js";
import type { RenderContext } from "./context.js";
import { text } from "./text.js";
import { tpl } from "./tpl-source.js";

// scripts/agent-env.sh: 정적 head + 에이전트 이름별 case 블록(유일한 동적 스크립트, PRV-01)

export function renderAgentEnv(c: RenderContext): string {
  const line = (name: string, a: { provider: string; model: string }) => {
    const def = provider(a.provider as Parameters<typeof provider>[0]);
    const m = a.model || (def.id === "claude" ? "sonnet" : "MODEL_ID");
    return `  ${`${name})`.padEnd(14)} _af_use ${def.via} ${shWord(m)} ;;`;
  };
  return (
    tpl("static/agent-env.head") +
    `\ncase "\${1:?${text(c.p.language).agentEnvUsage}}" in\n` +
    c.allAgents().map(([n, a]) => line(n, a)).join("\n") +
    `\n  ${"*)".padEnd(14)} _af_use claude sonnet ;;\nesac\n`
  );
}
