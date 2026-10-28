import { provider, type Via } from "../providers/index.js";
import { devReady, SEQ_AGENT_IDS, type AgentModelT, type DevT, type Project, type SeqAgentIdT } from "../schema/index.js";

// PoC 파생 규칙(allAgents, label, fmModel, devSkill …)을 한곳에 모은다. 모든 렌더러가 이 문맥만 읽는다.

export interface SeqStep {
  readonly id: SeqAgentIdT;
  readonly step: string;
  readonly optional?: boolean;
}

/** 순차 단계(PoC SEQ + FINAL). integrator 는 마지막 단계. */
export const SEQ: readonly SeqStep[] = [
  { id: "planner", step: "기획" },
  { id: "analyst", step: "분석" },
  { id: "ux-designer", step: "UI/UX 설계", optional: true },
  { id: "architect", step: "시스템 설계" },
  { id: "common-dev", step: "공통 개발" },
];
export const FINAL: SeqStep = { id: "integrator", step: "통합 검증" };

export interface CoreSkill {
  readonly id: "conventions" | "tdd" | "detail-design" | "code-review" | "forge-init" | "forge-agents";
  readonly layer: string;
  readonly to: string;
  readonly fixed: boolean;
}

/** 내장 스킬(SKL-01, GEN-01·02). fixed=false 는 skills 토글을 따른다. */
export const CORE_SKILLS: readonly CoreSkill[] = [
  { id: "conventions", layer: "공통", to: "dev-* · review-* · common-dev", fixed: false },
  { id: "tdd", layer: "공통", to: "dev-* · common-dev", fixed: false },
  { id: "detail-design", layer: "역할", to: "dev-*", fixed: true },
  { id: "code-review", layer: "역할", to: "review-* · integrator", fixed: true },
  { id: "forge-init", layer: "생성", to: "사용자가 /forge-init 으로 실행", fixed: true },
  { id: "forge-agents", layer: "생성", to: "사용자가 /forge-agents 로 실행", fixed: true },
];

export const IMPORT_TARGET_LABEL = { all: "dev-* · review-* 전원", dev: "dev-* 전원", review: "review-* 전원" } as const;
export const TRUST_LABEL = { official: "공식", org: "조직 승인", community: "커뮤니티", unverified: "미검증" } as const;

export class RenderContext {
  constructor(readonly p: Project) {}

  get slug(): string {
    return this.p.name;
  }

  seqActive(): SeqStep[] {
    return SEQ.filter((s) => !s.optional || this.p.uiDesign);
  }

  /** 모든 에이전트 → 모델(PoC allAgents 순서: 순차 → dev/review 쌍 → integrator) */
  allAgents(): [string, AgentModelT][] {
    const out: [string, AgentModelT][] = this.seqActive().map((s) => [s.id, this.p.agents[s.id]]);
    this.p.devs.forEach((d, i) => {
      out.push([`dev-${i + 1}`, d.dev], [`review-${i + 1}`, d.review]);
    });
    out.push([FINAL.id, this.p.agents[FINAL.id]]);
    return out;
  }

  usesVia(via: Via): boolean {
    return this.allAgents().some(([, a]) => provider(a.provider).via === via);
  }

  enabledSkill(id: CoreSkill["id"]): boolean {
    const s = CORE_SKILLS.find((k) => k.id === id);
    return !!s && (s.fixed || (id === "conventions" ? this.p.skills.conventions : id === "tdd" ? this.p.skills.tdd : false));
  }

  readyDevs(): { d: DevT; n: number }[] {
    return this.p.devs.map((d, i) => ({ d, n: i + 1 })).filter(({ d }) => devReady(d));
  }

  importedFor(target: "dev" | "review"): string[] {
    return this.p.imported.filter((m) => m.target === "all" || m.target === target).map((m) => m.id);
  }
}

export function devSkill(d: DevT, n: number): string {
  return `dev${n}-${d.domain}`;
}

/** 에이전트 frontmatter model: Claude 는 별칭, 그 외는 agent-env.sh 가 정하므로 inherit(PRV-01) */
export function fmModel(a: AgentModelT): string {
  return a.provider === "claude" ? a.model || "sonnet" : "inherit";
}

/** 표시용 "제공자 · 모델" (PoC label) */
export function label(a: AgentModelT): string {
  if (a.provider === "claude") return `Claude ${a.model}`;
  return `${provider(a.provider).label.replace(/·LiteLLM| 로컬/, "")} · ${a.model || "모델 미입력"}`;
}

export const ALL_SEQ_IDS = SEQ_AGENT_IDS;
