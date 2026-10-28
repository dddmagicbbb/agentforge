import { useTranslation } from "react-i18next";
import type { Issue, ProjectInput } from "@agentforge/core";
import { countByProvider } from "../agents";
import { IssueList } from "../components/IssueList";
import { TmuxPreview } from "../components/TmuxPreview";
import { PROVIDER_OPTIONS } from "../catalog";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
}

const WARN_CODES = ["GATEWAY_REQUIRED", "VLLM_TOOL_PARSER", "OPENROUTER_FREE_LIMIT", "MODEL_MISSING"];

/** 5단계: 사용 제공자·주소, tmux 배치, 경고(PRV-01, PRV-04). 키는 입력받지 않는다. */
export function StepConnection({ draft, patch, issues }: Props) {
  const { t } = useTranslation();
  const counts = countByProvider(draft);
  const used = PROVIDER_OPTIONS.filter((p) => counts.has(p.id));
  const setConn = (k: keyof ProjectInput["connections"], v: string) => patch({ connections: { ...draft.connections, [k]: v } });
  const urlIssues = (k: string) => issues.filter((i) => i.path[0] === "connections" && i.path[1] === k);

  return (
    <>
      <h2>{t("conn.title")}</h2>
      <p className="lead">{t("conn.lead")}</p>
      <div className="tw">
        <table className="t" aria-label={t("conn.table")}>
          <thead>
            <tr><th>{t("conn.col.provider")}</th><th>{t("conn.col.count")}</th><th>{t("conn.col.connect")}</th></tr>
          </thead>
          <tbody>
            {used.map((p) => (
              <tr key={p.id} data-testid="prov-row">
                <td><b>{t(`provider.${p.id}`)}</b></td>
                <td className="mono">{counts.get(p.id)}</td>
                <td>
                  {p.id === "vllm" ? (
                    <>
                      <input aria-label={t("conn.vllmLabel")} value={draft.connections.vllmUrl} onChange={(e) => setConn("vllmUrl", e.target.value)} />
                      <IssueList issues={urlIssues("vllmUrl")} />
                    </>
                  ) : p.id === "ollama" ? (
                    <>
                      <input aria-label={t("conn.ollamaLabel")} value={draft.connections.ollamaUrl} onChange={(e) => setConn("ollamaUrl", e.target.value)} />
                      <IssueList issues={urlIssues("ollamaUrl")} />
                    </>
                  ) : p.id === "openrouter" ? (
                    t("conn.openrouter")
                  ) : p.id === "openai" || p.id === "gemini" ? (
                    t("conn.litellm")
                  ) : (
                    t("conn.claude")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>{t("tmux.title")}</h3>
      <TmuxPreview draft={draft} />
      <IssueList issues={issues} filter={(i) => WARN_CODES.includes(i.code)} />
      <p className="note">{t("conn.note")}</p>
    </>
  );
}
