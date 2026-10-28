import { useTranslation } from "react-i18next";
import type { Issue } from "@agentforge/core";

export function IssueList({ issues }: { issues: readonly Issue[] }) {
  const { t } = useTranslation();
  if (!issues.length) return null;
  return (
    <ul className="issues" role="alert">
      {issues.map((i, k) => {
        const path = i.path.join(".");
        const reason = String(i.params["reason"] ?? "");
        return <li key={k}>{t(`issue.${i.code}`, { defaultValue: t("issue.default", { code: i.code, path }), path, ...i.params, reason })}</li>;
      })}
    </ul>
  );
}
