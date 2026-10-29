import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import type { AgentModelT, ProjectInput } from "@agentforge/core";
import { FINAL_AGENT, OPTIONAL_AGENT, ROUTINE_IDS } from "../catalog";

/** 흐름도: 순차 단계 → 병렬 쌍(개발자마다) → 통합 검증 */
export function FlowChart({ draft }: { draft: ProjectInput }) {
  const { t } = useTranslation();
  const label = (a: AgentModelT) => `${t(`provider.${a.provider}`)} · ${a.model}`;
  const node = (id: (typeof ROUTINE_IDS)[number], extra: string) => (
    <div className={`st ${extra}`.trim()}>
      <span className="k">{id}</span>
      <b>{t(`routine.seq.${id}.step`)}{id === OPTIONAL_AGENT ? ` ${t("routine.flow.optionalMark")}` : ""}</b>
      <small>{label(draft.agents[id])}</small>
    </div>
  );
  const seq = ROUTINE_IDS.filter((id) => id !== FINAL_AGENT);
  return (
    <div className="flow" data-testid="flow">
      <div className="seq">
        {seq.map((id) => (
          <Fragment key={id}>
            {node(id, id === OPTIONAL_AGENT ? (draft.uiDesign ? "opt" : "opt off") : "")}
            <span className="ar">→</span>
          </Fragment>
        ))}
        <div className="par">
          <span className="lbl">{t("routine.flow.parallel")}</span>
          {draft.devs.map((_, i) => (
            <div className="pr" key={i}>
              <span className="d">{t("routine.flow.dev", { n: i + 1 })}</span>→<span className="r">{t("routine.flow.review", { n: i + 1 })}</span>
            </div>
          ))}
        </div>
        <span className="ar">→</span>
        {node(FINAL_AGENT, "fin")}
      </div>
    </div>
  );
}
