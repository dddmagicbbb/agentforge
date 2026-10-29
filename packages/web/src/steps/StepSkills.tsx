import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { CORE_SKILLS, devReady, devSkill, type CoreSkill, type Issue, type ProjectInput } from "@agentforge/core";
import { IssueList } from "../components/IssueList";

// 마켓은 4단계에서만 쓰므로 별도 청크로 지연 로딩한다(첫 화면 번들 500kB 이하 유지)
const MarketPanel = lazy(() => import("../components/MarketPanel").then((m) => ({ default: m.MarketPanel })));

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues?: readonly Issue[];
  /** 마켓 서버 호출용(시험에서 주입). 기본은 전역 fetch */
  readonly marketFetch?: typeof fetch;
}

/** 4단계: 스킬(SKL-01·02), 마켓 가져오기(MKT-01·02). 가져온 스킬은 draft 에만 둔다(저장 안 함). */
export function StepSkills({ draft, patch, issues = [], marketFetch }: Props) {
  const { t } = useTranslation();
  const imported = draft.imported;
  const setImported = (next: typeof imported) => patch({ imported: next });

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
        <Suspense fallback={<p className="sub">{t("market.checking")}</p>}>
          <MarketPanel fetchFn={marketFetch} imported={imported} onImport={(s) => setImported([...imported, s])} />
        </Suspense>
        {imported.length > 0 ? <h4>{t("market.importedTitle")}</h4> : null}
        <ul className="mimp">
          {imported.map((m, i) => (
            <li key={m.id} data-testid={`imp-${m.id}`}>
              <code>{m.id}</code> <span className="chip">{t(`market.trust.${m.trust}`)}</span> <span className="sub">{m.src}</span>
              {m.flags.length > 0 ? <ul>{m.flags.map((c) => <li key={c} className="sub">{t(`risk.${c}`, { defaultValue: c })}</li>)}</ul> : null}
              <div className="row">
                <label>{t("market.target")}
                  <select value={m.target} onChange={(e) => setImported(imported.map((x, k) => (k === i ? { ...x, target: e.target.value as typeof m.target } : x)))}>
                    {(["all", "dev", "review"] as const).map((x) => <option key={x} value={x}>{t(`market.targets.${x}`)}</option>)}
                  </select>
                </label>
                {m.flags.length > 0 ? (
                  <label className="toggle">
                    <input type="checkbox" checked={m.acknowledged} onChange={(e) => setImported(imported.map((x, k) => (k === i ? { ...x, acknowledged: e.target.checked } : x)))} />
                    {t("market.ack")}
                  </label>
                ) : null}
                <button type="button" onClick={() => setImported(imported.filter((_, k) => k !== i))}>{t("market.removeImported")}</button>
              </div>
              <IssueList issues={issues} filter={(x) => x.path[0] === "imported" && x.path[1] === i} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
