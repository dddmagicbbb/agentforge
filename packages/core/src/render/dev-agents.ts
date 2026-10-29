import type { DevT } from "../schema/index.js";
import { assertFilled, fillAll, fillFirst } from "../util/tpl.js";
import { devSkill, fmModel, type RenderContext } from "./context.js";
import { text, type Lang } from "./text.js";
import { dropSkillLine, mdTpl, skillList } from "./tpl-source.js";

// 개발자별 에이전트·짝 검증자·범위 파일·전용 스킬(DEV-01·02, SKL-02). ready 가 아닌 dev 는 만들지 않는다.

export function renderDevAgent(c: RenderContext, d: DevT, n: number): string {
  const N = String(n);
  let s = mdTpl("dev.tpl.md", c.p.language);
  s = dropSkillLine(s, "tdd", c.p.skills.tdd);
  s = dropSkillLine(s, "conventions", c.p.skills.conventions);
  s = fillAll(s, "N", N);
  s = fillAll(s, "DOMAIN", d.domain);
  s = fillAll(s, "PATHS_INLINE", d.paths.join(", "));
  s = fillFirst(s, "MODEL", fmModel(d.dev));
  s = fillFirst(s, "SKILLS", skillList([devSkill(d, n), ...c.importedFor("dev")]));
  s = fillFirst(s, "FEATURES", text(c.p.language).features(N));
  s = fillAll(s, "UI_READ", c.p.uiDesign ? ", docs/design/ui/" : "");
  return assertFilled("md/dev.tpl.md", s);
}

export function renderReviewAgent(c: RenderContext, d: DevT, n: number): string {
  const N = String(n);
  let s = mdTpl("review.tpl.md", c.p.language);
  s = dropSkillLine(s, "conventions", c.p.skills.conventions);
  s = fillAll(s, "N", N);
  s = fillFirst(s, "MODEL", fmModel(d.review));
  s = fillFirst(s, "SKILLS", skillList([devSkill(d, n), ...c.importedFor("review")]));
  s = fillAll(s, "UI_READ", c.p.uiDesign ? text(c.p.language).uiReadReview : "");
  return assertFilled("md/review.tpl.md", s);
}

export function renderDevPaths(d: DevT, n: number, lang: Lang): string {
  return `${text(lang).pathsComment}\n${d.paths.join("\n")}\ndocs/design/detail/dev-${n}.md\ndocs/report-dev-${n}.md\n`;
}

export function renderReviewPaths(n: number): string {
  return `docs/review/dev-${n}.md\n`;
}

export function renderDevSkill(d: DevT, n: number, lang: Lang): string {
  let s = mdTpl("devskill.tpl.md", lang);
  s = fillAll(s, "SKILL", devSkill(d, n));
  s = fillAll(s, "N", String(n));
  s = fillAll(s, "DOMAIN", d.domain);
  return assertFilled("md/devskill.tpl.md", s);
}
