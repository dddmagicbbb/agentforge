import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { defaultDraft, render, validate, type Issue, type ProjectInput, type RenderedFile } from "@agentforge/core";
import { toZip } from "@agentforge/exporter";
import "./app.css";

const STEP_KEYS = ["requirement", "routine", "developers", "skills", "connection", "generate"] as const;

// PH3 최소 화면(T-307): 1단계 입력 + 미리보기 + ZIP. 2~6단계는 T-422~T-426.
export function App() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ProjectInput>(defaultDraft);
  const [sel, setSel] = useState("CLAUDE.md");
  const { issues, files } = useMemo(() => {
    const v = validate(draft);
    return { issues: v.issues, files: v.project ? render(v.project) : ([] as RenderedFile[]) };
  }, [draft]);
  const cur = files.find((f) => f.path === sel) ?? files[0];
  const patch = (p: Partial<ProjectInput>) => setDraft((d) => ({ ...d, ...p }));
  const cmd = (k: keyof ProjectInput["commands"], v: string) => setDraft((d) => ({ ...d, commands: { ...d.commands, [k]: v } }));

  const download = async () => {
    const bytes = await toZip(files, draft.name);
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.name}-agentforge.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header>
        <h1>{t("app.title")}</h1>
        <span>{t("app.subtitle")}</span>
        <ol className="steps">
          {STEP_KEYS.map((k, i) => (
            <li key={k} aria-current={i === 0 ? "step" : undefined}>{`${i + 1} ${t(`steps.${k}`)}`}</li>
          ))}
        </ol>
      </header>
      <main>
        <section className="panel">
          <h2>{t("steps.requirement")}</h2>
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
          <button type="button" className="primary" disabled={issues.length > 0} onClick={() => void download()}>
            {issues.length > 0 ? t("export.blocked", { count: issues.length }) : t("export.zip")}
          </button>
        </section>
        <section className="preview">
          <h2>{t("preview.title")} <small>{t("preview.count", { count: files.length })}</small></h2>
          <div className="tree">
            {files.map((f) => (
              <button type="button" key={f.path} aria-current={f.path === cur?.path} onClick={() => setSel(f.path)}>
                <span>{f.path}</span>
                <span>{f.author === "ai-fill" ? <b className="ai">{t("preview.ai")}</b> : null}{f.mode === 0o755 ? <b className="x">{t("preview.exec")}</b> : null}</span>
              </button>
            ))}
          </div>
          <pre>{cur ? cur.content || t("preview.empty") : ""}</pre>
        </section>
      </main>
    </div>
  );
}

function IssueList({ issues }: { issues: readonly Issue[] }) {
  const { t } = useTranslation();
  if (!issues.length) return null;
  return (
    <ul className="issues">
      {issues.map((i, k) => {
        const key = `issue.${i.code}`;
        const path = i.path.join(".");
        const reason = String(i.params["reason"] ?? "");
        return <li key={k}>{t(key, { defaultValue: t("issue.default", { code: i.code, path }), path, ...i.params, reason })}</li>;
      })}
    </ul>
  );
}
