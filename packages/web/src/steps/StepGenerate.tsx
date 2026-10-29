import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Issue, ProjectInput, RenderedFile } from "@agentforge/core";
import { IssueList } from "../components/IssueList";
import type { StepIndex } from "../components/StepNav";
import { ZipButton } from "../components/ZipButton";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { PushFn } from "../push";

// GitHub 영역은 펼칠 때만 불러온다(메인 청크 증가 최소)
const GithubPanel = lazy(() => import("../components/GithubPanel").then((m) => ({ default: m.GithubPanel })));

interface Props {
  readonly draft: ProjectInput;
  /** 기존 CLAUDE.md 붙여넣기 값(저장하지 않음) */
  readonly existingMd: string;
  readonly onExistingMd: (v: string) => void;
  readonly issues: readonly Issue[];
  readonly files: readonly RenderedFile[];
  readonly exportable: boolean;
  readonly onStep: (s: StepIndex) => void;
  /** GitHub 푸시 함수(시험에서 주입). 기본은 exporter 지연 로딩 */
  readonly push?: PushFn;
  readonly patch: (p: Partial<ProjectInput>) => void;
}

/** 받은 뒤 할 일 문구 키. 4번은 UI/UX 설계 사용 여부에 따라 달라진다(PoC p5). */
const NEXT_KEYS = ["setup", "login", "planner", "seq", "agents", "models", "worktrees", "integrate"] as const;

/** 6단계: 파일 수 칩, 검사 전체 목록, ZIP, 받은 뒤 할 일, GitHub(P1 안내) — EXP-01 */
export function StepGenerate({ existingMd, onExistingMd, draft, issues, files, exportable, onStep, push, patch }: Props) {
  const { t } = useTranslation();
  const [ghToggled, setGhOpen] = useState(false);
  // GitHub 항목 오류가 ZIP 을 막고 있으면 이유가 보이도록 영역을 접지 못하게 연다
  const ghOpen = ghToggled || issues.some((i) => i.level === "error" && i.path[0] === "export");
  const exec = files.filter((f) => f.mode === 0o755).length;
  const docInvalid = issues.some((i) => i.code === "CLAUDE_MD_MARKERS");
  const ai = files.filter((f) => f.author === "ai-fill").length;
  return (
    <>
      <h2>{t("generate.title")}</h2>
      <div className="row">
        <span className="chip acc">{t("generate.chip.files", { count: files.length })}</span>
        <span className="chip">{t("generate.chip.exec", { count: exec })}</span>
        <span className="chip ver">{t("generate.chip.ai", { count: ai })}</span>
      </div>
      <IssueList issues={issues} onGoto={onStep} current={5} testId="check-list" />
      <label className="block">
        {t("doc.label")}
        <textarea rows={6} value={existingMd} spellCheck={false} aria-invalid={docInvalid ? true : undefined} aria-describedby={docInvalid ? "doc-hint doc-note doc-error" : "doc-hint doc-note"} onChange={(e) => onExistingMd(e.target.value)} />
      </label>
      <small id="doc-hint">{t("doc.hint")}</small>
      <small id="doc-note">{t("doc.note")}</small>
      <IssueList issues={issues} filter={(i) => i.code === "CLAUDE_MD_MARKERS"} id="doc-error" />
      <ZipButton files={files} name={draft.name} issues={issues} exportable={exportable} onStep={onStep} current={5} />
      <h3>{t("generate.nextTitle")}</h3>
      <ol className="next" data-testid="next-steps">
        {NEXT_KEYS.map((k) => (
          <li key={k}>{t(k === "seq" ? (draft.uiDesign ? "generate.next.seqUi" : "generate.next.seq") : `generate.next.${k}`)}</li>
        ))}
      </ol>
      <h3>
        <button type="button" aria-expanded={ghOpen} aria-controls={ghOpen ? "gh-panel" : undefined} onClick={() => setGhOpen((v) => !v)}>{t("github.toggle")}</button>
      </h3>
      {ghOpen ? (
        <div id="gh-panel">
          <ErrorBoundary fallback={<p className="issues" role="alert">{t("github.crashed")}</p>}>
            <Suspense fallback={<p className="sub">{t("github.loading")}</p>}>
              <GithubPanel draft={draft} patch={patch} issues={issues} files={files} exportable={exportable} push={push} />
            </Suspense>
          </ErrorBoundary>
        </div>
      ) : null}
    </>
  );
}
