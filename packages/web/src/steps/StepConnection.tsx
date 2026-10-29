import { useTranslation } from "react-i18next";
import { provider, type Issue, type ProjectInput } from "@agentforge/core";
import { countByProvider } from "../agents";
import { IssueList } from "../components/IssueList";
import { TmuxSettings } from "../components/TmuxSettings";
import { TmuxPreview } from "../components/TmuxPreview";
import { PROVIDER_IDS } from "../catalog";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
}

const WARN_CODES = ["GATEWAY_REQUIRED", "VLLM_TOOL_PARSER", "OPENROUTER_FREE_LIMIT", "MODEL_MISSING", "DEVCONTAINER_CLOSED_NET"];

/** 5단계: 사용 제공자·주소, tmux 배치, 경고(PRV-01, PRV-04). 키는 입력받지 않는다. */
export function StepConnection({ draft, patch, issues }: Props) {
  const { t } = useTranslation();
  const counts = countByProvider(draft);
  const used = PROVIDER_IDS.filter((id) => counts.has(id)).map((id) => ({ id }));
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
                  {provider(p.id).via === "vllm" ? (
                    <>
                      <input aria-label={t("conn.vllmLabel")} value={draft.connections.vllmUrl} onChange={(e) => setConn("vllmUrl", e.target.value)} />
                      <IssueList issues={urlIssues("vllmUrl")} />
                    </>
                  ) : provider(p.id).via === "ollama" ? (
                    <>
                      <input aria-label={t("conn.ollamaLabel")} value={draft.connections.ollamaUrl} onChange={(e) => setConn("ollamaUrl", e.target.value)} />
                      <IssueList issues={urlIssues("ollamaUrl")} />
                    </>
                  ) : provider(p.id).via === "openrouter" ? (
                    t("conn.openrouter")
                  ) : provider(p.id).via === "litellm" ? (
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
      <TmuxSettings draft={draft} patch={patch} issues={issues} />
      <label className="chk">
        <input type="checkbox" checked={draft.devcontainer === true} onChange={(e) => patch({ devcontainer: e.target.checked ? true : undefined })} />
        {t("devcontainer.label")}
      </label>
      <small>{t("devcontainer.hint")}</small>
      <h3>{t("tmux.title")}</h3>
      <TmuxPreview draft={draft} />
      <IssueList issues={issues} filter={(i) => WARN_CODES.includes(i.code)} />
      <p className="note">{t("conn.note")}</p>
    </>
  );
}
