import type { RenderContext } from "./context.js";

// README.md: 받은 뒤 실행 순서(RTN-01: UI/UX 단계는 토글을 따른다). language: en 이면 영어(I18N-01).

export function renderReadme(c: RenderContext): string {
  const { p, slug } = c;
  const en = p.language === "en";
  const steps = en
    ? [
        "bash scripts/setup.sh                     # check tools, permissions, env.local, first commit",
        "claude                                    # log in yourself once",
        "bash scripts/run-role.sh planner          # in the session: /forge-init -> review and approve the PRD",
        'bash scripts/run-role.sh analyst "Analyze docs/prd.md and write analysis.md and tasks.md"',
        ...(p.uiDesign ? ['bash scripts/run-role.sh ux-designer "Write the UI/UX design"'] : []),
        'bash scripts/run-role.sh architect "Write the system design"',
        'git checkout -b develop && bash scripts/run-role.sh common-dev "Carry out the common tasks in docs/tasks.md"',
        "claude                                    # lead session: /forge-agents -> bash scripts/check-forge.sh -> commit",
        `bash scripts/create-worktrees.sh && bash scripts/run-agents.sh && tmux attach -t ${slug}`,
        "bash scripts/integrate.sh                 # after everyone has passed",
      ]
    : [
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
  const routine = p.uiDesign
    ? en
      ? "Planning -> Analysis -> (UI/UX design: optional) -> System design"
      : "기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계"
    : en
      ? "Planning -> Analysis -> System design"
      : "기획 → 분석 → 시스템 설계";
  const devNote =
    p.devcontainer === true
      ? en
        ? "\n\nDev Container: you can open the project with .devcontainer/devcontainer.json. On a closed network, replace the image and the package installs in postCreateCommand with your internal registry or mirror. Enter env.local yourself inside the container."
        : "\n\nDev Container: .devcontainer/devcontainer.json 으로 열 수 있다. 폐쇄망이면 image 와 postCreateCommand 의 패키지 설치를 사내 레지스트리·미러 이미지로 바꾼다. env.local 은 컨테이너 안에서 직접 넣는다."
      : "";
  if (en) {
    return `# ${slug} — AgentForge development environment

Requirements: .agentforge/requirements.md · Settings: .agentforge/forge.config.json

## Routine
${routine} -> Common development -> [Detailed design + development] (parallel) -> Development review (parallel) -> Integration verification

## Steps (WSL Ubuntu, or a Linux/macOS terminal)
${steps.map((s, i) => `${i + 1}. \`${s}\``).join("\n")}

At the end of each stage a human checks the gate and commits. A human moves between stages.
Permissions: .claude/settings.json starts in the default permission mode (defaultMode: default), so Bash commands outside the allow list need approval.${devNote}
`;
  }
  return `# ${slug} — AgentForge 개발 환경

요구사항: .agentforge/requirements.md · 설정: .agentforge/forge.config.json

## 루틴
${routine} → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증

## 실행 순서 (WSL Ubuntu 또는 Linux·macOS 터미널)
${steps.map((s, i) => `${i + 1}. \`${s}\``).join("\n")}

단계가 끝날 때마다 사람이 관문을 확인하고 커밋한다. 단계 전환은 사람이 한다.
권한: .claude/settings.json 은 기본 권한 모드(defaultMode: default)로 시작해 allow 목록 밖의 Bash 명령은 승인을 거친다.${devNote}
`;
}
