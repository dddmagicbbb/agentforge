import type { ImportedSkillT } from "../schema/index.js";
import { assertFilled, fillFirst } from "../util/tpl.js";
import { TRUST_LABEL, type CoreSkill, type RenderContext } from "./context.js";
import { tpl } from "./tpl-source.js";

// 내장 스킬(SKL-01)과 가져온 스킬 자리(MKT, P1)

export function renderCoreSkill(c: RenderContext, id: CoreSkill["id"]): string {
  let s = tpl(`md/${id}.md`);
  if (id === "conventions") s = fillFirst(s, "LANG", c.p.language === "ko" ? "한국어" : "영어");
  // forge-agents 본문의 {{N}} 등은 사용자 AI 가 채우는 지시문이므로 검사하지 않는다(ADR-0002)
  return id === "forge-agents" ? s : assertFilled(`md/${id}.md`, s);
}

export function renderImportedSkill(m: ImportedSkillT): string {
  return `---\nname: ${m.id}\ndescription: ${m.desc}\n---\n# ${m.id}\n\n출처: ${m.src} (${TRUST_LABEL[m.trust]})\nPoC 자리표시입니다. 정식 버전은 가져오기 시 출처 저장소의 SKILL.md 원문과 하위 파일을 그대로 넣습니다.\n`;
}
