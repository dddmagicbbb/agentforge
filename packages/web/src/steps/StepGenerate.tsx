import { useTranslation } from "react-i18next";
import type { Issue, ProjectInput, RenderedFile } from "@agentforge/core";
import { IssueList } from "../components/IssueList";
import type { StepIndex } from "../components/StepNav";
import { ZipButton } from "../components/ZipButton";

interface Props {
  readonly draft: ProjectInput;
  readonly issues: readonly Issue[];
  readonly files: readonly RenderedFile[];
  readonly exportable: boolean;
  readonly onStep: (s: StepIndex) => void;
}

/** 받은 뒤 할 일 문구 키. 4번은 UI/UX 설계 사용 여부에 따라 달라진다(PoC p5). */
const NEXT_KEYS = ["setup", "login", "planner", "seq", "agents", "models", "worktrees", "integrate"] as const;

/** 6단계: 파일 수 칩, 검사 전체 목록, ZIP, 받은 뒤 할 일, GitHub(P1 안내) — EXP-01 */
export function StepGenerate({ draft, issues, files, exportable, onStep }: Props) {
  const { t } = useTranslation();
  const exec = files.filter((f) => f.mode === 0o755).length;
  const ai = files.filter((f) => f.author === "ai-fill").length;
  return (
    <>
      <h2>{t("generate.title")}</h2>
      <div className="row">
        <span className="chip acc">{t("generate.chip.files", { count: files.length })}</span>
        <span className="chip">{t("generate.chip.exec", { count: exec })}</span>
        <span className="chip ver">{t("generate.chip.ai", { count: ai })}</span>
      </div>
      <IssueList issues={issues} onGoto={onStep} testId="check-list" />
      <ZipButton files={files} name={draft.name} issues={issues} exportable={exportable} onStep={onStep} current={5} />
      <h3>{t("generate.nextTitle")}</h3>
      <ol className="next" data-testid="next-steps">
        {NEXT_KEYS.map((k) => (
          <li key={k}>{t(k === "seq" ? (draft.uiDesign ? "generate.next.seqUi" : "generate.next.seq") : `generate.next.${k}`)}</li>
        ))}
      </ol>
      <h3>{t("generate.github.title")}</h3>
      <p className="note">{t("generate.github.note")}</p>
    </>
  );
}
