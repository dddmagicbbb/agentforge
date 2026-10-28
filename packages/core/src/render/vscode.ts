// .vscode/tasks.json: 작업 메뉴(VSC-01). 입력과 무관한 고정 6작업.

export function renderVscodeTasks(): string {
  return `${JSON.stringify(
    {
      version: "2.0.0",
      tasks: [
        { label: "AF: 준비(setup)", type: "shell", command: "bash scripts/setup.sh" },
        { label: "AF: worktree 생성", type: "shell", command: "bash scripts/create-worktrees.sh" },
        { label: "AF: 병렬 실행", type: "shell", command: "bash scripts/run-agents.sh && tmux attach -t ${workspaceFolderBasename}", presentation: { panel: "dedicated", focus: true } },
        { label: "AF: 붙기", type: "shell", command: "tmux attach -t ${workspaceFolderBasename}", presentation: { panel: "dedicated", focus: true } },
        { label: "AF: 구성 검사", type: "shell", command: "bash scripts/check-forge.sh" },
        { label: "AF: 통합 검증", type: "shell", command: "bash scripts/integrate.sh" },
      ],
    },
    null,
    2,
  )}\n`;
}
