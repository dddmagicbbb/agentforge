import type { RenderContext } from "./context.js";

// .claude/settings.json: env.local 읽기 거부, push·merge·checkout·rm -rf 거부를 항상 포함(보안 규칙), guard hook(DEV-03)

export function renderSettings(c: RenderContext): string {
  const allow = ["Read", "Edit", "Write", "Glob", "Grep", "Bash(git status:*)", "Bash(git diff:*)", "Bash(git add:*)", "Bash(git commit:*)", "Bash(git log:*)", "Bash(touch:*)", "Bash(bash scripts/check-forge.sh)"];
  for (const cmd of [c.p.commands.test, c.p.commands.e2e].filter((x) => x !== "")) {
    const rule = `Bash(${cmd.trim()}:*)`;
    if (!allow.includes(rule)) allow.push(rule);
  }
  return `${JSON.stringify(
    {
      permissions: {
        allow,
        deny: ["Bash(git push:*)", "Bash(git merge:*)", "Bash(git checkout:*)", "Bash(git switch:*)", "Bash(rm -rf:*)", "Read(.agentforge/env.local)"],
      },
      hooks: { PreToolUse: [{ matcher: "Edit|Write", hooks: [{ type: "command", command: '"$CLAUDE_PROJECT_DIR"/.claude/hooks/guard-paths.sh' }] }] },
    },
    null,
    2,
  )}\n`;
}
