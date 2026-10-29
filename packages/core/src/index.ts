export * from "./schema/index.js";
export * from "./api.js";
export { scanSkillRisk, type RiskCode } from "./market/risk.js";
export { AppError, type AppErrorParams } from "./errors.js";
// 화면(web)이 PoC 사본 대신 쓰는 파생 규칙·표시 데이터.
// 주의: label, IMPORT_TARGET_LABEL, CORE_SKILLS.layer·to 는 생성물(CLAUDE.md) 문구다 — 화면 표시에 쓰지 말 것.
// 화면 문구는 CORE_SKILLS.group, seqI18nKey 등 언어 중립 id 로 web i18n 사전에서 찾는다.
export { PROVIDERS, provider, type ProviderDef, type Via } from "./providers/index.js";
export {
  CORE_SKILLS,
  devSkill,
  FINAL,
  fmModel,
  IMPORT_TARGET_LABEL,
  label,
  SEQ,
  seqI18nKey,
  type CoreSkill,
  type SeqStep,
} from "./render/context.js";
export { TEMPLATES, type TemplateKey } from "./templates.generated.js";
