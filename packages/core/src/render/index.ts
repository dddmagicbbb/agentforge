import type { RenderedFile } from "../api.js";
import type { Project } from "../schema/index.js";
import { renderAgentEnv } from "./agent-env.js";
import { renderSeqAgent } from "./agents.js";
import { renderClaudeMd } from "./claude-md.js";
import { renderConfig } from "./config.js";
import { CORE_SKILLS, devSkill, FINAL, RenderContext } from "./context.js";
import { renderDevAgent, renderDevPaths, renderDevSkill, renderReviewAgent, renderReviewPaths } from "./dev-agents.js";
import { renderEnvExample } from "./env-example.js";
import { renderLitellm } from "./litellm.js";
import { renderReadme } from "./readme.js";
import { renderGitignore, renderPrdTemplate, renderRequirements, STATIC_SCRIPTS, staticScript } from "./scaffold.js";
import { renderSettings } from "./settings.js";
import { renderCoreSkill, renderImportedSkill } from "./skills.js";
import { tpl } from "./tpl-source.js";
import { renderVscodeTasks } from "./vscode.js";

/**
 * 생성 파일 전체(design.md 4장). 순서는 PoC buildFiles() 와 같다.
 * 같은 입력이면 같은 출력: 날짜·난수·환경을 읽지 않는다.
 */
export function renderProject(p: Project): RenderedFile[] {
  const c = new RenderContext(p);
  const F: RenderedFile[] = [];
  const add = (path: string, content: string, o: { exec?: boolean; ai?: boolean } = {}) =>
    F.push({ path, content, mode: o.exec ? 0o755 : 0o644, author: o.ai ? "ai-fill" : "template" });

  add("CLAUDE.md", renderClaudeMd(c), { ai: true });
  add("README.md", renderReadme(c));
  add(".gitignore", renderGitignore(p.tmux?.logs === true));
  add(".claude/settings.json", renderSettings(c));
  add(".claude/hooks/guard-paths.sh", staticScript("guard-paths.sh"), { exec: true });
  for (const s of c.seqActive()) add(`.claude/agents/${s.id}.md`, renderSeqAgent(c, s.id));
  add(`.claude/agents/${FINAL.id}.md`, renderSeqAgent(c, FINAL.id));
  for (const { d, n } of c.readyDevs()) {
    add(`.claude/agents/dev-${n}.md`, renderDevAgent(c, d, n), { ai: true });
    add(`.claude/agents/review-${n}.md`, renderReviewAgent(c, d, n), { ai: true });
    add(`.claude/devs/dev-${n}.paths`, renderDevPaths(d, n), { ai: true });
    add(`.claude/devs/review-${n}.paths`, renderReviewPaths(n));
    add(`.claude/skills/${devSkill(d, n)}/SKILL.md`, renderDevSkill(d, n), { ai: true });
  }
  for (const k of CORE_SKILLS) if (c.enabledSkill(k.id)) add(`.claude/skills/${k.id}/SKILL.md`, renderCoreSkill(c, k.id));
  for (const m of p.imported) add(`.claude/skills/${m.id}/SKILL.md`, renderImportedSkill(m));
  add(".agentforge/forge.config.json", renderConfig(c));
  add(".agentforge/requirements.md", renderRequirements(c));
  add(".agentforge/env.local.example", renderEnvExample(c));
  add(".agentforge/templates/prd.md", renderPrdTemplate(c));
  // /forge-agents 가 채우는 템플릿은 치환하지 않은 원문 그대로(ADR-0002)
  add(".agentforge/templates/dev.md", tpl("md/dev.tpl.md"));
  add(".agentforge/templates/review.md", tpl("md/review.tpl.md"));
  add(".agentforge/templates/dev-skill.md", tpl("md/devskill.tpl.md"));
  if (c.usesVia("litellm")) add(".agentforge/litellm.yaml", renderLitellm(c));
  add("scripts/setup.sh", staticScript("setup.sh"), { exec: true });
  add("scripts/agent-env.sh", renderAgentEnv(c), { exec: true });
  for (const name of STATIC_SCRIPTS.filter((s) => s !== "setup.sh")) add(`scripts/${name}`, staticScript(name), { exec: true });
  if (c.usesVia("litellm")) add("scripts/start-gateway.sh", staticScript("start-gateway.sh"), { exec: true });
  add(".vscode/tasks.json", renderVscodeTasks());
  const keep = ["docs/design/detail/.gitkeep", "docs/review/.gitkeep", "docs/report/.gitkeep", "docs/adr/.gitkeep"];
  for (const k of p.uiDesign ? [...keep, "docs/design/ui/.gitkeep"] : keep) add(k, "");
  return F;
}
