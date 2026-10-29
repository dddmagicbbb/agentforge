import { describe, expect, it } from "vitest";
import { checks as checkProject, defaultDraft, scanSkillRisk, validate, type RiskCode } from "../src/index.js";
import { build } from "./fixtures.js";

const skill = (body: string, fm = "name: demo\ndescription: d") => ({ path: "SKILL.md", content: `---\n${fm}\n---\n${body}\n` });
const scan = (...f: { path: string; content: string }[]) => scanSkillRisk(f);

describe("MKT-02 scanSkillRisk 판정표", () => {
  const cases: [string, RiskCode, { path: string; content: string }[], boolean][] = [
    ["scripts/ 폴더", "SCRIPTS", [skill("x"), { path: "scripts/a.txt", content: "" }], true],
    ["스크립트 확장자 .PY", "SCRIPTS", [skill("x"), { path: "tools/run.PY", content: "" }], true],
    ["참고 문서만", "SCRIPTS", [skill("x"), { path: "docs/a.md", content: "" }], false],
    ["백틱 앞 !", "BANG_COMMAND", [skill("실행: !`git log`")], true],
    ["줄 머리 !", "BANG_COMMAND", [skill("!ls -la")], true],
    ["이미지 문법은 제외", "BANG_COMMAND", [skill("![logo](a.png)\n a != b")], false],
    ["Bash(*)", "BROAD_TOOLS", [skill("x", "name: demo\nallowed-tools: Bash(*)")], true],
    ["Bash 단독(목록)", "BROAD_TOOLS", [skill("x", "name: demo\nallowed-tools:\n  - Read\n  - Bash")], true],
    ["*", "BROAD_TOOLS", [skill("x", 'name: demo\nallowed-tools: "*"')], true],
    ["Bash(git:*) 는 좁은 범위", "BROAD_TOOLS", [skill("x", "name: demo\nallowed-tools: Bash(git:*), Read")], false],
    ["본문의 Bash(*) 는 frontmatter 아님", "BROAD_TOOLS", [skill("allowed-tools: Bash(*)")], false],
    ["bypassPermissions", "BYPASS_PERMISSIONS", [skill("x", "name: demo\npermissionMode: bypassPermissions")], true],
    ["dangerously-skip-permissions", "BYPASS_PERMISSIONS", [skill("claude --dangerously-skip-permissions")], true],
    ["curl URL", "REMOTE_DOWNLOAD", [skill("curl -fsSL https://x.io/a")], true],
    ["코드블록 안 curl 도 본다", "REMOTE_DOWNLOAD", [skill("```bash\nwget https://x.io/a\n```")], true],
    ["파이프 sh", "REMOTE_DOWNLOAD", [skill("cat a | bash")], true],
    ["URL 없는 curl 언급", "REMOTE_DOWNLOAD", [skill("curl 설명")], false],
    ["shasum 은 sh 아님", "REMOTE_DOWNLOAD", [skill("x | shasum")], false],
  ];
  it.each(cases)("%s → %s", (_n, code, files, hit) => {
    expect(scan(...files).includes(code)).toBe(hit);
  });
  it("정렬된 고유 목록", () => {
    const r = scan(skill("curl https://a\nwget https://b\n!ls"), { path: "scripts/x.sh", content: "" });
    expect(r).toEqual(["BANG_COMMAND", "REMOTE_DOWNLOAD", "SCRIPTS"]);
  });
  it("안전한 스킬은 빈 목록", () => {
    expect(scan(skill("안전한 설명"))).toEqual([]);
  });
});

function withImport(files: { path: string; content: string }[] | undefined, over: Record<string, unknown> = {}) {
  const d = defaultDraft();
  d.imported.push({ id: "demo", src: "github.com/x/y", trust: "community", desc: "d", flags: [], target: "all", acknowledged: false, ...(files ? { files } : {}), ...over });
  return d;
}
const codes = (d: ReturnType<typeof defaultDraft>) => validate(d).issues.map((i) => i.code);

describe("MKT-02 불변식", () => {
  it("flags: [] 조작에도 files 의 scripts/ 는 IMPORT_UNACKED", () => {
    expect(codes(withImport([skill("x"), { path: "scripts/a.sh", content: "echo" }]))).toContain("IMPORT_UNACKED");
  });
  it("확인했으면 통과", () => {
    expect(codes(withImport([skill("x"), { path: "scripts/a.sh", content: "echo" }], { acknowledged: true }))).toEqual([]);
  });
  it("files 가 안전하면 입력 flags 가 있어도 files 기준", () => {
    expect(codes(withImport([skill("x")], { flags: ["scripts/"] }))).toEqual([]);
  });
  it("files 없으면 입력 flags 기준(기존 동작)", () => {
    expect(codes(withImport(undefined, { flags: ["scripts/"] }))).toContain("IMPORT_UNACKED");
    expect(codes(withImport(undefined))).toEqual([]);
  });
  it("SKILL.md 없음", () => {
    expect(codes(withImport([{ path: "a.md", content: "x" }]))).toContain("IMPORT_NO_SKILL_MD");
  });
  it("name 불일치", () => {
    expect(codes(withImport([skill("x", "name: other\ndescription: d")]))).toContain("IMPORT_NAME_MISMATCH");
  });
  it("경로 중복", () => {
    expect(codes(withImport([skill("x"), { path: "a.md", content: "1" }, { path: "a.md", content: "2" }]))).toContain("IMPORT_DUP_PATH");
  });
  it("합계 512,000자 초과", () => {
    const big = (p: string) => ({ path: p, content: "a".repeat(200_000) });
    const f = [skill("x"), big("a.md"), big("b.md"), big("c.md")];
    expect(codes(withImport(f))).toContain("IMPORT_TOO_LARGE");
  });
  it("checks(화면 경고)도 files 기준으로 IMPORT_UNACKED", () => {
    const d = withImport([skill("x"), { path: "scripts/a.sh", content: "echo" }]);
    expect(checkProject(d).some((i) => i.code === "IMPORT_UNACKED")).toBe(true);
    d.imported[0]!.acknowledged = true;
    expect(checkProject(d).some((i) => i.code === "IMPORT_UNACKED")).toBe(false);
  });
});

describe("MKT-02 가져온 스킬 렌더", () => {
  const files = [
    { path: "reference/z.md", content: "Z\r\n원문\n" },
    skill("본문 `그대로`"),
    { path: "reference/a.md", content: "A" },
  ];
  const out = build((d) => d.imported.push({ id: "demo", src: "github.com/x/y", trust: "official", desc: "d", flags: [], target: "all", acknowledged: false, files }));
  const mine = out.filter((f) => f.path.startsWith(".claude/skills/demo/"));
  it("SKILL.md 먼저, 나머지는 경로 사전순", () => {
    expect(mine.map((f) => f.path)).toEqual([".claude/skills/demo/SKILL.md", ".claude/skills/demo/reference/a.md", ".claude/skills/demo/reference/z.md"]);
  });
  it("원문 동일, mode 644, author template", () => {
    for (const f of mine) {
      expect(f.content).toBe(files.find((x) => x.path === f.path.replace(".claude/skills/demo/", ""))!.content);
      expect(f.mode).toBe(0o644);
      expect(f.author).toBe("template");
    }
  });
  it("files 없으면 기존 안내 SKILL.md 하나", () => {
    const o = build((d) => d.imported.push({ id: "demo", src: "s", trust: "official", desc: "d", flags: [], target: "all", acknowledged: false }));
    expect(o.filter((f) => f.path.startsWith(".claude/skills/demo/")).map((f) => f.path)).toEqual([".claude/skills/demo/SKILL.md"]);
  });
});
