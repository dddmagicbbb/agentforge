import type { RenderContext } from "./context.js";

// .claude/settings.json: env.local 읽기 거부, push·merge·checkout·rm -rf 거부를 항상 포함(보안 규칙), guard hook(DEV-03, 파일 변경 도구 4종 — ADR-0005)

export function renderSettings(c: RenderContext): string {
  const allow = ["Read", "Edit", "Write", "Glob", "Grep", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git log:*)", "Bash(bash scripts/signal.sh:*)", "Bash(bash scripts/check-forge.sh)"];
  // ADR-0009: 신호는 변수 없는 고정 명령(signal.sh)으로만 만든다. touch "$AF_SIGNALS/…" 는 변수 때문에 매번 승인 창이 떴다
  for (const cmd of [c.p.commands.test, c.p.commands.e2e].filter((x) => x !== "")) {
    const rule = `Bash(${cmd.trim()}:*)`;
    if (!allow.includes(rule)) allow.push(rule);
  }
  return `${JSON.stringify(
    {
      permissions: {
        defaultMode: "default", // S-3: pane 을 auto mode 가 아닌 기본 권한 모드로 시작
        allow,
        deny: ["Bash(git push:*)", "Bash(git merge:*)", "Bash(git checkout:*)", "Bash(git switch:*)", "Bash(rm -rf:*)", "Read(.agentforge/env.local)"],
      },
      hooks: { PreToolUse: [{ matcher: "Edit|Write|MultiEdit|NotebookEdit", hooks: [{ type: "command", command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/guard-paths.sh' }] }] },
    },
    null,
    2,
  )}\n`;
}
