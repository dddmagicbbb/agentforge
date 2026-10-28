import { fillFirst } from "../util/tpl.js";
import type { RenderContext } from "./context.js";
import { tpl } from "./tpl-source.js";

// 고정 문자열·원문 복사 파일(.gitignore, requirements.md, .agentforge/templates/*, 정적 스크립트)

export const GITIGNORE = ".agentforge/env.local\n.agentforge/signals/\n.agentforge/panes/\n.agentforge/history/\n.claude/settings.local.json\nnode_modules/\n";

/** 그대로 복사하는 정적 스크립트(문자열 조립 금지 — project-rules) */
export const STATIC_SCRIPTS = ["setup.sh", "run-role.sh", "check-forge.sh", "create-worktrees.sh", "run-agents.sh", "wait-and-review.sh", "integrate.sh"] as const;

export function renderRequirements(c: RenderContext): string {
  return `# 요구사항 (원문)\n\n${c.p.requirement.trim()}\n`;
}

/** PRD 양식(DOC-02). {{NAME}}·{{UI_NOTE}} 만 앱이 채우고 나머지는 /forge-init 이 채운다. */
export function renderPrdTemplate(c: RenderContext): string {
  const uiNote = c.p.uiDesign
    ? "- 화면 목록은 UI/UX 설계 단계(docs/design/ui/screens.md)에서 확정한다. 여기에는 화면이 필요한 기능만 적는다."
    : "해당 없음 (UI/UX 설계 단계를 쓰지 않는 프로젝트)";
  return fillFirst(fillFirst(tpl("md/prd.tpl.md"), "NAME", c.slug), "UI_NOTE", uiNote);
}

export function staticScript(name: string): string {
  return tpl(`static/${name}`);
}
