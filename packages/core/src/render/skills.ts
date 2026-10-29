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

export function renderImportedSkill(m: ImportedSkillT, lang: Lang = "ko"): string {
  const t = text(lang);
  return `---\nname: ${m.id}\ndescription: ${m.desc}\n---\n# ${m.id}\n\n${t.importedBody(m.src, t.trust[m.trust])}`;
}
