import { useTranslation } from "react-i18next";
import type { AgentModelT, ProjectInput } from "@agentforge/core";

/** 에이전트 표시 이름(PoC label): 제공자 약칭(provider.short.<id>)과 모델을 i18n 키로 조립 */
function useAgentLabel() {
  const { t } = useTranslation();
  return (a: AgentModelT) =>
    t("tmux.paneModel", {
      context: a.provider === "claude" ? "claude" : undefined, // paneModel_claude: "Claude <모델>" (PoC label)
      provider: t(`provider.short.${a.provider}`),
      model: a.model.trim() || t("tmux.noModel"),
    });
}

interface Win { readonly name: string; readonly panes: readonly { readonly id: string; readonly kind: "d" | "r"; readonly agent: AgentModelT }[] }

/** 배치별 창 구성(design 8.2): pair 쌍별 창 / grid 한 창 / role dev 창·review 창 */
function windowsOf(draft: ProjectInput): Win[] {
  const layout = draft.tmux?.layout ?? "pair";
  const dev = (i: number) => ({ id: `dev-${i + 1}`, kind: "d" as const, agent: draft.devs[i]!.dev });
  const rev = (i: number) => ({ id: `review-${i + 1}`, kind: "r" as const, agent: draft.devs[i]!.review });
  const idx = draft.devs.map((_, i) => i);
  if (layout === "grid") return [{ name: "agents", panes: idx.flatMap((i) => [dev(i), rev(i)]) }];
  if (layout === "role") return [{ name: "dev", panes: idx.map(dev) }, { name: "review", panes: idx.map(rev) }];
  return idx.map((i) => ({ name: `dev${i + 1}`, panes: [dev(i), rev(i)] }));
}

/** tmux 배치 미리보기: 0:watch + 배치에 따른 창(PoC tmuxPreview 확장, RUN-04) */
export function TmuxPreview({ draft }: { draft: ProjectInput }) {
  const { t } = useTranslation();
  const label = useAgentLabel();
  const wins = windowsOf(draft);
  const title = (w: Win, i: number) => `${i + 1}:${w.name}`;
  return (
    <div className="tmux" aria-label={t("tmux.title")}>
      <div className="wins">
        <div className="win" data-testid="tmux-window">
          <span className="wn">0:watch</span>
          <div className="panes">
            <div className="pane w">
              <b>wait-and-review.sh</b>
              <span>{t("tmux.watch", { max: draft.maxRejects })}</span>
            </div>
          </div>
        </div>
        {wins.map((w, i) => (
          <div className="win" key={w.name} data-testid="tmux-window">
            <span className="wn">{title(w, i)}</span>
            <div className="panes">
              {w.panes.map((p) => (
                <div className={`pane ${p.kind}`} key={p.id}><b>{p.id}</b><span>{label(p.agent)}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <span className="bar">{`[${draft.name}] 0:watch ${wins.map(title).join(" ")}`}</span>
    </div>
  );
}
