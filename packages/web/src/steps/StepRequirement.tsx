import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppError, type Issue, type ProjectInput, type RenderedFile } from "@agentforge/core";
import { toZip } from "@agentforge/exporter";
import { IssueList } from "../components/IssueList";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
  readonly files: readonly RenderedFile[];
}

/** 1단계: 요구사항 입력 + ZIP 다운로드(개발자 수 스테퍼는 T-421) */
export function StepRequirement({ draft, patch, issues, files }: Props) {
  const { t } = useTranslation();
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
      <label>{t("req.language")}
        <select value={draft.language} onChange={(e) => patch({ language: e.target.value as ProjectInput["language"] })}>
          <option value="ko">{t("lang.ko")}</option>
          <option value="en">{t("lang.en")}</option>
        </select>
      </label>
      <label>{t("req.text")}<textarea rows={8} value={draft.requirement} onChange={(e) => patch({ requirement: e.target.value })} /></label>
      <label className="toggle"><input type="checkbox" checked={draft.uiDesign} onChange={(e) => patch({ uiDesign: e.target.checked })} />{t("req.uiDesign")}</label>
      <label>{t("req.install")}<input value={draft.commands.install} onChange={(e) => cmd("install", e.target.value)} /></label>
      <label>{t("req.test")}<input value={draft.commands.test} onChange={(e) => cmd("test", e.target.value)} /></label>
      <label>{t("req.e2e")}<input value={draft.commands.e2e} onChange={(e) => cmd("e2e", e.target.value)} /></label>
      <IssueList issues={issues} />
      {failure ? <p className="issues" role="alert">{t("export.failed", { reason: failure })}</p> : null}
      <button type="button" className="primary" disabled={issues.length > 0 || busy} onClick={() => void download()}>
        {issues.length > 0 ? t("export.blocked", { count: issues.length }) : busy ? t("export.busy") : t("export.zip")}
      </button>
    </>
  );
}
