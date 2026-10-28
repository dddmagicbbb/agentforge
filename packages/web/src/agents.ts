import type { AgentModelT, ProjectInput, ProviderIdT } from "@agentforge/core";
import { ROUTINE_IDS } from "./catalog";

export interface NamedAgent {
  readonly name: string;
  readonly agent: AgentModelT;
}

/**
 * 이 프로젝트가 실제로 쓰는 에이전트 목록(core checks/render 와 같은 순서):
 * 순차 단계(ux-designer 는 uiDesign 일 때만, integrator 는 마지막) → dev/review 쌍.
 */
export function usedAgents(draft: ProjectInput): NamedAgent[] {
  const seq = ROUTINE_IDS.filter((id) => id !== "integrator" && (id !== "ux-designer" || draft.uiDesign)).map((id) => ({ name: id, agent: draft.agents[id] }));
  const devs = draft.devs.flatMap((d, i) => [
    { name: `dev-${i + 1}`, agent: d.dev },
    { name: `review-${i + 1}`, agent: d.review },
  ]);
  return [...seq, ...devs, { name: "integrator", agent: draft.agents.integrator }];
}

/** 제공자별 에이전트 수. 표시 순서는 호출하는 쪽이 정한다. */
export function countByProvider(draft: ProjectInput): Map<ProviderIdT, number> {
  const m = new Map<ProviderIdT, number>();
  for (const { agent } of usedAgents(draft)) m.set(agent.provider, (m.get(agent.provider) ?? 0) + 1);
  return m;
}
