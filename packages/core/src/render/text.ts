import type { Project, SeqAgentIdT } from "../schema/index.js";
import type { CoreSkill } from "./context.js";

// 사람이 읽는 생성물의 언어별 문구(I18N-01). 정적 스크립트 출력 문구는 범위 밖(한국어 유지, ADR-0006).
// ko 값은 PH5 출력과 바이트 단위로 같아야 한다(golden·스냅샷 불변).

export type Lang = Project["language"];

export interface Text {
  readonly claudeTitle: string;
  readonly langLine: string;
  readonly claudeRequirement: string;
  readonly routineTitle: string;
  readonly routineUi: string;
  readonly routineNoUi: string;
  readonly claudeStageNote: string;
  readonly claudeParallelTitle: string;
  readonly claudeParallel: readonly string[];
  readonly projectPlaceholder: string;
  readonly agentsHead: string;
  readonly devsHead: string;
  readonly devsPending: string;
  readonly skillsHead: string;
  readonly devOnlyLayer: string;
  readonly modelMissing: string;
  readonly vllmLabel: string;
  readonly step: Readonly<Record<SeqAgentIdT, string>>;
  readonly layer: Readonly<Record<CoreSkill["group"], string>>;
  readonly to: Readonly<Record<CoreSkill["id"], string>>;
  readonly importTarget: Readonly<Record<"all" | "dev" | "review", string>>;
  readonly trust: Readonly<Record<"official" | "org" | "community" | "unverified", string>>;
  readonly features: (n: string) => string;
  readonly uiReadReview: string;
  readonly pathsComment: string;
  readonly importedBody: (src: string, trust: string) => string;
  readonly prdUi: string;
  readonly prdNoUi: string;
  readonly langName: string;
  readonly envHead: string;
  readonly envNone: string;
  readonly litellmHead: string;
  readonly imported: string;
  readonly agentEnvUsage: string;
  readonly vscodeTasks: readonly string[];
  readonly readmeSteps: (slug: string, uiDesign: boolean) => string[];
  readonly readmeRoutine: (uiDesign: boolean) => string;
  readonly readmeDevNote: string;
  readonly readmeImportedNote: string;
  readonly readmeBody: (slug: string, routine: string, steps: string, devNote: string) => string;
}

const ko: Text = {
  claudeTitle: "# 프로젝트 규칙",
  langLine: "모든 답변과 문서는 한국어로 쓴다. 코드 식별자는 영어.",
  claudeRequirement: "요구사항 기준은 docs/prd.md(기능 ID), 작업 배정은 docs/tasks.md.",
  routineTitle: "## 개발 루틴",
  routineUi: "기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증",
  routineNoUi: "기획 → 분석 → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증",
  claudeStageNote: "단계 전환은 사람이 한다. 관문 조건을 확인해 보고만 하고 다음 단계를 시작하지 않는다.",
  claudeParallelTitle: "## 병렬 개발 기본 기준",
  claudeParallel: [
    "각 개발자는 자기 worktree(feature/devN)에서만 작업한다. 브랜치를 바꾸거나 병합하지 않는다.",
    "담당 범위는 .claude/devs/<에이전트>.paths. 범위 밖 변경이 필요하면 report에 적고 멈춘다.",
    "API 계약·공통 모듈은 읽기 전용. 변경은 리드가 develop에서만 한다.",
    "테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.",
    "커밋 메시지: [에이전트] 작업ID 요약",
    "완료·요청은 신호 파일로 알린다: bash scripts/signal.sh <신호>",
  ],
  projectPlaceholder: "(/forge-init 이 채움: 소개, 기술 스택, 명령어, 폴더 구조)",
  agentsHead: "| 에이전트 | 단계 | 모델 |",
  devsHead: "| 에이전트 | 도메인 | 담당 폴더 | 모델(개발 / 검증) |",
  devsPending: "(분석 후 /forge-agents)",
  skillsHead: "| 스킬 | 계층 | 사용 에이전트 |",
  devOnlyLayer: "개발자 전용",
  modelMissing: "모델 미입력",
  vllmLabel: "사내 vLLM",
  step: { planner: "기획", analyst: "분석", "ux-designer": "UI/UX 설계", architect: "시스템 설계", "common-dev": "공통 개발", integrator: "통합 검증" },
  layer: { common: "공통", role: "역할", gen: "생성" },
  to: {
    conventions: "dev-* · review-* · common-dev",
    tdd: "dev-* · common-dev",
    "detail-design": "dev-*",
    "code-review": "review-* · integrator",
    "forge-init": "사용자가 /forge-init 으로 실행",
    "forge-agents": "사용자가 /forge-agents 로 실행",
  },
  importTarget: { all: "dev-* · review-* 전원", dev: "dev-* 전원", review: "review-* 전원" },
  trust: { official: "공식", org: "조직 승인", community: "커뮤니티", unverified: "미검증" },
  features: (n) => `docs/tasks.md 의 dev-${n} 항목(분석 후 /forge-agents 가 기능 ID로 갱신)`,
  uiReadReview: "·화면 설계",
  pathsComment: "# 저장소 루트 기준 접두어, 한 줄에 하나",
  importedBody: (src, trust) => `출처: ${src} (${trust})\nPoC 자리표시입니다. 정식 버전은 가져오기 시 출처 저장소의 SKILL.md 원문과 하위 파일을 그대로 넣습니다.\n`,
  prdUi: "- 화면 목록은 UI/UX 설계 단계(docs/design/ui/screens.md)에서 확정한다. 여기에는 화면이 필요한 기능만 적는다.",
  prdNoUi: "해당 없음 (UI/UX 설계 단계를 쓰지 않는 프로젝트)",
  langName: "한국어",
  envHead: "# .agentforge/env.local 로 복사해 직접 입력 (git 제외, chmod 600). AgentForge는 값을 받거나 저장하지 않습니다.",
  envNone: "# 모든 에이전트가 Claude 로그인을 사용합니다. 넣을 값이 없습니다.",
  litellmHead: "# LiteLLM 게이트웨이: OpenAI·Gemini 를 Claude Code가 쓰는 Anthropic 형식으로 중계",
  imported: "가져옴",
  agentEnvUsage: "에이전트명을 넣으세요",
  vscodeTasks: ["AF: 준비(setup)", "AF: worktree 생성", "AF: 병렬 실행", "AF: 붙기", "AF: 구성 검사", "AF: 통합 검증", "AF: 모델 점검"],
  readmeSteps: (slug, ui) => [
    "bash scripts/setup.sh                     # 도구 확인, 실행 권한, env.local, 첫 커밋",
    "claude                                    # 처음 한 번 직접 로그인",
    "bash scripts/run-role.sh planner          # 세션에서 /forge-init → PRD 검토·승인",
    'bash scripts/run-role.sh analyst "docs/prd.md 를 분석해 analysis.md 와 tasks.md 를 작성하세요"',
    ...(ui ? ['bash scripts/run-role.sh ux-designer "UI/UX 설계를 작성하세요"'] : []),
    'bash scripts/run-role.sh architect "시스템 설계를 작성하세요"',
    'git checkout -b develop && bash scripts/run-role.sh common-dev "docs/tasks.md 의 common 작업을 진행하세요"',
    "claude                                    # 리드 세션에서 /forge-agents → bash scripts/check-forge.sh → 커밋",
    `bash scripts/create-worktrees.sh && bash scripts/run-agents.sh && tmux attach -t ${slug}`,
    "bash scripts/sync-dev.sh <i> <j>          # 병렬 중 dev-j 가 dev-i 결과를 기다릴 때(감시 창 안내, dev-i 통과 후)",
    "bash scripts/integrate.sh                 # 전원 통과 후",
  ],
  readmeRoutine: (ui) => (ui ? "기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계" : "기획 → 분석 → 시스템 설계"),
  readmeImportedNote: "\n\n가져온 스킬: 출처와 해시는 .agentforge/sources.lock 에 있다. 스킬 파일은 실행 권한 없이 넣었으므로 필요하면 직접 chmod 한다.",
  readmeDevNote: "\n\nDev Container: .devcontainer/devcontainer.json 으로 열 수 있다. 폐쇄망이면 image 와 postCreateCommand 의 패키지 설치를 사내 레지스트리·미러 이미지로 바꾼다. env.local 은 컨테이너 안에서 직접 넣는다.",
  readmeBody: (slug, routine, steps, devNote) => `# ${slug} — AgentForge 개발 환경

요구사항: .agentforge/requirements.md · 설정: .agentforge/forge.config.json

## 루틴
${routine} → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증

## 실행 순서 (WSL Ubuntu 또는 Linux·macOS 터미널)
${steps}

단계가 끝날 때마다 사람이 관문을 확인하고 커밋한다. 단계 전환은 사람이 한다.
권한: .claude/settings.json 은 기본 권한 모드(defaultMode: default)로 시작해 allow 목록 밖의 Bash 명령은 승인을 거친다.${devNote}
`,
};

const en: Text = {
  claudeTitle: "# Project rules",
  langLine: "Write all answers and documents in English. Code identifiers in English.",
  claudeRequirement: "The requirements baseline is docs/prd.md (feature IDs); task assignment is docs/tasks.md.",
  routineTitle: "## Development routine",
  routineUi: "Planning -> Analysis -> (UI/UX design: optional) -> System design -> Common development -> [Detailed design + development] (parallel) -> Development review (parallel) -> Integration verification",
  routineNoUi: "Planning -> Analysis -> System design -> Common development -> [Detailed design + development] (parallel) -> Development review (parallel) -> Integration verification",
  claudeStageNote: "A human moves between stages. Check the gate conditions and report only; do not start the next stage.",
  claudeParallelTitle: "## Parallel development basics",
  claudeParallel: [
    "Each developer works only in their own worktree (feature/devN). Do not switch or merge branches.",
    "The owned scope is .claude/devs/<agent>.paths. If a change outside it is needed, write it in the report and stop.",
    "API contracts and common modules are read-only. Only the lead changes them, on develop.",
    "Write the tests first, confirm they fail, then implement.",
    "Commit message: [agent] task-ID summary",
    "Report completion and requests with signal files: bash scripts/signal.sh <signal>",
  ],
  projectPlaceholder: "(filled in by /forge-init: introduction, tech stack, commands, folder structure)",
  agentsHead: "| Agent | Stage | Model |",
  devsHead: "| Agent | Domain | Owned folders | Model (dev / review) |",
  devsPending: "(/forge-agents after analysis)",
  skillsHead: "| Skill | Layer | Used by |",
  devOnlyLayer: "Developer-specific",
  modelMissing: "model not set",
  vllmLabel: "On-prem vLLM",
  step: { planner: "Planning", analyst: "Analysis", "ux-designer": "UI/UX design", architect: "System design", "common-dev": "Common development", integrator: "Integration verification" },
  layer: { common: "Common", role: "Role", gen: "Generated" },
  to: {
    conventions: "dev-* · review-* · common-dev",
    tdd: "dev-* · common-dev",
    "detail-design": "dev-*",
    "code-review": "review-* · integrator",
    "forge-init": "run by the user with /forge-init",
    "forge-agents": "run by the user with /forge-agents",
  },
  importTarget: { all: "all dev-* · review-*", dev: "all dev-*", review: "all review-*" },
  trust: { official: "official", org: "org-approved", community: "community", unverified: "unverified" },
  features: (n) => `the dev-${n} items in docs/tasks.md (/forge-agents updates this with feature IDs after analysis)`,
  uiReadReview: " / UI design",
  pathsComment: "# Prefixes relative to the repository root, one per line",
  importedBody: (src, trust) => `Source: ${src} (${trust})\nThis is a PoC placeholder. The real version copies the source repository's SKILL.md and its sub-files verbatim when imported.\n`,
  prdUi: "- The screen list is fixed in the UI/UX design stage (docs/design/ui/screens.md). List here only the features that need screens.",
  prdNoUi: "Not applicable (this project does not use the UI/UX design stage)",
  langName: "English",
  envHead: "# Copy to .agentforge/env.local and fill in yourself (excluded from git, chmod 600). AgentForge never receives or stores the values.",
  envNone: "# All agents use the Claude login. There is nothing to fill in.",
  litellmHead: "# LiteLLM gateway: relays OpenAI and Gemini in the Anthropic format that Claude Code uses",
  imported: "imported",
  agentEnvUsage: "Enter an agent name",
  vscodeTasks: ["AF: Setup", "AF: Create worktrees", "AF: Run in parallel", "AF: Attach", "AF: Check config", "AF: Integrate", "AF: Check models"],
  readmeSteps: (slug, ui) => [
    "bash scripts/setup.sh                     # check tools, permissions, env.local, first commit",
    "claude                                    # log in yourself once",
    "bash scripts/run-role.sh planner          # in the session: /forge-init -> review and approve the PRD",
    'bash scripts/run-role.sh analyst "Analyze docs/prd.md and write analysis.md and tasks.md"',
    ...(ui ? ['bash scripts/run-role.sh ux-designer "Write the UI/UX design"'] : []),
    'bash scripts/run-role.sh architect "Write the system design"',
    'git checkout -b develop && bash scripts/run-role.sh common-dev "Carry out the common tasks in docs/tasks.md"',
    "claude                                    # lead session: /forge-agents -> bash scripts/check-forge.sh -> commit",
    `bash scripts/create-worktrees.sh && bash scripts/run-agents.sh && tmux attach -t ${slug}`,
    "bash scripts/sync-dev.sh <i> <j>          # during the parallel stage, when dev-j waits for dev-i (see the watch window; after dev-i passes)",
    "bash scripts/integrate.sh                 # after everyone has passed",
  ],
  readmeRoutine: (ui) => (ui ? "Planning -> Analysis -> (UI/UX design: optional) -> System design" : "Planning -> Analysis -> System design"),
  readmeImportedNote: "\n\nImported skills: sources and hashes are in .agentforge/sources.lock. Skill files are added without execute permission; run chmod yourself if needed.",
  readmeDevNote: "\n\nDev Container: you can open the project with .devcontainer/devcontainer.json. On a closed network, replace the image and the package installs in postCreateCommand with your internal registry or mirror. Enter env.local yourself inside the container.",
  readmeBody: (slug, routine, steps, devNote) => `# ${slug} — AgentForge development environment

Requirements: .agentforge/requirements.md · Settings: .agentforge/forge.config.json

## Routine
${routine} -> Common development -> [Detailed design + development] (parallel) -> Development review (parallel) -> Integration verification

## Steps (WSL Ubuntu, or a Linux/macOS terminal)
${steps}

At the end of each stage a human checks the gate and commits. A human moves between stages.
Permissions: .claude/settings.json starts in the default permission mode (defaultMode: default), so Bash commands outside the allow list need approval.${devNote}
`,
};

export function text(lang: Lang): Text {
  return lang === "en" ? en : ko;
}
