import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Issue, ProjectInput, RenderedFile } from "@agentforge/core";
import { IssueList } from "./IssueList";
import { defaultPush, errorCodeOf, type GithubTargetInput, type PushFn, type PushResult } from "../push";

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
  /** ZIP 과 같은 배열 */
  readonly files: readonly RenderedFile[];
  readonly exportable: boolean;
  readonly push?: PushFn;
}

interface Fields { owner: string; repo: string; visibility: "private" | "public"; mode: "create" | "pr"; baseUrl: string; branch: string }

const toTarget = (f: Fields): GithubTargetInput | undefined =>
  f.owner || f.repo || f.baseUrl
    ? { owner: f.owner, repo: f.repo, visibility: f.visibility, mode: f.mode, ...(f.baseUrl ? { baseUrl: f.baseUrl } : {}), ...(f.mode === "pr" ? { branch: f.branch } : {}) }
    : undefined;

const isHttps = (u: string) => u.startsWith("https://");

/** 6단계 GitHub 내보내기(EXP-02). 토큰은 비제어 input 에만 있고 상태·draft·저장소에 두지 않는다. */
export function GithubPanel({ draft, patch, issues, files, exportable, push = defaultPush }: Props) {
  const { t, i18n } = useTranslation();
  const g = draft.export?.github;
  const [f, setF] = useState<Fields>({ owner: g?.owner ?? "", repo: g?.repo ?? "", visibility: g?.visibility ?? "private", mode: g?.mode ?? "create", baseUrl: g?.baseUrl ?? "", branch: g?.branch ?? "agentforge/setup" });
  const tokenRef = useRef<HTMLInputElement>(null);
  const [hasToken, setHasToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    const next = { ...f, [k]: v };
    setF(next);
    const target = toTarget(next);
    patch({ export: target ? { ...draft.export, github: target } : undefined });
  };
  const target = toTarget(f);
  const ghIssues = issues.filter((i) => i.path[0] === "export");
  const bad = (k: string) => ghIssues.some((i) => i.level === "error" && i.path[2] === k);
  const desc = (k: string, extra?: string) => [bad(k) ? "gh-err" : "", extra ?? ""].filter(Boolean).join(" ") || undefined;

  const run = async () => {
    const token = tokenRef.current?.value ?? "";
    if (!target || !token || busy) return;
    setBusy(true);
    setResult(null);
    setFailure(null);
    try {
      setResult(await push(files, target, token, { language: i18n.language === "en" ? "en" : "ko" }));
    } catch (e) {
      setFailure(errorCodeOf(e));
    } finally {
      // 성공·실패 모두 토큰을 즉시 지운다
      if (tokenRef.current) tokenRef.current.value = "";
      setHasToken(false);
      setBusy(false);
    }
  };

  const link = (u: string) => (isHttps(u) ? <a href={u} target="_blank" rel="noreferrer noopener">{u}</a> : <span>{u}</span>);

  return (
    <div className="github">
      <p className="note">{t("github.note")}</p>
      <div className="row">
        <label>{t("github.owner")}<input value={f.owner} autoComplete="off" aria-invalid={bad("owner") ? true : undefined} aria-describedby={desc("owner")} onChange={(e) => set("owner", e.target.value)} /></label>
        <label>{t("github.repo")}<input value={f.repo} autoComplete="off" aria-invalid={bad("repo") ? true : undefined} aria-describedby={desc("repo")} onChange={(e) => set("repo", e.target.value)} /></label>
        <label>{t("github.visibility")}
          <select value={f.visibility} onChange={(e) => set("visibility", e.target.value as Fields["visibility"])}>
            <option value="private">{t("github.vis.private")}</option>
            <option value="public">{t("github.vis.public")}</option>
          </select>
        </label>
        <label>{t("github.mode")}
          <select value={f.mode} onChange={(e) => set("mode", e.target.value as Fields["mode"])}>
            <option value="create">{t("github.modes.create")}</option>
            <option value="pr">{t("github.modes.pr")}</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label>{t("github.baseUrl")}<input value={f.baseUrl} autoComplete="off" aria-invalid={bad("baseUrl") ? true : undefined} aria-describedby={desc("baseUrl", "gh-base-hint")} onChange={(e) => set("baseUrl", e.target.value)} /></label>
        {f.mode === "pr" ? <label>{t("github.branch")}<input value={f.branch} autoComplete="off" aria-invalid={bad("branch") ? true : undefined} aria-describedby={desc("branch")} onChange={(e) => set("branch", e.target.value)} /></label> : null}
      </div>
      <small id="gh-base-hint">{t("github.baseUrlHint")}</small>
      <IssueList issues={ghIssues} id="gh-err" />
      <label className="block">{t("github.token")}
        <input ref={tokenRef} type="password" autoComplete="off" spellCheck={false} aria-describedby="gh-token-hint" onChange={(e) => setHasToken(e.target.value.length > 0)} />
      </label>
      <small id="gh-token-hint">{t("github.tokenHint")}</small>
      {failure ? <p className="issues" role="alert" data-testid="github-error">{t(`github.error.${failure}`)}</p> : null}
      {result ? (
        <ul className="sub" data-testid="github-result" role="status">
          <li>{t("github.doneRepo")} {link(result.url)}</li>
          {result.prUrl ? <li>{t("github.donePr")} {link(result.prUrl)}</li> : null}
        </ul>
      ) : null}
      <div className="row">
        <button type="button" className="primary" disabled={!exportable || !target || !hasToken || busy} onClick={() => void run()}>
          {busy ? t("github.busy") : t("github.push")}
        </button>
      </div>
    </div>
  );
}
