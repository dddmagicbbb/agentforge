/** 서버가 준 위험 코드를 i18n 키에 넣기 전 형식 검사(영문·_ 만). 모르는 코드는 원문 대신 일반 문구 */
export const riskText = (t: (k: string, o?: Record<string, unknown>) => string, c: string) =>
  /^[A-Za-z_]+$/.test(c) ? t(`risk.${c}`, { defaultValue: c }) : t("risk.UNKNOWN");
