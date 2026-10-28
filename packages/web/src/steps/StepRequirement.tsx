import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppError, MAX_DEVELOPERS, resizeDevs, type Issue, type ProjectInput, type RenderedFile } from "@agentforge/core";
import { toZip } from "@agentforge/exporter";
import { atPath, IssueList } from "../components/IssueList";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
  readonly files: readonly RenderedFile[];
  /** 오류가 없을 때만 true */
  readonly exportable: boolean;
}

/** 1단계: 요구사항·개발자 수·반려 한도 입력 + ZIP 다운로드 */
export function StepRequirement({ draft, patch, issues, files, exportable }: Props) {
  const { t } = useTranslation();
  const errorCount = issues.filter((i) => i.level === "error").length;
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const cmd = (k: keyof ProjectInput["commands"], v: string) => patch({ commands: { ...draft.commands, [k]: v } });

  const download = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const bytes = await toZip([...files], draft.name);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${draft.name}-agentforge.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // 원문 메시지는 화면에 노출하지 않고 오류 코드만 i18n 파라미터로 쓴다
      setFailure(e instanceof AppError ? e.code : "UNKNOWN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2>{t("req.title")}</h2>
      <label>{t("req.name")}<input value={draft.name} onChange={(e) => patch({ name: e.target.value })} /></label>
      <IssueList issues={issues} filter={atPath("name")} />
      <label>{t("req.language")}
        <select value={draft.language} onChange={(e) => patch({ language: e.target.value as ProjectInput["language"] })}>
          <option value="ko">{t("lang.ko")}</option>
          <option value="en">{t("lang.en")}</option>
        </select>
      </label>
      <label>{t("req.text")}<textarea rows={8} value={draft.requirement} onChange={(e) => patch({ requirement: e.target.value })} /></label>
      <IssueList issues={issues} filter={atPath("requirement")} />
      <div className="row">
        <span className="sub strong">{t("req.devCount")}</span>
        <div className="stepper">
          <button type="button" aria-label={t("req.devLess")} disabled={draft.developerCount <= 1} onClick={() => patch(resizeDevs(draft, draft.developerCount - 1))}>−</button>
          <output aria-label={t("req.devCount")}>{draft.developerCount}</output>
          <button type="button" aria-label={t("req.devMore")} disabled={draft.developerCount >= MAX_DEVELOPERS} onClick={() => patch(resizeDevs(draft, draft.developerCount + 1))}>+</button>
        </div>
        <span className="sub">{t("req.devHint", { max: MAX_DEVELOPERS })}</span>
      </div>
      <label className="toggle"><input type="checkbox" checked={draft.uiDesign} onChange={(e) => patch({ uiDesign: e.target.checked })} />{t("req.uiDesign")}</label>
      <label>{t("req.install")}<input value={draft.commands.install} onChange={(e) => cmd("install", e.target.value)} /></label>
      <label>{t("req.test")}<input value={draft.commands.test} onChange={(e) => cmd("test", e.target.value)} /></label>
      <label>{t("req.e2e")}<input value={draft.commands.e2e} onChange={(e) => cmd("e2e", e.target.value)} /></label>
      <label>{t("req.maxRejects")}
        <select value={draft.maxRejects} onChange={(e) => patch({ maxRejects: Number(e.target.value) })}>
          {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <IssueList issues={issues} filter={atPath("language", "uiDesign", "commands", "maxRejects", "developerCount")} />
      {failure ? <p className="issues" role="alert">{t("export.failed", { reason: failure })}</p> : null}
      <button type="button" className="primary" disabled={!exportable || busy} onClick={() => void download()}>
        {!exportable ? t("export.blocked", { count: errorCount }) : busy ? t("export.busy") : t("export.zip")}
      </button>
    </>
  );
}
