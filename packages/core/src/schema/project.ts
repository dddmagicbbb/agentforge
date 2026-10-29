import { z } from "zod";
import { Command, Domain, GitBranch, HttpsUrl, HttpUrl, ModelId, PathPrefix, ProjectName, SkillFilePath, SkillName } from "./patterns.js";
import { invariants } from "./invariants.js";

export const PROVIDER_IDS = ["claude", "openrouter", "ollama", "vllm", "openai", "gemini"] as const;
export const ProviderId = z.enum(PROVIDER_IDS);

/** 순차 단계 에이전트(RTN-02). ux-designer는 uiDesign=false면 렌더하지 않는다. */
export const SEQ_AGENT_IDS = ["planner", "analyst", "ux-designer", "architect", "common-dev", "integrator"] as const;
export const SeqAgentId = z.enum(SEQ_AGENT_IDS);

export const MAX_DEVELOPERS = 6;

export const AgentModel = z.object({
  provider: ProviderId,
  model: ModelId,
});

export const Dev = z.object({
  domain: z.union([Domain, z.literal("")]),
  paths: z.array(PathPrefix).max(10),
  dev: AgentModel,
  review: AgentModel,
});

/** 가져온 스킬의 파일 1개(MKT-02, ADR-0007). 경로는 스킬 폴더 기준 상대 경로. */
export const ImportedFile = z.object({
  path: SkillFilePath,
  content: z.string().max(200_000),
});

/** 마켓플레이스에서 가져온 스킬(MKT-01·02). files 가 없으면 출처 안내만 렌더(PoC 호환). */
export const ImportedSkill = z.object({
  id: SkillName,
  src: z.string().min(1).max(200),
  trust: z.enum(["official", "org", "community", "unverified"]),
  desc: z.string().max(300),
  flags: z.array(z.string().max(200)),
  target: z.enum(["all", "dev", "review"]),
  acknowledged: z.boolean(),
  /** 출처 커밋(sources.lock 에 기록) */
  ref: z.string().regex(/^[0-9a-f]{7,40}$/, { error: "SKILL_REF" }).optional(),
  /** 출처 저장소의 SKILL.md 와 하위 파일 원문. 최대 50개 */
  files: z.array(ImportedFile).max(50).optional(),
});

/** GitHub·GHES 내보내기 대상(EXP-02, P1). 토큰은 스키마에 두지 않는다. */
export const GithubTarget = z.object({
  owner: z.string().regex(/^[A-Za-z0-9-]{1,39}$/, { error: "GITHUB_OWNER" }),
  repo: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/, { error: "GITHUB_REPO" }),
  visibility: z.enum(["private", "public"]),
  /** create: 새 저장소 + 커밋 1건, pr: 기존 저장소에 브랜치 + PR (기본 create) */
  mode: z.enum(["create", "pr"]).optional(),
  /** GHES API 주소(예: https://ghe.example.com/api/v3). 없으면 github.com */
  baseUrl: HttpsUrl.optional(),
  /** pr 모드 브랜치 이름(기본 agentforge/setup) */
  branch: GitBranch.optional(),
});

export const TmuxConfig = z.object({
  layout: z.enum(["pair", "grid", "role"]),
  prefix: z.string().regex(/^C-[a-z]$/, { error: "TMUX_PREFIX" }),
  mouse: z.boolean(),
  logs: z.boolean(),
});

const ProjectObject = z.object({
  schemaVersion: z.literal(1),
  name: ProjectName,
  language: z.enum(["ko", "en"]),
  requirement: z.string().max(20_000),
  uiDesign: z.boolean(),
  commands: z.object({
    install: Command,
    test: Command,
    e2e: z.union([Command, z.literal("")]),
  }),
  maxRejects: z.number().int().min(2).max(5),
  agents: z.object(
    Object.fromEntries(SEQ_AGENT_IDS.map((id) => [id, AgentModel])) as Record<(typeof SEQ_AGENT_IDS)[number], typeof AgentModel>,
  ),
  developerCount: z.number().int().min(1).max(MAX_DEVELOPERS),
  devs: z.array(Dev).min(1).max(MAX_DEVELOPERS),
  skills: z.object({ conventions: z.boolean(), tdd: z.boolean() }),
  imported: z.array(ImportedSkill),
  connections: z.object({
    vllmUrl: z.union([HttpUrl, z.literal("")]),
    ollamaUrl: HttpUrl,
  }),
  // ── P1 자리: 스키마만 정의, 렌더러는 해당 단계에서 구현 ──
  tmux: TmuxConfig.optional(), // RUN-04
  devcontainer: z.boolean().optional(), // VSC-02
  export: z.object({ github: GithubTarget.optional() }).optional(), // EXP-02
});

export const ProjectSchema = ProjectObject.superRefine(invariants).brand<"Project">();

/** 검증을 통과한 프로젝트. render()는 이 타입만 받는다. */
export type Project = z.output<typeof ProjectSchema>;
/** 화면이 편집하는 입력(검증 전). */
export type ProjectInput = z.input<typeof ProjectObject>;
export type ProjectShape = z.output<typeof ProjectObject>;
export type ProviderIdT = z.infer<typeof ProviderId>;
export type SeqAgentIdT = z.infer<typeof SeqAgentId>;
export type AgentModelT = z.infer<typeof AgentModel>;
export type DevT = z.infer<typeof Dev>;
export type ImportedSkillT = z.infer<typeof ImportedSkill>;
export type GithubTargetT = z.infer<typeof GithubTarget>;
