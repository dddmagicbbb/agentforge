import { describe, expect, it } from "vitest";
import * as core from "../src/index.js";
import { build, find, frontmatter, fmSkills } from "./fixtures.js";

const skillPaths = (f: { path: string }[]) => f.map((x) => x.path).filter((p) => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(p));

const importedSample = (id: string, target: "all" | "dev" | "review") => ({
  id,
  src: "github.com/example/skills",
  trust: "official" as const,
  desc: "예시 스킬",
  flags: [],
  target,
  acknowledged: true,
});

describe("SKL-01 SKILL.md frontmatter 형식", () => {
  const files = build((d) => d.imported.push(importedSample("market-lint", "all")));
  const paths = skillPaths(files);

  it("스킬 파일이 존재한다", () => {
    expect(paths.length).toBeGreaterThanOrEqual(8);
  });
  it.each(paths)("%s: --- 블록, name=폴더명, description 비지 않음", (p) => {
    const md = find(files, p);
    expect(md.startsWith("---\n")).toBe(true);
    const fm = frontmatter(md);
    expect(fm).not.toBeNull();
    expect(fm!["name"]).toBe(p.split("/")[2]);
    expect((fm!["description"] ?? "").trim().length).toBeGreaterThan(0);
  });
  it("생성 스킬 2종은 모델 호출 비활성", () => {
    const withFlag = paths.filter((p) => frontmatter(find(files, p))?.["disable-model-invocation"] === "true");
    expect(withFlag.sort()).toEqual([".claude/skills/forge-agents/SKILL.md", ".claude/skills/forge-init/SKILL.md"]);
  });
  it("고정 스킬 4종은 토글과 무관하게 항상 생성", () => {
    const off = build((d) => (d.skills = { conventions: false, tdd: false }));
    for (const id of ["detail-design", "code-review", "forge-init", "forge-agents"]) expect(skillPaths(off)).toContain(`.claude/skills/${id}/SKILL.md`);
  });
});

describe("SKL-01 토글 조합 x skills 목록", () => {
  const combos = [
    { conventions: true, tdd: true },
    { conventions: true, tdd: false },
    { conventions: false, tdd: true },
    { conventions: false, tdd: false },
  ];
  it.each(combos)("conventions=$conventions tdd=$tdd", ({ conventions, tdd }) => {
    const files = build((d) => (d.skills = { conventions, tdd }));
    const has = (id: string) => skillPaths(files).includes(`.claude/skills/${id}/SKILL.md`);
    expect(has("conventions")).toBe(conventions);
    expect(has("tdd")).toBe(tdd);

    for (const p of ["dev-1", "dev-2", "dev-3", "common-dev"]) {
      const list = fmSkills(find(files, `.claude/agents/${p}.md`));
      expect(list.includes("conventions")).toBe(conventions);
      expect(list.includes("tdd")).toBe(tdd);
    }
    for (const p of ["review-1", "review-2", "review-3"]) {
      const list = fmSkills(find(files, `.claude/agents/${p}.md`));
      expect(list.includes("conventions")).toBe(conventions);
      expect(list).not.toContain("tdd"); // 검증자는 tdd 를 쓰지 않는다
      expect(list).toContain("code-review");
    }
    // 목록의 모든 스킬은 실제 생성되는 폴더를 가리킨다
    for (const f of files.filter((x) => x.path.startsWith(".claude/agents/"))) {
      for (const s of fmSkills(f.content)) expect(has(s), `${f.path} -> ${s}`).toBe(true);
    }
  });
});

describe("SKL-02 devN-<domain> 배정 범위", () => {
  const files = build();
  const agents = files.filter((f) => f.path.startsWith(".claude/agents/"));
  it("devN 스킬은 dev-N·review-N 에만 있다", () => {
    for (const [n, dom] of [[1, "order"], [2, "payment"], [3, "admin"]] as const) {
      const sk = `dev${n}-${dom}`;
      expect(skillPaths(files)).toContain(`.claude/skills/${sk}/SKILL.md`);
      const holders = agents.filter((a) => fmSkills(a.content).includes(sk)).map((a) => a.path.split("/")[2]);
      expect(holders.sort()).toEqual([`dev-${n}.md`, `review-${n}.md`]);
    }
  });
  it("devN 스킬은 devSkill() 이름 규칙을 따른다", () => {
    expect(core.devSkill({ domain: "order", paths: [], dev: { provider: "claude", model: "x" }, review: { provider: "claude", model: "x" } }, 1)).toBe("dev1-order");
  });
});

describe("SKL-02 imported 스킬 target 배정", () => {
  const files = build((d) => d.imported.push(importedSample("imp-all", "all"), importedSample("imp-dev", "dev"), importedSample("imp-rev", "review")));
  const holders = (sk: string) =>
    files
      .filter((f) => f.path.startsWith(".claude/agents/"))
      .filter((f) => fmSkills(f.content).includes(sk))
      .map((f) => f.path.split("/")[2]!.replace(".md", ""))
      .sort();
  it("all = dev-* + review-*", () => expect(holders("imp-all")).toEqual(["dev-1", "dev-2", "dev-3", "review-1", "review-2", "review-3"]));
  it("dev = dev-* 만", () => expect(holders("imp-dev")).toEqual(["dev-1", "dev-2", "dev-3"]));
  it("review = review-* 만", () => expect(holders("imp-rev")).toEqual(["review-1", "review-2", "review-3"]));
  it("가져온 스킬 폴더가 생성된다", () => {
    for (const id of ["imp-all", "imp-dev", "imp-rev"]) expect(skillPaths(files)).toContain(`.claude/skills/${id}/SKILL.md`);
  });
});

describe("core 공개 export", () => {
  it("web 사본 제거용 심볼이 index 에서 보인다", () => {
    expect(core.PROVIDERS.length).toBe(6);
    expect(core.provider("vllm").via).toBe("vllm");
    expect(core.SEQ.map((s) => s.id)).toEqual(["planner", "analyst", "ux-designer", "architect", "common-dev"]);
    expect(core.FINAL.id).toBe("integrator");
    expect(core.CORE_SKILLS.map((k) => k.id)).toContain("forge-agents");
    expect(Object.fromEntries(core.CORE_SKILLS.map((k) => [k.id, k.group]))).toEqual({
      conventions: "common",
      tdd: "common",
      "detail-design": "role",
      "code-review": "role",
      "forge-init": "gen",
      "forge-agents": "gen",
    });
    expect(core.IMPORT_TARGET_LABEL.all).toContain("review-*");
    expect(core.fmModel({ provider: "vllm", model: "m" })).toBe("inherit");
    expect(core.label({ provider: "claude", model: "opus" })).toBe("Claude opus");
  });
  it("seqI18nKey 는 문장이 아닌 키만 돌려준다", () => {
    expect(core.seqI18nKey("planner", "out")).toBe("seq.planner.out");
    expect(core.seqI18nKey("integrator", "gate")).toBe("seq.integrator.gate");
  });
});
