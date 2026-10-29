import { useTranslation } from "react-i18next";
import type { Issue, ProjectInput } from "@agentforge/core";
import { IssueList } from "./IssueList";

type TmuxInput = NonNullable<ProjectInput["tmux"]>;
const LAYOUTS = ["pair", "grid", "role"] as const;
export const TMUX_DEFAULT: TmuxInput = { layout: "pair", prefix: "C-b", mouse: false, logs: false };

interface Props {
  readonly draft: ProjectInput;
  readonly patch: (p: Partial<ProjectInput>) => void;
  readonly issues: readonly Issue[];
}

/** tmux 배치·접두키·마우스·로그 입력(RUN-04). 바꾸기 전에는 draft.tmux 를 비워 둔다(생성물 불변). */
export function TmuxSettings({ draft, patch, issues }: Props) {
  const { t } = useTranslation();
  const cur = draft.tmux ?? TMUX_DEFAULT;
  const set = (p: Partial<TmuxInput>) => patch({ tmux: { ...cur, ...p } });
  return (
    <fieldset className="tmux-settings">
      <legend>{t("tmux.settings")}</legend>
      <label>
        {t("tmux.layoutLabel")}
        <select value={cur.layout} onChange={(e) => set({ layout: e.target.value as TmuxInput["layout"] })}>
          {LAYOUTS.map((l) => <option key={l} value={l}>{t(`tmux.layout.${l}`)}</option>)}
        </select>
      </label>
      <label>
        {t("tmux.prefixLabel")}
        <input value={cur.prefix} maxLength={3} aria-describedby="tmux-prefix-hint" onChange={(e) => set({ prefix: e.target.value })} />
      </label>
      <small id="tmux-prefix-hint">{t("tmux.prefixHint")}</small>
      <IssueList issues={issues} filter={(i) => i.path[0] === "tmux" && i.path[1] === "prefix"} />
      <label className="chk"><input type="checkbox" checked={cur.mouse} onChange={(e) => set({ mouse: e.target.checked })} />{t("tmux.mouseLabel")}</label>
      <label className="chk"><input type="checkbox" checked={cur.logs} onChange={(e) => set({ logs: e.target.checked })} />{t("tmux.logsLabel")}</label>
      <small>{t("tmux.logsHint")}</small>
      {draft.tmux ? (
        <button type="button" onClick={() => patch({ tmux: undefined })}>{t("tmux.reset")}</button>
      ) : (
        <small>{t("tmux.unset")}</small>
      )}
    </fieldset>
  );
}
