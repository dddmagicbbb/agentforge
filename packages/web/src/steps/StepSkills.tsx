import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { CORE_SKILLS, devReady, devSkill, type CoreSkill, type Issue, type ProjectInput } from "@agentforge/core";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { riskText } from "../market/risk";
import { IssueList } from "../components/IssueList";

// 마켓은 4단계에서만 쓰므로 별도 청크로 지연 로딩한다(첫 화면 번들 500kB 이하 유지)
const MarketPanel = lazy(() => import("../components/MarketPanel").then((m) => ({ default: m.MarketPanel })));

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput> | ((d: ProjectInput) => Partial<ProjectInput>)) => void;
  readonly issues?: readonly Issue[];
  /** 마켓 서버 호출용(시험에서 주입). 기본은 전역 fetch */
  readonly marketFetch?: typeof fetch;
}

/** 4단계: 스킬(SKL-01·02), 마켓 가져오기(MKT-01·02). 가져온 스킬은 draft 에만 둔다(저장 안 함). */
export function StepSkills({ draft, patch, issues = [], marketFetch }: Props) {
  const { t } = useTranslation();
  const imported = draft.imported;
  // 현재 draft 기준 함수형 갱신: 연속 가져오기가 서로 덮어쓰지 않는다
  const update = (fn: (cur: typeof imported) => typeof imported) => patch((d) => ({ imported: fn(d.imported) }));
  const addImported = (s: (typeof imported)[number]) => update((cur) => (cur.some((x) => x.id === s.id) ? cur : [...cur, s]));
  const setAt = (id: string, change: Partial<(typeof imported)[number]>) => update((cur) => cur.map((x) => (x.id === id ? { ...x, ...change } : x)));

  const row = (k: CoreSkill) => {
    const toggleable = k.id === "conventions" || k.id === "tdd";
    const checked = toggleable ? draft.skills[k.id] : true;
    return (
      <label className="sk" key={k.id}>
        <input
          type="checkbox"
          checked={checked}
          disabled={k.fixed}
          onChange={(e) => { if (toggleable) patch({ skills: { ...draft.skills, [k.id]: e.target.checked } }); }}
        />
        <span>
          <code>{k.id}</code> — {t(`skills.core.${k.id}.desc`)}
          <br />
          <span className="sub">{t(`skills.core.${k.id}.to`)}{k.fixed ? ` · ${t("skills.required")}` : ""}</span>
        </span>
      </label>
    );
  };
  const layer = (g: CoreSkill["group"]) => CORE_SKILLS.filter((k) => k.group === g).map(row);

  return (
    <>
      <h2>{t("skills.title")}</h2>
      <p className="lead">{t("skills.lead")}</p>
      <div className="layer"><h3>{t("skills.layer.common")}</h3>{layer("common")}</div>
      <div className="layer"><h3>{t("skills.layer.role")}</h3>{layer("role")}</div>
      <div className="layer">
        <h3>{t("skills.layer.dev")}</h3>
        {draft.devs.map((d, i) =>
          devReady(d) ? (
            <div className="sk" key={i}>
              <span className="chip acc">{`dev-${i + 1}`}</span>
              <span><code>{devSkill(d, i + 1)}</code> — {t("skills.devDesc", { domain: d.domain })} <span className="chip ver">{t("preview.ai")}</span></span>
            </div>
          ) : (
            <div className="sk" key={i}>
              <span className="chip">{`dev-${i + 1}`}</span>
              <span className="sub">{t("skills.devPending")}</span>
            </div>
          ),
        )}
      </div>
      <div className="layer"><h3>{t("skills.layer.gen")} <span className="chip ver">{t("skills.runInUser")}</span></h3>{layer("gen")}</div>
      <div className="layer">
        <h3>{t("skills.layer.market")}</h3>
        <ErrorBoundary fallback={<p className="issues" role="alert">{t("market.crashed")}</p>}>
          <Suspense fallback={<p className="sub">{t("market.checking")}</p>}>
            <MarketPanel fetchFn={marketFetch} imported={imported} onImport={addImported} />
          </Suspense>
        </ErrorBoundary>
        {imported.length > 0 ? <h4>{t("market.importedTitle")}</h4> : null}
        <ul className="mimp">
          {imported.map((m, i) => {
            // 서버 flags 를 믿지 않는다: core 가 IMPORT_UNACKED 로 판정한 항목도 확인 대상이다
            // TODO(통합 후): 위험 목록도 core scanSkillRisk(files) 결과로 표시
            const unacked = issues.some((x) => x.code === "IMPORT_UNACKED" && x.path[0] === "imported" && x.path[1] === i);
            const needAck = m.flags.length > 0 || unacked;
            return (
            <li key={m.id} data-testid={`imp-${m.id}`}>
              <code>{m.id}</code> <span className="chip">{t(`market.trust.${m.trust}`)}</span> <span className="sub">{m.src}</span>
              {m.flags.length > 0 ? <ul>{m.flags.map((c) => <li key={c} className="sub">{riskText(t, c)}</li>)}</ul> : null}
              <div className="row">
                <label>{t("market.target")}
                  <select value={m.target} onChange={(e) => setAt(m.id, { target: e.target.value as typeof m.target })}>
                    {(["all", "dev", "review"] as const).map((x) => <option key={x} value={x}>{t(`market.targets.${x}`)}</option>)}
                  </select>
                </label>
                {needAck ? (
                  <label className="toggle">
                    <input type="checkbox" checked={m.acknowledged} aria-invalid={unacked ? true : undefined} aria-describedby={unacked ? `imp-err-${m.id}` : undefined} onChange={(e) => setAt(m.id, { acknowledged: e.target.checked })} />
                    {t("market.ack", { id: m.id })}
                  </label>
                ) : null}
                <button type="button" onClick={() => update((cur) => cur.filter((x) => x.id !== m.id))}>{t("market.removeImported")}</button>
              </div>
              <IssueList issues={issues} filter={(x) => x.path[0] === "imported" && x.path[1] === i} id={`imp-err-${m.id}`} />
            </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
