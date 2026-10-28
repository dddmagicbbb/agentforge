import { useTranslation } from "react-i18next";
import type { Issue } from "@agentforge/core";
import { stepOfPath } from "../issue-step";
import { STEP_KEYS, type StepIndex } from "./StepNav";

interface Props {
  readonly issues: readonly Issue[];
  /** 화면 일부에 해당하는 항목만 보일 때 */
  readonly filter?: (i: Issue) => boolean;
  /** 지정하면 수준 아이콘(✓ ! ✕ i)과 "해당 단계로 이동" 버튼을 붙인다(6단계 전체 목록) */
  readonly onGoto?: (s: StepIndex) => void;
  readonly testId?: string;
}

const ICON = { ok: "✓", warn: "!", error: "✕", info: "i" } as const;

/** 검사 결과 목록(i18n `issue.<CODE>`, params 보간). 오류는 alert, 나머지는 status. */
export function IssueList({ issues, filter, onGoto, testId }: Props) {
  const { t } = useTranslation();
  const shown = filter ? issues.filter(filter) : issues;
  if (!shown.length) return null;
  const hasError = shown.some((i) => i.level === "error");
  return (
    <ul className="issues" role={hasError ? "alert" : "status"} data-testid={testId}>
      {shown.map((i, k) => {
        const path = i.path.join(".");
        const reason = String(i.params["reason"] ?? "");
        return (
          <li key={k} className={`lv-${i.level}`}>
            {onGoto ? <span className="i" aria-hidden="true">{ICON[i.level]} </span> : null}
            {t(`issue.${i.code}`, { defaultValue: t("issue.default", { code: i.code, path }), path, ...i.params, reason })}
            {onGoto && (i.level === "error" || i.level === "warn") && i.path.length > 0 ? (
              <button type="button" className="goto" onClick={() => onGoto(stepOfPath(i.path))}>
                {t("export.goto", { step: t(`steps.${STEP_KEYS[stepOfPath(i.path)]}`) })}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** 경로 첫 요소가 keys 중 하나인 항목 */
export const atPath = (...keys: string[]) => (i: Issue) => keys.includes(String(i.path[0]));
