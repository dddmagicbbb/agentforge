import { useTranslation } from "react-i18next";
import { CORE_SKILLS, devReady, devSkill, type CoreSkill, type ProjectInput } from "@agentforge/core";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
}

/** 4단계: 스킬(SKL-01·02). 마켓은 P1 — 안내만. */
export function StepSkills({ draft, patch }: Props) {
  const { t } = useTranslation();

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
      <div className="layer"><h3>{t("skills.layer.market")}</h3><p className="sub">{t("skills.market")}</p></div>
    </>
  );
}
