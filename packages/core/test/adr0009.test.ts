import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/index.js";
import { build, find } from "./fixtures.js";

// ADR-0009: 신호 전용 스크립트(B-6)·개발자 간 동기화(B-5)·명령 실행 지침(B-9)

const en = () => build((d) => { d.language = "en"; });

describe("B-6 신호 전용 스크립트", () => {
  it("settings.json 허용 목록에 signal.sh 가 있고 touch 는 없다", () => {
    const s = JSON.parse(find(build(), ".claude/settings.json")) as { permissions: { allow: string[] } };
    expect(s.permissions.allow).toContain("Bash(bash scripts/signal.sh:*)");
    expect(s.permissions.allow.some((a) => a.startsWith("Bash(touch"))).toBe(false);
  });

  it.each(["scripts/signal.sh", "scripts/sync-dev.sh"])("%s 가 755 로 생성되고 정적 템플릿과 같다", (p) => {
    const f = build().find((x) => x.path === p);
    expect(f?.mode).toBe(0o755);
    expect(f?.author).toBe("template");
    expect(f?.content).toBe((TEMPLATES as Record<string, string>)[`static/${p.slice("scripts/".length)}`]);
  });

  it.each([["ko", build], ["en", en]] as const)("dev·review 에이전트(%s)는 signal.sh 로만 신호를 만든다", (_l, b) => {
    const files = b();
    for (const p of [".claude/agents/dev-1.md", ".claude/agents/review-1.md"]) {
      const md = find(files, p);
      expect(md, p).toContain("bash scripts/signal.sh");
      expect(md, p).not.toContain("$AF_SIGNALS");
      expect(md, p).not.toMatch(/`touch /);
    }
    expect(find(files, ".claude/agents/dev-1.md")).toContain("bash scripts/signal.sh design-1.done");
    expect(find(files, ".claude/agents/review-1.md")).toContain("bash scripts/signal.sh review-1.pass");
  });

  it.each([["ko", build], ["en", en]] as const)("CLAUDE.md 고정 규칙(%s)의 신호 문구가 signal.sh 다", (_l, b) => {
    const md = find(b(), "CLAUDE.md");
    expect(md).toContain("bash scripts/signal.sh <");
    expect(md).not.toContain('touch "$AF_SIGNALS');
  });
});

describe("B-5 개발자 간 동기화", () => {
  it("dev 에이전트는 다른 개발자를 기다릴 때 wait 신호를 낸다(ko·en)", () => {
    expect(find(build(), ".claude/agents/dev-2.md")).toContain("bash scripts/signal.sh dev-2.wait-");
    expect(find(en(), ".claude/agents/dev-2.md")).toContain("bash scripts/signal.sh dev-2.wait-");
  });

  it("wait-and-review.sh 는 wait 신호를 소비하고 sync-dev.sh 안내를 출력한다", () => {
    const w = TEMPLATES["static/wait-and-review.sh"] ?? "";
    expect(w).toContain('"dev-$i.wait-$j"');
    expect(w).toContain("bash scripts/sync-dev.sh $j $i");
  });

  it("README 실행 순서에 sync-dev.sh 안내가 있다(ko·en)", () => {
    expect(find(build(), "README.md")).toContain("bash scripts/sync-dev.sh");
    expect(find(en(), "README.md")).toContain("bash scripts/sync-dev.sh");
  });

  it("analyst 지침에 개발자 간 의존 처리가 있다(ko·en)", () => {
    expect(find(build(), ".claude/agents/analyst.md")).toContain("개발자 간 의존");
    expect(find(en(), ".claude/agents/analyst.md")).toContain("dependencies between developers");
  });
});

describe("B-9 명령 실행 지침", () => {
  it.each([["ko", build, "Bash 리다이렉션"], ["en", en, "Bash redirection"]] as const)("dev·review(%s)에 파일은 Write·Edit 로 쓰라는 지침이 있다", (_l, b, word) => {
    const files = b();
    for (const p of [".claude/agents/dev-1.md", ".claude/agents/review-1.md"]) expect(find(files, p), p).toContain(word);
  });
});
