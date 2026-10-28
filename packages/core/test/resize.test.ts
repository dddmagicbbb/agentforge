import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AppError, defaultDraft, render, resizeDevs, validate, type ProjectInput } from "../src/index.js";

// T-401 DEV-01·DEV-02: 개발자 수 변경과 렌더 일관성

const filled = (n: number) => ({
  domain: `dom${n}`,
  paths: [`src/dom${n}/`],
  dev: { provider: "claude" as const, model: "sonnet" },
  review: { provider: "claude" as const, model: "sonnet" },
});

describe("resizeDevs", () => {
  it("늘리면 빈 claude/sonnet dev 를 추가하고 developerCount 도 맞춘다", () => {
    const r = resizeDevs(defaultDraft(), 5);
    expect(r.developerCount).toBe(5);
    expect(r.devs).toHaveLength(5);
    expect(r.devs[4]).toEqual({ domain: "", paths: [], dev: { provider: "claude", model: "sonnet" }, review: { provider: "claude", model: "sonnet" } });
    expect(r.devs[0]?.domain).toBe("order");
  });

  it("줄이면 뒤쪽을 잘라낸다", () => {
    const r = resizeDevs(defaultDraft(), 1);
    expect(r.devs.map((d) => d.domain)).toEqual(["order"]);
    expect(r.developerCount).toBe(1);
  });

  it("원본을 수정하지 않는다", () => {
    const d = defaultDraft();
    const snap = structuredClone(d);
    resizeDevs(d, 6);
    resizeDevs(d, 1);
    expect(d).toEqual(snap);
  });

  it.each([0, 7, 2.5, NaN, -1])("범위 밖 %s 는 AppError", (n) => {
    expect(() => resizeDevs(defaultDraft(), n)).toThrow(AppError);
    try {
      resizeDevs(defaultDraft(), n);
    } catch (e) {
      expect((e as AppError).code).toBe("DEV_COUNT_RANGE");
    }
  });

  it("3→5→2 후에도 validate 를 통과한다", () => {
    const d = resizeDevs(resizeDevs(defaultDraft(), 5), 2);
    expect(validate(d).issues).toEqual([]);
  });
});

function assertConsistent(d: ProjectInput, n: number) {
  const v = validate(d);
  expect(v.issues).toEqual([]);
  const files = render(v.project!);
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const ready = d.devs.map((x, i) => ({ x, i: i + 1 })).filter(({ x }) => x.domain !== "" && x.paths.length > 0);

  for (let i = 1; i <= n; i++) {
    const isReady = ready.some((r) => r.i === i);
    // ready 아닌 dev 는 에이전트·paths 파일을 전부 생략한다
    for (const p of [`.claude/agents/dev-${i}.md`, `.claude/agents/review-${i}.md`, `.claude/devs/dev-${i}.paths`]) {
      expect(byPath.has(p), p).toBe(isReady);
    }
  }
  // 범위 밖 번호 파일은 없다
  const nums = files.map((f) => /^\.claude\/agents\/(?:dev|review)-(\d+)\.md$/.exec(f.path)?.[1]).filter(Boolean).map(Number);
  expect(nums.every((k) => k >= 1 && k <= n)).toBe(true);

  const env = byPath.get("scripts/agent-env.sh") ?? "";
  for (let i = 1; i <= n; i++) {
    expect(env).toMatch(new RegExp(`^ {2}dev-${i}\\)`, "m"));
    expect(env).toMatch(new RegExp(`^ {2}review-${i}\\)`, "m"));
  }
  expect(env).not.toMatch(new RegExp(`^ {2}dev-${n + 1}\\)`, "m"));
  expect((env.match(/^ {2}(?:dev|review)-\d+\)/gm) ?? []).length).toBe(n * 2);

  const md = byPath.get("CLAUDE.md") ?? "";
  const section = /<!-- AGENTFORGE:DEVS:BEGIN -->\n([\s\S]*?)<!-- AGENTFORGE:DEVS:END -->/.exec(md)?.[1] ?? "";
  expect(section.split("\n").filter((l) => /^\| dev-\d+ \/ review-\d+ /.test(l))).toHaveLength(n);

  expect(JSON.parse(byPath.get(".agentforge/forge.config.json") ?? "{}").developers).toBe(n);
}

describe("DEV-01·02 렌더 일관성", () => {
  it("3→5→2", () => {
    let d = defaultDraft();
    assertConsistent(d, 3);
    d = resizeDevs(d, 5);
    assertConsistent(d, 5);
    d = resizeDevs(d, 2);
    assertConsistent(d, 2);
  });

  it("임의 변경(개발자 수·dev 채움·uiDesign 토글)에도 일관된다", () => {
    const step = fc.record({ n: fc.integer({ min: 1, max: 6 }), ui: fc.boolean(), fill: fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }) });
    fc.assert(
      fc.property(fc.array(step, { minLength: 1, maxLength: 5 }), (steps) => {
        let d = defaultDraft();
        for (const s of steps) {
          d = resizeDevs(d, s.n);
          d.uiDesign = s.ui;
          d.devs = d.devs.map((x, i) => (s.fill[i] ? filled(i + 1) : { ...x, domain: "", paths: [] }));
          assertConsistent(d, s.n);
          const files = render(validate(d).project!).map((f) => f.path);
          expect(files.includes(".claude/agents/ux-designer.md")).toBe(s.ui);
        }
      }),
      { numRuns: 40 },
    );
  });
});
