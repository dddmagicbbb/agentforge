import { describe, expect, it } from "vitest";
import { defaultDraft, render, shQuote, validate, type ProjectInput } from "../src/index.js";
import { shWord } from "../src/util/sh.js";

// golden 이 다루지 않는 렌더 규칙: 인용, UI 토글(I7), /forge-agents 위임, 권한

function build(patch: (d: ProjectInput) => void = () => {}) {
  const d = defaultDraft();
  patch(d);
  const v = validate(d);
  expect(v.issues).toEqual([]);
  return render(v.project!);
}
const paths = (files: { path: string }[]) => files.map((f) => f.path);
const content = (files: { path: string; content: string }[], p: string) => files.find((f) => f.path === p)?.content ?? "";

describe("셸 인용", () => {
  it("shQuote 는 작은따옴표를 이스케이프한다", () => {
    expect(shQuote("a'b")).toBe(`'a'\\''b'`);
    expect(shQuote("")).toBe("''");
  });

  it("shWord 는 안전한 단어만 그대로 두고 나머지는 인용한다", () => {
    expect(shWord("qwen/qwen3-coder:free")).toBe("qwen/qwen3-coder:free");
    expect(shWord("http://10.0.0.5:8000")).toBe("http://10.0.0.5:8000");
    expect(shWord("http://h/~x")).toBe("'http://h/~x'"); // 할당문 틸드 확장 방지
    expect(shWord("a b")).toBe("'a b'");
  });
});

describe("RTN-01 UI/UX 설계 토글(I7)", () => {
  const off = build((d) => (d.uiDesign = false));
  it("끄면 ux-designer·docs/design/ui 가 없다", () => {
    expect(paths(off)).not.toContain(".claude/agents/ux-designer.md");
    expect(paths(off).some((p) => p.startsWith("docs/design/ui/"))).toBe(false);
  });
  it("끄면 README·CLAUDE.md 루틴과 forge.config.json 에서 빠진다", () => {
    expect(content(off, "README.md")).not.toContain("ux-designer");
    expect(content(off, "CLAUDE.md")).not.toContain("UI/UX");
    expect(JSON.parse(content(off, ".agentforge/forge.config.json")).agents).not.toHaveProperty("ux-designer");
  });
});

describe("DEV-02 개발자 정보 비움 → /forge-agents 위임", () => {
  const files = build((d) => Object.assign(d.devs[1]!, { domain: "", paths: [] }));
  it("dev-2 관련 파일을 하나도 만들지 않는다", () => {
    expect(paths(files).filter((p) => /dev-2|review-2|dev2-/.test(p))).toEqual([]);
  });
  it("CLAUDE.md DEVS 표에는 위임 행이 남는다", () => {
    expect(content(files, "CLAUDE.md")).toContain("| dev-2 / review-2 | (분석 후 /forge-agents) | - |");
  });
  it("agent-env.sh 에는 dev-2·review-2 분기가 있다(나중에 생성될 에이전트용)", () => {
    expect(content(files, "scripts/agent-env.sh")).toMatch(/^ {2}dev-2\) +_af_use vllm exaone-32b ;;$/m);
  });
});

describe("파일 속성", () => {
  const files = build();
  it(".sh 는 755, 나머지는 644", () => {
    for (const f of files) expect(f.mode).toBe(f.path.endsWith(".sh") ? 0o755 : 0o644);
  });
  it("모든 텍스트는 LF", () => {
    expect(files.filter((f) => f.content.includes("\r"))).toEqual([]);
  });
  it("앱이 채우는 파일에는 자리표시가 남지 않는다(AI용 템플릿 제외)", () => {
    const left = files.filter((f) => !f.path.startsWith(".agentforge/templates/") && f.path !== ".claude/skills/forge-agents/SKILL.md" && /\{\{[A-Z_]+\}\}/.test(f.content));
    expect(left.map((f) => f.path)).toEqual([]);
  });
  it("settings.json 은 env.local 읽기와 push·merge·checkout 을 거부한다", () => {
    const s = JSON.parse(content(files, ".claude/settings.json"));
    expect(s.permissions.deny).toEqual(expect.arrayContaining(["Read(.agentforge/env.local)", "Bash(git push:*)", "Bash(git merge:*)", "Bash(git checkout:*)"]));
  });
});
