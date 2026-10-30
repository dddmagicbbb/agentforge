import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultDraft, resizeDevs, type ProjectInput } from "@agentforge/core";
import { LangSwitch } from "./components/LangSwitch";
import { LicenseBadge } from "./license/LicenseBadge";
import { defaultVerify, fetchServerLicense, FREE, type LicenseState, type VerifyFn } from "./license/license";
import { PreviewPane } from "./components/PreviewPane";
import { StepBar, StepButtons, STEP_KEYS, type StepIndex } from "./components/StepNav";
import { StepConnection } from "./steps/StepConnection";
import { StepDevelopers } from "./steps/StepDevelopers";
import { StepGenerate } from "./steps/StepGenerate";
import { errorSteps } from "./issue-step";
import { StepRequirement } from "./steps/StepRequirement";
import { StepRoutine } from "./steps/StepRoutine";
import { StepSkills } from "./steps/StepSkills";
import { applyExistingClaudeMd, usePreview } from "./use-preview";
import type { PushFn } from "./push";
import "./app.css";

/**
 * 처음 여는 화면의 입력. 라이선스가 없으면 Free(개발자 2명 이하)이므로 core 기본값(3명)에서 2명으로 줄여 시작한다.
 * core defaultDraft 는 바꾸지 않는다(LIC-01, ADR-0008).
 */
export const initialDraft = (): ProjectInput => resizeDevs(defaultDraft(), 2);

interface AppProps {
  readonly marketFetch?: typeof fetch;
  readonly push?: PushFn;
  /** `/api/license` 조회용 fetch(시험 주입). 없으면 전역 fetch */
  readonly licenseFetch?: typeof fetch;
  /** 키 검증 함수(시험 주입). 없으면 defaultVerify */
  readonly verifyLicense?: VerifyFn;
  /** 시험용 시작값. 없으면 initialDraft()·Free */
  readonly initialDraft?: ProjectInput;
  readonly initialLicense?: LicenseState;
}

// App 이 ProjectInput 하나를 소유한다. 키·비밀 값은 입력받지 않는다.
export function App({ marketFetch, push, licenseFetch, verifyLicense = defaultVerify, initialDraft: seed, initialLicense }: AppProps = {}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProjectInput>(() => seed ?? initialDraft());
  const [step, setStep] = useState<StepIndex>(0);
  // 기존 CLAUDE.md 는 저장하지 않는 화면 상태(DOC-03)
  const [existingMd, setExistingMd] = useState("");
  // 라이선스 등급(메모리에만). 서버가 있으면 서버 결과, 없으면 키 입력 결과. 새로 고침하면 Free
  const [license, setLicense] = useState<LicenseState>(initialLicense ?? FREE);
  useEffect(() => {
    const f = licenseFetch ?? (typeof fetch === "function" ? fetch : undefined);
    if (!f) return;
    let live = true;
    void fetchServerLicense(f).then((r) => { if (live && r) setLicense(r); });
    return () => { live = false; };
  }, [licenseFetch]);
  const base = usePreview(draft, license);
  const merged = useMemo(() => applyExistingClaudeMd(base.files, existingMd), [base.files, existingMd]);
  const files = merged.files;
  const issues = useMemo(() => [...base.issues, ...merged.issues], [base.issues, merged.issues]);
  const exportable = base.exportable && merged.issues.length === 0;
  // 함수형 갱신도 받는다(비동기 가져오기 결과가 서로 덮어쓰지 않도록)
  const patch = (p: Partial<ProjectInput> | ((d: ProjectInput) => Partial<ProjectInput>)) => setDraft((d) => ({ ...d, ...(typeof p === "function" ? p(d) : p) }));

  const key = STEP_KEYS[step];
  return (
    <div className="app">
      <header>
        <h1>{t("app.title")}</h1>
        <span>{t("app.subtitle")}</span>
        <LangSwitch />
        <LicenseBadge state={license} verify={verifyLicense} onChange={(s) => setLicense(s ?? FREE)} />
        <StepBar step={step} onStep={setStep} errorSteps={errorSteps(issues)} />
      </header>
      <main>
        <section className="panel">
          {key === "requirement" ? <StepRequirement draft={draft} patch={patch} issues={issues} files={files} exportable={exportable} onStep={setStep} /> : null}
          {key === "routine" ? <StepRoutine draft={draft} patch={patch} /> : null}
          {key === "skills" ? <StepSkills draft={draft} patch={patch} issues={issues} marketFetch={marketFetch} /> : null}
          {key === "developers" ? <StepDevelopers draft={draft} patch={patch} issues={issues} /> : null}
          {key === "connection" ? <StepConnection draft={draft} patch={patch} issues={issues} /> : null}
          {key === "generate" ? <StepGenerate existingMd={existingMd} onExistingMd={setExistingMd} draft={draft} issues={issues} files={files} exportable={exportable} onStep={setStep} push={push} patch={patch} /> : null}
          <StepButtons step={step} onStep={setStep} />
        </section>
        <PreviewPane files={files} />
      </main>
    </div>
  );
}
