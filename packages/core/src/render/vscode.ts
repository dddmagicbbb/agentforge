import type { Lang } from "./text.js";

// .vscode/tasks.json: 작업 메뉴(VSC-01). 입력과 무관한 고정 7작업(7번째 모델 점검 PRV-03). language: en 이면 작업 이름만 영어.

const LABELS: Record<Lang, readonly string[]> = {
  ko: ["AF: 준비(setup)", "AF: worktree 생성", "AF: 병렬 실행", "AF: 붙기", "AF: 구성 검사", "AF: 통합 검증", "AF: 모델 점검"],
  en: ["AF: Setup", "AF: Create worktrees", "AF: Run in parallel", "AF: Attach", "AF: Check config", "AF: Integrate", "AF: Check models"],
};

export function renderVscodeTasks(lang: Lang = "ko"): string {
  const l = LABELS[lang];
  return `${JSON.stringify(
    {
      version: "2.0.0",
      tasks: [
        { label: l[0], type: "shell", command: "bash scripts/setup.sh" },
        { label: l[1], type: "shell", command: "bash scripts/create-worktrees.sh" },
        { label: l[2], type: "shell", command: "bash scripts/run-agents.sh && tmux attach -t ${workspaceFolderBasename}", presentation: { panel: "dedicated", focus: true } },
        { label: l[3], type: "shell", command: "tmux attach -t ${workspaceFolderBasename}", presentation: { panel: "dedicated", focus: true } },
        { label: l[4], type: "shell", command: "bash scripts/check-forge.sh" },
        { label: l[5], type: "shell", command: "bash scripts/integrate.sh" },
        { label: l[6], type: "shell", command: "bash scripts/check-models.sh" },
      ],
    },
    null,
    2,
  )}\n`;
}
