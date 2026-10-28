import { AppError } from "../errors.js";
import { TEMPLATES } from "../templates.generated.js";

/** 내장 템플릿 원문(templates/ 상대 경로) */
export function tpl(key: string): string {
  const t = (TEMPLATES as Readonly<Record<string, string>>)[key];
  if (t === undefined) throw new AppError("TPL_MISSING", { template: key });
  return t;
}

/** PoC 방식의 조건부 스킬 줄 제거(`  - tdd\n`) */
export function dropSkillLine(s: string, id: string, enabled: boolean): string {
  return enabled ? s : s.replace(`  - ${id}\n`, "");
}

export function skillList(ids: readonly string[]): string {
  return ids.map((x) => `  - ${x}\n`).join("");
}
