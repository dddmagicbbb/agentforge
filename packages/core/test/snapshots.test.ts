import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resizeDevs, type DevT, type ProjectInput, type RenderedFile } from "../src/index.js";
import { build } from "./fixtures.js";

// T-406 대표 구성 6종 스냅샷(project-rules 테스트 기준).
// 내용 전체가 아니라 "경로 모드 작성주체 sha256 앞 12자" 한 줄씩만 고정한다. 내용 diff 는 golden 이 맡는다.

const DOMAINS = ["order", "payment", "admin", "stock", "report", "batch"];

function fillDev(d: ProjectInput, i: number): void {
  const dom = DOMAINS[i]!;
  Object.assign(d.devs[i]!, { domain: dom, paths: [`src/${dom}/`, `tests/${dom}/`] } satisfies Partial<DevT>);
}
/** resizeDevs 로 인원을 바꾸고, 새로 생긴(빈) 개발자는 도메인을 채운다. */
function withDevCount(d: ProjectInput, n: number): void {
  Object.assign(d, resizeDevs(d, n));
  for (let i = 0; i < n; i++) if (d.devs[i]!.domain === "") fillDev(d, i);
}

const CONFIGS: Record<string, (d: ProjectInput) => void> = {
  "기본": () => {},
  "UI 끔": (d) => (d.uiDesign = false),
  "개발자 1명": (d) => withDevCount(d, 1),
  "개발자 6명": (d) => withDevCount(d, 6),
  "개발자 정보 비움": (d) => d.devs.forEach((x) => Object.assign(x, { domain: "", paths: [] })),
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

  it("개발자 정보 전원 비움이면 dev-N·review-N·devN- 파일이 하나도 없다", () => {
    const files = build(CONFIGS["개발자 정보 비움"]!);
    expect(files.filter((f) => /(^|\/)(dev|review)-\d|\/dev\d+-/.test(f.path))).toEqual([]);
  });

  it("개발자 1명·6명 구성의 dev 에이전트 수", () => {
    const n = (name: string) => build(CONFIGS[name]!).filter((f) => /^\.claude\/agents\/dev-\d\.md$/.test(f.path)).length;
    expect(n("개발자 1명")).toBe(1);
    expect(n("개발자 6명")).toBe(6);
  });

  it("LiteLLM 구성에만 litellm.yaml·start-gateway.sh 가 생긴다", () => {
    const has = (n: string) => build(CONFIGS[n]!).some((f) => f.path === ".agentforge/litellm.yaml");
    expect(has("LiteLLM + 마켓 가져오기")).toBe(true);
    expect(has("기본")).toBe(false);
  });
});
