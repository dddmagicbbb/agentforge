import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentModelT, DevT, Issue, ProjectInput } from "@agentforge/core";
import { IssueList } from "../components/IssueList";
import { ModelPicker } from "../components/ModelPicker";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
}

type DevInput = ProjectInput["devs"][number];

/** 쉼표 구분 입력 → 배열. 빈 항목은 버리고 값 검증·끝 `/` 정규화는 core 가 한다. */
export function splitPaths(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter((s) => s !== "");
}

/** i번째(0부터) 개발자 행에 붙일 항목: 경로가 devs.i 아래이거나 겹침의 당사자 */
export const forDev = (i: number) => (x: Issue) =>
  x.path[0] === "devs" && (x.path[1] === i || (x.code === "PATH_OVERLAP" && (x.params["devA"] === i + 1 || x.params["devB"] === i + 1)));

interface RowProps {
  readonly index: number;
  readonly dev: DevInput;
  readonly issues: readonly Issue[];
  readonly onChange: (next: DevT) => void;
}

function DevRow({ index, dev, issues, onChange }: RowProps) {
  const { t } = useTranslation();
  const n = index + 1;
  // 입력 중인 원문을 보존한다(쉼표·공백·잘못된 경로 포함). 배열은 매 입력마다 갱신
  const [pathText, setPathText] = useState(() => dev.paths.join(", "));
  return (
    <tbody data-testid="dev-row">
      <tr>
        <td className="mono"><b>dev-{n}</b><br /><span className="sub">review-{n}</span></td>
        <td><input aria-label={t("dev.domainLabel", { n })} value={dev.domain} placeholder={t("dev.domainPh")} onChange={(e) => onChange({ ...dev, domain: e.target.value })} /></td>
        <td>
          <input
            aria-label={t("dev.pathsLabel", { n })}
            value={pathText}
            placeholder={t("dev.pathsPh")}
            onChange={(e) => {
              setPathText(e.target.value);
              onChange({ ...dev, paths: splitPaths(e.target.value) });
            }}
          />
        </td>
        <td className="pick"><ModelPicker id={`dev-${n}`} value={dev.dev} onChange={(m: AgentModelT) => onChange({ ...dev, dev: m })} /></td>
        <td className="pick"><ModelPicker id={`review-${n}`} value={dev.review} onChange={(m: AgentModelT) => onChange({ ...dev, review: m })} /></td>
      </tr>
      {issues.length ? (
        <tr className="row-issues"><td colSpan={5}><IssueList issues={issues} /></td></tr>
      ) : null}
    </tbody>
  );
}

/** 3단계: 개발자별 도메인·담당 폴더·개발/검증 모델(DEV-02) */
export function StepDevelopers({ draft, patch, issues }: Props) {
  const { t } = useTranslation();
  const setDev = (i: number, next: DevT) => patch({ devs: draft.devs.map((d, k) => (k === i ? next : d)) });
  return (
    <>
      <h2>{t("dev.title")}</h2>
      <p className="lead">{t("dev.lead")}</p>
      <div className="tw">
        <table className="t">
          <thead>
            <tr>
              <th>{t("dev.col.agent")}</th><th>{t("dev.col.domain")}</th><th>{t("dev.col.paths")}</th>
              <th>{t("dev.col.dev")}</th><th>{t("dev.col.review")}</th>
            </tr>
          </thead>
          {draft.devs.map((d, i) => (
            <DevRow key={i} index={i} dev={d} issues={issues.filter(forDev(i))} onChange={(next) => setDev(i, next)} />
          ))}
        </table>
      </div>
      <p className="note">{t("dev.note")}</p>
    </>
  );
}
