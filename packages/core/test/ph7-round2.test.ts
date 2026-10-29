import { describe, expect, it } from "vitest";
import { AppError, checks, defaultDraft, planGithubTree, scanSkillRisk, type ProjectInput, type RenderedFile } from "../src/index.js";
import { sha256Hex } from "../src/util/sha256.js";
import { build, find } from "./fixtures.js";

const SKILL = "---\nname: demo-skill\ndescription: d\n---\n본문\n";
const RUN_SH = "#!/bin/sh\necho 가\n";
const JSON_FILES = [{ path: "SKILL.md", content: SKILL }, { path: "scripts/run.sh", content: RUN_SH }];
const imp = (extra: Record<string, unknown> = {}) => (d: ProjectInput) => {
  d.imported.push({
    id: "demo-skill", src: "github:o/r", trust: "community", desc: "d", flags: [], target: "all", acknowledged: true,
    ref: "abcdef1", files: JSON_FILES, ...extra,
  } as never);
};

describe("T-702 sha256 순수 구현", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
    ["abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq", "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"],
    ["a".repeat(1_000_000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  ])("벡터 %#", (s, h) => expect(sha256Hex(s)).toBe(h));
  it("멀티바이트 한글은 UTF-8 바이트 기준", () => {
    // node:crypto 로 계산한 값(echo -n 한글 | sha256sum)
    expect(sha256Hex("한글")).toBe("bd87f9bb68b67d2fa1cb82b6751820e946d5b1316d25d5fd96512fb4be44a2a8");
  });
});

describe("T-702 sources.lock", () => {
  it("imported 가 없으면 lock 없음", () => {
    expect(build().some((f) => f.path === ".agentforge/sources.lock")).toBe(false);
  });
  it("내용·키 순서·재계산 flags·sha256·파일 순서", () => {
    const files = build(imp({ flags: ["입력무시"] }));
    const f = files.find((x) => x.path === ".agentforge/sources.lock")!;
    expect(f.mode).toBe(0o644);
    expect(f.author).toBe("template");
    const raw = f.content;
    expect(raw.endsWith("}\n")).toBe(true);
    expect(JSON.parse(raw)).toEqual({
      version: 1,
      skills: [{
        id: "demo-skill", src: "github:o/r", trust: "community", ref: "abcdef1", target: "all",
        flags: scanSkillRisk([{ path: "scripts/run.sh", content: "#!/bin/sh\necho 가\n" }]),
        files: [
          { path: "SKILL.md", sha256: sha256Hex(SKILL) },
          { path: "scripts/run.sh", sha256: sha256Hex("#!/bin/sh\necho 가\n") },
        ],
      }],
    });
    expect(raw.indexOf('"id"')).toBeLessThan(raw.indexOf('"src"'));
    expect(raw.indexOf('"src"')).toBeLessThan(raw.indexOf('"trust"'));
    expect(raw.indexOf('"trust"')).toBeLessThan(raw.indexOf('"ref"'));
    expect(raw.indexOf('"ref"')).toBeLessThan(raw.indexOf('"target"'));
    expect(raw.indexOf('"target"')).toBeLessThan(raw.indexOf('"flags"'));
    expect(raw.indexOf('"flags"')).toBeLessThan(raw.indexOf('"files"'));
    expect(raw).toContain('\n  "skills": [\n    {\n      "id"');
  });
  it("files 없으면 입력 flags, ref 없으면 null, files []", () => {
    const files = build((d) => d.imported.push({ id: "plain", src: "s", trust: "org", desc: "", flags: ["x"], target: "dev", acknowledged: true }));
    const j = JSON.parse(find(files, ".agentforge/sources.lock"));
    expect(j.skills[0]).toEqual({ id: "plain", src: "s", trust: "org", ref: null, target: "dev", flags: ["x"], files: [] });
  });
});

describe("T-702 planGithubTree", () => {
  const rf = (path: string, mode: 0o644 | 0o755 = 0o644): RenderedFile => ({ path, content: path, mode, author: "template" });
  it("모드·순서 유지", () => {
    const t = planGithubTree([rf("b.md"), rf("scripts/a.sh", 0o755), rf(".agentforge/env.local.example")]);
    expect(t).toEqual([
      { path: "b.md", mode: "100644", content: "b.md" },
      { path: "scripts/a.sh", mode: "100755", content: "scripts/a.sh" },
      { path: ".agentforge/env.local.example", mode: "100644", content: ".agentforge/env.local.example" },
    ]);
  });
  it("env.local 은 EXPORT_SECRET_PATH", () => {
    let e: unknown;
    try { planGithubTree([rf(".agentforge/env.local")]); } catch (x) { e = x; }
    expect(e).toBeInstanceOf(AppError);
    expect(e).toMatchObject({ code: "EXPORT_SECRET_PATH", params: { path: ".agentforge/env.local" } });
  });
  it("render 결과와 경로 집합·내용·권한 대응(ZIP 과 같은 입력)", () => {
    const files = build(imp());
    const t = planGithubTree(files);
    expect(t.map((x) => x.path)).toEqual(files.map((x) => x.path));
    t.forEach((x, i) => {
      expect(x.content).toBe(files[i]!.content);
      expect(x.mode).toBe(files[i]!.mode === 0o755 ? "100755" : "100644");
      expect(x.mode === "100755").toBe(x.path.endsWith(".sh") && !x.path.startsWith(".claude/skills/"));
    });
    expect(t.find((x) => x.path === ".claude/skills/demo-skill/scripts/run.sh")!.mode).toBe("100644");
  });
  it("기본 구성 render 도 통과", () => {
    expect(() => planGithubTree(build())).not.toThrow();
  });
});

describe("T-703 checks IMPORT_RISK·README", () => {
  it("항목별 info, files 재계산", () => {
    const d = defaultDraft();
    imp({ flags: [] })(d);
    const r = checks(d).filter((i) => i.code === "IMPORT_RISK");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ level: "info", path: ["imported", 0], params: { id: "demo-skill", codes: scanSkillRisk(JSON_FILES).join(",") } });
  });
  it("위험 없으면 IMPORT_RISK 없음", () => {
    const d = defaultDraft();
    imp({ files: [{ path: "SKILL.md", content: SKILL }] })(d);
    expect(checks(d).some((i) => i.code === "IMPORT_RISK")).toBe(false);
  });
  it("비정상 입력에서도 throw 없음", () => {
    const d = defaultDraft() as unknown as Record<string, unknown>;
    d["imported"] = [null, 3, { id: 5, files: "x", flags: "y" }, { id: "a", files: [{ path: 1 }], flags: ["f"] }];
    expect(() => checks(d as never)).not.toThrow();
  });
  it("README 안내는 imported 있을 때만(ko·en)", () => {
    expect(find(build(), "README.md")).not.toContain("sources.lock");
    expect(find(build(), "README.md")).toBe(find(build(), "README.md"));
    const ko = find(build(imp()), "README.md");
    expect(ko).toContain(".agentforge/sources.lock");
    expect(ko).toContain("chmod");
    const en = find(build((d) => { d.language = "en"; imp()(d); }), "README.md");
    expect(en).toContain(".agentforge/sources.lock");
    expect(en).toContain("chmod");
    expect(en).not.toMatch(/[가-힣]/);
  });
});
