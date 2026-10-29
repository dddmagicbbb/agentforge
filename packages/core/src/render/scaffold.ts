import { fillFirst } from "../util/tpl.js";
import type { RenderContext } from "./context.js";
import { text } from "./text.js";
import { mdTpl, tpl } from "./tpl-source.js";

// 고정 문자열·원문 복사 파일(.gitignore, requirements.md, .agentforge/templates/*, 정적 스크립트)

export const GITIGNORE = ".agentforge/env.local\n.agentforge/signals/\n.agentforge/panes/\n.agentforge/history/\n.claude/settings.local.json\nnode_modules/\n";

/** tmux logs 지정 시(RUN-04)에만 로그 폴더를 무시 목록에 추가한다. 기본값이면 GITIGNORE 와 같다. */
export function renderGitignore(logs: boolean): string {
  return logs ? GITIGNORE.replace(".agentforge/panes/\n", ".agentforge/panes/\n.agentforge/logs/\n") : GITIGNORE;
}

/** 그대로 복사하는 정적 스크립트(문자열 조립 금지 — project-rules) */
export const STATIC_SCRIPTS = ["setup.sh", "run-role.sh", "check-forge.sh", "create-worktrees.sh", "run-agents.sh", "wait-and-review.sh", "integrate.sh", "check-models.sh"] as const;

export function renderRequirements(c: RenderContext): string {
  return `# 요구사항 (원문)\n\n${c.p.requirement.trim()}\n`;
}

/** PRD 양식(DOC-02). {{NAME}}·{{UI_NOTE}} 만 앱이 채우고 나머지는 /forge-init 이 채운다. */
export function renderPrdTemplate(c: RenderContext): string {
  const uiNote = c.p.uiDesign
    ? text(c.p.language).prdUi
    : text(c.p.language).prdNoUi;
  return fillFirst(fillFirst(mdTpl("prd.tpl.md", c.p.language), "NAME", c.slug), "UI_NOTE", uiNote);
}

export function staticScript(name: string): string {
  return tpl(`static/${name}`);
}
