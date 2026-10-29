const KNOWN = ["SCRIPTS", "BANG_COMMAND", "BROAD_TOOLS", "BYPASS_PERMISSIONS", "REMOTE_DOWNLOAD"];
/** 서버가 준 위험 코드는 알려진 5종만 i18n 키에 쓴다. 모르는 값은 원문 대신 일반 문구 */
export const riskText = (t: (k: string, o?: Record<string, unknown>) => string, c: string) =>
  KNOWN.includes(c) ? t(`risk.${c}`) : t("risk.UNKNOWN");
/** IMPORT_RISK 의 codes(쉼표 목록): 알려진 코드는 문구로, 모르는 값은 그대로 텍스트 */
export const riskList = (t: (k: string, o?: Record<string, unknown>) => string, codes: string) =>
  codes.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (KNOWN.includes(c) ? t(`risk.${c}`) : c)).join(", ");
