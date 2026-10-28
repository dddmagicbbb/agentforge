import { useTranslation } from "react-i18next";
import type { Issue } from "@agentforge/core";

interface Props {
  readonly issues: readonly Issue[];
  /** 화면 일부에 해당하는 항목만 보일 때 */
  readonly filter?: (i: Issue) => boolean;
}

/** 검사 결과 목록(i18n `issue.<CODE>`, params 보간). 오류는 alert, 나머지는 status. */
export function IssueList({ issues, filter }: Props) {
  const { t } = useTranslation();
  const shown = filter ? issues.filter(filter) : issues;
  if (!shown.length) return null;
  const hasError = shown.some((i) => i.level === "error");
  return (
    <ul className="issues" role={hasError ? "alert" : "status"}>
      {shown.map((i, k) => {
        const path = i.path.join(".");
        const reason = String(i.params["reason"] ?? "");
        return (
          <li key={k} className={`lv-${i.level}`}>
            {t(`issue.${i.code}`, { defaultValue: t("issue.default", { code: i.code, path }), path, ...i.params, reason })}
          </li>
        );
      })}
    </ul>
  );
}

/** 경로 첫 요소가 keys 중 하나인 항목 */
export const atPath = (...keys: string[]) => (i: Issue) => keys.includes(String(i.path[0]));
