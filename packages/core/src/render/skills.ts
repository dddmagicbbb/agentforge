import type { ImportedSkillT } from "../schema/index.js";
import { assertFilled, fillFirst } from "../util/tpl.js";
import type { CoreSkill, RenderContext } from "./context.js";
import { text, type Lang } from "./text.js";
import { mdTpl } from "./tpl-source.js";

// 내장 스킬(SKL-01)과 가져온 스킬 자리(MKT, P1). language: en 이면 templates/md-en/ 본문(I18N-01).

export function renderCoreSkill(c: RenderContext, id: CoreSkill["id"]): string {
  let s = mdTpl(`${id}.md`, c.p.language);
  if (id === "conventions") s = fillFirst(s, "LANG", text(c.p.language).langName);
  // forge-agents 본문의 {{N}} 등은 사용자 AI 가 채우는 지시문이므로 검사하지 않는다(ADR-0002)
  return id === "forge-agents" ? s : assertFilled(`md/${id}.md`, s);
}

export function renderImportedSkill(m: ImportedSkillT, lang: Lang): string {
  const t = text(lang);
  return `---\nname: ${m.id}\ndescription: ${m.desc}\n---\n# ${m.id}\n\n${t.importedBody(m.src, t.trust[m.trust])}`;
}

/** 가져온 스킬의 출력 파일 목록. files 가 있으면 원문 그대로(SKILL.md 먼저, 나머지 사전순), 없으면 안내 SKILL.md 하나. */
export function importedSkillFiles(m: ImportedSkillT, lang: Lang): { path: string; content: string }[] {
  if (!m.files) return [{ path: `.claude/skills/${m.id}/SKILL.md`, content: renderImportedSkill(m, lang) }];
  const rank = (p: string) => (p === "SKILL.md" ? 0 : 1);
  return [...m.files]
    .sort((a, b) => rank(a.path) - rank(b.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((f) => ({ path: `.claude/skills/${m.id}/${f.path}`, content: f.content }));
}
