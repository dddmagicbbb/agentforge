import type { RenderContext } from "./context.js";

// README.md: 받은 뒤 실행 순서(RTN-01: UI/UX 단계는 토글을 따른다)

export function renderReadme(c: RenderContext): string {
  const { p, slug } = c;
  const steps = [
    "bash scripts/setup.sh                     # 도구 확인, 실행 권한, env.local, 첫 커밋",
    "claude                                    # 처음 한 번 직접 로그인",
    "bash scripts/run-role.sh planner          # 세션에서 /forge-init → PRD 검토·승인",
    'bash scripts/run-role.sh analyst "docs/prd.md 를 분석해 analysis.md 와 tasks.md 를 작성하세요"',
    ...(p.uiDesign ? ['bash scripts/run-role.sh ux-designer "UI/UX 설계를 작성하세요"'] : []),
    'bash scripts/run-role.sh architect "시스템 설계를 작성하세요"',
    'git checkout -b develop && bash scripts/run-role.sh common-dev "docs/tasks.md 의 common 작업을 진행하세요"',
    "claude                                    # 리드 세션에서 /forge-agents → bash scripts/check-forge.sh → 커밋",
    `bash scripts/create-worktrees.sh && bash scripts/run-agents.sh && tmux attach -t ${slug}`,
    "bash scripts/integrate.sh                 # 전원 통과 후",
  ];
  const routine = p.uiDesign ? "기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계" : "기획 → 분석 → 시스템 설계";
  return `# ${slug} — AgentForge 개발 환경

요구사항: .agentforge/requirements.md · 설정: .agentforge/forge.config.json

## 루틴
${routine} → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증

## 실행 순서 (WSL Ubuntu 또는 Linux·macOS 터미널)
${steps.map((s, i) => `${i + 1}. \`${s}\``).join("\n")}

단계가 끝날 때마다 사람이 관문을 확인하고 커밋한다. 단계 전환은 사람이 한다.
권한: .claude/settings.json 은 기본 권한 모드(defaultMode: default)로 시작해 Bash 쓰기가 승인을 거치게 한다.
`;
}
