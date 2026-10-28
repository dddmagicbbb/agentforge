import { useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultDraft, type ProjectInput } from "@agentforge/core";
import { PreviewPane } from "./components/PreviewPane";
import { StepBar, StepButtons, STEP_KEYS, type StepIndex } from "./components/StepNav";
import { StepPlaceholder } from "./steps/StepPlaceholder";
import { StepRequirement } from "./steps/StepRequirement";
import { StepRoutine } from "./steps/StepRoutine";
import { StepSkills } from "./steps/StepSkills";
import { usePreview } from "./use-preview";
import "./app.css";

// App 이 ProjectInput 하나를 소유한다. 키·비밀 값은 입력받지 않는다.
export function App() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProjectInput>(defaultDraft);
  const [step, setStep] = useState<StepIndex>(0);
  const { issues, files, exportable } = usePreview(draft);
  const patch = (p: Partial<ProjectInput>) => setDraft((d) => ({ ...d, ...p }));

  const key = STEP_KEYS[step];
  return (
    <div className="app">
      <header>
        <h1>{t("app.title")}</h1>
        <span>{t("app.subtitle")}</span>
        <StepBar step={step} onStep={setStep} />
      </header>
      <main>
        <section className="panel">
          {key === "requirement" ? <StepRequirement draft={draft} patch={patch} issues={issues} files={files} exportable={exportable} /> : null}
          {key === "routine" ? <StepRoutine draft={draft} patch={patch} /> : null}
          {key === "skills" ? <StepSkills draft={draft} patch={patch} /> : null}
          {key === "developers" || key === "connection" || key === "generate" ? <StepPlaceholder stepKey={key} /> : null}
          <StepButtons step={step} onStep={setStep} />
        </section>
        <PreviewPane files={files} />
      </main>
    </div>
  );
}
