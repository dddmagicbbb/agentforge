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

/** tmux 배치 미리보기: 0:watch + 개발자별 dev/review 창(PoC tmuxPreview) */
export function TmuxPreview({ draft }: { draft: ProjectInput }) {
  const { t } = useTranslation();
  const label = useAgentLabel();
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
        {draft.devs.map((d, i) => (
          <div className="win" key={i} data-testid="tmux-window">
            <span className="wn">{`${i + 1}:dev${i + 1}`}</span>
            <div className="panes">
              <div className="pane d"><b>{`dev-${i + 1}`}</b><span>{label(d.dev)}</span></div>
              <div className="pane r"><b>{`review-${i + 1}`}</b><span>{label(d.review)}</span></div>
            </div>
          </div>
        ))}
      </div>
      <span className="bar">{`[${draft.name}] 0:watch ${draft.devs.map((_, i) => `${i + 1}:dev${i + 1}`).join(" ")}`}</span>
    </div>
  );
}
