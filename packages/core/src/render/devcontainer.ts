import type { RenderContext } from "./context.js";

// .devcontainer/devcontainer.json (VSC-02, design.md 8.4). devcontainer: true 일 때만 생성한다.
// 이미지·패키지는 사용자 환경이 내려받는다(앱은 외부를 호출하지 않는다). env.local 은 마운트·복사하지 않는다.

export function renderDevcontainer(c: RenderContext): string {
  return `${JSON.stringify(
    {
      name: c.slug,
      image: "mcr.microsoft.com/devcontainers/javascript-node:22",
      postCreateCommand: "sudo apt-get update && sudo apt-get install -y tmux jq && npm install -g @anthropic-ai/claude-code",
      remoteEnv: { AF_IN_CONTAINER: "1" },
    },
    null,
    2,
  )}\n`;
}
