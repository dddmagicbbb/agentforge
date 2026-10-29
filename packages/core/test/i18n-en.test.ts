import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TEMPLATES, type ProjectInput, type RenderedFile } from "../src/index.js";
import { build, find, fmSkills } from "./fixtures.js";

// T-605 I18N-01: language "en" 생성물 영어판(design.md 8.5)

const keys = Object.keys(TEMPLATES);
const mdKeys = keys.filter((k) => k.startsWith("md/"));
const placeholders = (s: string) => (s.match(/\{\{[A-Z_]+\}\}/g) ?? []).sort();
const HANGUL = /[가-힣]/;
// pane 메시지 머리말 원문(정적 스크립트가 보내는 한국어)을 영어 본문과 잇는 대응표 구간 — 한글 허용 예외
const PANE = /<!-- af:pane-messages -->[\s\S]*?<!-- \/af:pane-messages -->\n?/g;
const stripPane = (s: string) => s.replace(PANE, "");
const hasPane = (s: string) => s.includes("af:pane-messages");

const EN: Record<string, (d: ProjectInput) => void> = {
  "en 기본": (d) => (d.language = "en"),
  "en UI 끔": (d) => {
    d.language = "en";
    d.uiDesign = false;
  },
  "en 개발자 정보 비움": (d) => {
    d.language = "en";
    d.devs.forEach((x) => Object.assign(x, { domain: "", paths: [] }));
  },
  "en LiteLLM + 마켓 가져오기": (d) => {
    d.language = "en";
    d.agents.planner = { provider: "openai", model: "gpt-5.5" };
    d.imported.push({ id: "market-lint", src: "github.com/example/skills", trust: "community", desc: "Lint rules", flags: ["network"], target: "dev", acknowledged: true });
    d.devcontainer = true;
    d.tmux = { layout: "grid", prefix: "C-a", mouse: true, logs: true };
  },
};

describe("md-en 템플릿", () => {
  it("md 16종과 같은 파일명으로 md-en 16종이 내장된다", () => {
    const en = keys.filter((k) => k.startsWith("md-en/")).map((k) => k.slice(6)).sort();
    expect(en).toEqual(mdKeys.map((k) => k.slice(3)).sort());
    expect(en).toHaveLength(16);
  });
  it.each(mdKeys.map((k) => k.slice(3)))("%s: 자리표시 집합(이름·개수)이 ko 와 같다", (name) => {
    expect(placeholders(TEMPLATES[`md-en/${name}` as keyof typeof TEMPLATES])).toEqual(placeholders(TEMPLATES[`md/${name}` as keyof typeof TEMPLATES]));
  });
  it("md-en 본문에 한글이 없다", () => {
    for (const k of keys.filter((x) => x.startsWith("md-en/"))) expect(HANGUL.test(stripPane(TEMPLATES[k as keyof typeof TEMPLATES])), k).toBe(false);
  });
  it("대응표 구간은 dev.tpl.md·review.tpl.md 에만, 각각 정확히 한 쌍 있다", () => {
    const withBlock = keys.filter((k) => hasPane(TEMPLATES[k as keyof typeof TEMPLATES]));
    expect(withBlock.sort()).toEqual(["md-en/dev.tpl.md", "md-en/review.tpl.md"]);
    for (const k of withBlock) {
      const t = TEMPLATES[k as keyof typeof TEMPLATES];
      expect(t.split("<!-- af:pane-messages -->")).toHaveLength(2);
      expect(t.split("<!-- /af:pane-messages -->")).toHaveLength(2);
      expect(t.match(PANE)).toHaveLength(1);
    }
  });
  it("대응표의 머리말이 정적 스크립트가 실제로 보내는 문구와 일치한다", () => {
    const wait = TEMPLATES["static/wait-and-review.sh"];
    const dev = TEMPLATES["md-en/dev.tpl.md"];
    const review = TEMPLATES["md-en/review.tpl.md"];
    for (const h of ["설계 승인", "설계 반려", "코드 반려", "담당 범위 밖 변경이 있습니다"]) {
      expect(wait, h).toContain(h);
      expect(dev, h).toContain(h);
    }
    for (const h of ["설계 검토", "코드 검토"]) {
      expect(wait, h).toContain(h);
      expect(review, h).toContain(h);
    }
  });
  it("templates/md-en 디렉터리에 파일 16개가 있다", () => {
    expect(readdirSync(new URL("../../../templates/md-en/", import.meta.url))).toHaveLength(16);
  });
});

// 제외: 정적 원본 그대로 복사되는 스크립트(내용이 templates/static 과 같은 파일)와 사용자 입력 원문(requirements.md).
// agent-env.sh 는 정적 head 만 빼고 생성된 case 블록을 검사한다.
const staticBodies = new Set<string>(keys.filter((k) => k.startsWith("static/")).map((k) => TEMPLATES[k as keyof typeof TEMPLATES]));
const checked = (f: RenderedFile): string | null => {
  if (f.path === ".agentforge/requirements.md" || staticBodies.has(f.content)) return null;
  return stripPane(f.path === "scripts/agent-env.sh" ? f.content.replace(TEMPLATES["static/agent-env.head"], "") : f.content);
};

describe.each(Object.keys(EN))("%s", (name) => {
  const files = build(EN[name]!);

  it("정적 원본·requirements.md 를 뺀 모든 생성물(agent-env.sh 의 생성 구간 포함)에 한글이 없다", () => {
    for (const f of files) {
      const body = checked(f);
      if (body !== null) expect(HANGUL.test(body), f.path).toBe(false);
    }
    expect(checked(files.find((f) => f.path === "scripts/agent-env.sh")!)).not.toBeNull();
  });
  it("language 가 config 에 en 으로 들어가고 파일 경로 집합은 ko 와 같다", () => {
    expect(JSON.parse(find(files, ".agentforge/forge.config.json")).language).toBe("en");
    const ko = build((d) => {
      EN[name]!(d);
      d.language = "ko";
    });
    expect(files.map((f) => f.path)).toEqual(ko.map((f) => f.path));
  });
  it("check-forge 계약: 에이전트가 참조한 스킬이 존재하고 자리표시가 남지 않는다", () => {
    const have = new Set(files.map((f) => f.path));
    for (const f of files.filter((x) => /^\.claude\/agents\/.+\.md$/.test(x.path))) {
      for (const s of fmSkills(f.content)) expect(have.has(`.claude/skills/${s}/SKILL.md`), `${f.path} -> ${s}`).toBe(true);
    }
    for (const f of files) {
      if (f.path.startsWith(".claude/skills/forge-agents/") || f.path.startsWith(".agentforge/templates/")) continue;
      expect(f.content, f.path).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });
  it("CLAUDE.md: 마커 4구간이 있고 200줄 이하", () => {
    const md = find(files, "CLAUDE.md");
    for (const id of ["PROJECT", "AGENTS", "DEVS", "SKILLS"]) {
      expect(md).toContain(`<!-- AGENTFORGE:${id}:BEGIN -->`);
      expect(md).toContain(`<!-- AGENTFORGE:${id}:END -->`);
    }
    expect(md.split("\n").length).toBeLessThanOrEqual(200);
  });
});

describe("en 렌더 내용", () => {
  const files = build(EN["en 기본"]!);
  it("에이전트·스킬·PRD 양식·README 가 영어 본문을 쓴다", () => {
    expect(find(files, ".claude/agents/planner.md")).toContain("You are in charge of planning");
    expect(find(files, ".claude/agents/dev-1.md")).toContain("You are dev-1.");
    expect(find(files, ".claude/skills/conventions/SKILL.md")).toContain("Write answers and documents in English");
    expect(find(files, ".agentforge/templates/prd.md")).toContain("## 1. Overview");
    expect(find(files, "README.md")).toContain("## Steps");
    expect(find(files, "CLAUDE.md")).toContain("# Project rules");
  });
  it("대응표 구간은 dev-N·review-N 에이전트와 dev/review 양식에만 나타난다", () => {
    const withBlock = files.filter((f) => hasPane(f.content)).map((f) => f.path);
    expect(withBlock.every((p) => /^\.claude\/agents\/(dev|review)-\d+\.md$/.test(p) || /^\.agentforge\/templates\/(dev|review)\.md$/.test(p))).toBe(true);
    expect(withBlock.length).toBeGreaterThan(2);
    expect(build().some((f) => hasPane(f.content))).toBe(false); // ko 에는 없다
  });
  it("ko 는 한국어 그대로", () => {
    const ko = build();
    expect(find(ko, "CLAUDE.md")).toContain("# 프로젝트 규칙");
    expect(find(ko, ".claude/agents/planner.md")).toContain("너는 기획 담당이다");
  });
});

const summarize = (files: readonly RenderedFile[]) =>
  [`files=${files.length}`, ...files.map((f) => `${f.mode.toString(8)} ${f.author === "ai-fill" ? "ai" : "tp"} ${createHash("sha256").update(f.content).digest("hex").slice(0, 12)} ${f.path}`)].join("\n");

describe("T-605 en 구성 스냅샷", () => {
  it.each(Object.keys(EN))("스냅샷: %s", (name) => {
    expect(summarize(build(EN[name]!))).toMatchSnapshot();
  });
});
