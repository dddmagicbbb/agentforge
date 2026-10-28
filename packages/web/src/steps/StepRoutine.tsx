import { useTranslation } from "react-i18next";
import type { AgentModelT, ProjectInput, SeqAgentIdT } from "@agentforge/core";
import { FlowChart } from "../components/FlowChart";
import { ModelPicker } from "../components/ModelPicker";
import { OPTIONAL_AGENT, ROUTINE_IDS } from "../catalog";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
}

/** 2단계: 루틴·에이전트(RTN-02) */
export function StepRoutine({ draft, patch }: Props) {
  const { t } = useTranslation();
  const setAgent = (id: SeqAgentIdT, next: AgentModelT) => patch({ agents: { ...draft.agents, [id]: next } });
  return (
    <>
      <h2>{t("routine.title")}</h2>
      <p className="lead">{t("routine.lead")}</p>
      <FlowChart draft={draft} />
      <div className="tw">
        <table className="t">
          <thead>
            <tr>
              <th>{t("routine.col.no")}</th><th>{t("routine.col.step")}</th><th>{t("routine.col.provider")}</th>
              <th>{t("routine.col.model")}</th><th>{t("routine.col.out")}</th>
            </tr>
          </thead>
          <tbody>
            {ROUTINE_IDS.map((id, k) => {
              const off = id === OPTIONAL_AGENT && !draft.uiDesign;
              return (
                <tr key={id} className={off ? "off" : undefined}>
                  <td className="mono">{k + 1}</td>
                  <td>
                    <b>{t(`routine.seq.${id}.step`)}</b>
                    {id === OPTIONAL_AGENT ? <span className="chip">{t("routine.optional")}</span> : null}
                    <div className="mono sub">{id}</div>
                  </td>
                  <td colSpan={2} className="pick"><ModelPicker id={id} value={draft.agents[id]} disabled={off} onChange={(n) => setAgent(id, n)} /></td>
                  <td className="gate">
                    <div>{t(`routine.seq.${id}.out`)}</div>
                    <div className="sub">{t("routine.gate", { gate: t(`routine.seq.${id}.gate`) })}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="note">{t("routine.note")}</p>
    </>
  );
}
