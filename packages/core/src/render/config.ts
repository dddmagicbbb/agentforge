import type { RenderContext } from "./context.js";

// .agentforge/forge.config.json: 스크립트(jq)가 읽는 실행 설정(REQ-02)

export function renderConfig(c: RenderContext): string {
  const { p } = c;
  const agents = Object.fromEntries(c.allAgents().map(([n, a]) => [n, { provider: a.provider, model: a.model }]));
  return `${JSON.stringify(
    {
      project: c.slug,
      developers: p.developerCount,
      uiDesign: p.uiDesign,
      language: p.language,
      tmuxLayout: "pair",
      commands: { install: p.commands.install, test: p.commands.test, e2e: p.commands.e2e },
      maxRejects: p.maxRejects,
      agents,
    },
    null,
    2,
  )}\n`;
}
