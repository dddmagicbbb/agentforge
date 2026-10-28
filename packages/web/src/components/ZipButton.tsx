import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppError, type Issue, type RenderedFile } from "@agentforge/core";
import { toZip } from "@agentforge/exporter";
import { stepOfPath } from "../issue-step";
import { STEP_KEYS, type StepIndex } from "./StepNav";

interface Props {
  readonly files: readonly RenderedFile[];
  readonly name: string;
  readonly issues: readonly Issue[];
  /** 오류가 없을 때만 true */
  readonly exportable: boolean;
  /** 오류 원인 단계로 이동(없으면 이동 버튼을 숨긴다) */
  readonly onStep?: (s: StepIndex) => void;
  /** 이동 버튼이 현재 단계를 가리킬 때 숨기기 위한 현재 단계 */
  readonly current?: StepIndex;
}

/** ZIP 다운로드 버튼(오류 시 차단) + 첫 오류 단계로 이동 버튼. 1단계·6단계가 공유한다. */
export function ZipButton({ files, name, issues, exportable, onStep, current }: Props) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const errors = issues.filter((i) => i.level === "error");
  const first = errors[0];
  const target = first ? stepOfPath(first.path) : undefined;

  const download = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const bytes = await toZip([...files], name);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}-agentforge.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // 원문 메시지는 화면에 노출하지 않고 오류 코드만 쓴다
      setFailure(e instanceof AppError ? e.code : "UNKNOWN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {failure ? <p className="issues" role="alert">{t(`export.error.${failure}`, { defaultValue: t("export.failed", { reason: failure }) })}</p> : null}
      <div className="row">
        <button type="button" className="primary" disabled={!exportable || busy} onClick={() => void download()}>
          {!exportable ? t("export.blocked", { count: errors.length }) : busy ? t("export.busy") : t("export.zip")}
        </button>
        {!exportable && onStep && target !== undefined && target !== current ? (
          <button type="button" onClick={() => onStep(target)}>{t("export.goto", { step: t(`steps.${STEP_KEYS[target]}`) })}</button>
        ) : null}
      </div>
    </>
  );
}
