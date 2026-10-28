import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { DevT, ProjectInput, RenderedFile } from "../src/index.js";
import { build } from "./fixtures.js";

// T-406 대표 구성 6종 스냅샷(project-rules 테스트 기준).
// 내용 전체가 아니라 "경로 모드 작성주체 sha256 앞 12자" 한 줄씩만 고정한다. 내용 diff 는 golden 이 맡는다.

const DOMAINS = ["order", "payment", "admin", "stock", "report", "batch"];
const claude = (model: string) => ({ provider: "claude" as const, model });

function dev(i: number): DevT {
  const d = DOMAINS[i]!;
  return { domain: d, paths: [`src/${d}/`, `tests/${d}/`], dev: claude("sonnet"), review: claude("sonnet") };
}
function withDevCount(d: ProjectInput, n: number): void {
  d.developerCount = n;
  d.devs = Array.from({ length: n }, (_, i) => dev(i));
}

const CONFIGS: Record<string, (d: ProjectInput) => void> = {
  "기본": () => {},
  "UI 끔": (d) => (d.uiDesign = false),
  "개발자 1명": (d) => withDevCount(d, 1),
  "개발자 6명": (d) => withDevCount(d, 6),
  "개발자 정보 비움": (d) => Object.assign(d.devs[1]!, { domain: "", paths: [] }),
  "LiteLLM + 마켓 가져오기": (d) => {
    d.agents.planner = { provider: "openai", model: "gpt-5.5" };
    d.devs[0]!.dev = { provider: "gemini", model: "gemini-2.5-pro" };
    d.imported.push({ id: "market-lint", src: "github.com/example/skills", trust: "community", desc: "린트 규칙", flags: ["network"], target: "dev", acknowledged: true });
  },
};

function summarize(files: readonly RenderedFile[]): string {
  const lines = files.map((f) => `${f.mode.toString(8)} ${f.author === "ai-fill" ? "ai" : "tp"} ${createHash("sha256").update(f.content).digest("hex").slice(0, 12)} ${f.path}`);
  return [`files=${files.length}`, ...lines].join("\n");
}

describe("T-406 대표 구성 스냅샷", () => {
  it.each(Object.keys(CONFIGS))("구성 스냅샷: %s", (name) => {
    const files = build(CONFIGS[name]!);
    expect(files.length).toBeGreaterThan(30);
    expect(summarize(files)).toMatchSnapshot();
  });

  it("구성 6종이 서로 다른 결과를 낸다", () => {
    const sums = Object.keys(CONFIGS).map((n) => summarize(build(CONFIGS[n]!)));
    expect(new Set(sums).size).toBe(6);
  });

  it("LiteLLM 구성에만 litellm.yaml·start-gateway.sh 가 생긴다", () => {
    const has = (n: string) => build(CONFIGS[n]!).some((f) => f.path === ".agentforge/litellm.yaml");
    expect(has("LiteLLM + 마켓 가져오기")).toBe(true);
    expect(has("기본")).toBe(false);
  });
});
