import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { build, find } from "./fixtures.js";

const STATIC = fileURLToPath(new URL("../../../templates/static/", import.meta.url));

describe("RUN-03 integrate.sh 렌더", () => {
  const files = build();
  const f = files.find((x) => x.path === "scripts/integrate.sh");
  it("실행 권한 755 로 생성된다", () => {
    expect(f?.mode).toBe(0o755);
    expect(f?.author).toBe("template");
  });
  it("정적 원문과 바이트 동일(입력과 무관)", () => {
    const src = fs.readFileSync(`${STATIC}integrate.sh`, "utf8");
    expect(f?.content).toBe(src);
    const other = build((d) => (d.uiDesign = false));
    expect(find(other, "scripts/integrate.sh")).toBe(src);
  });
  it("전 개발자 통과 확인·병합 중단·shebang 을 포함한다", () => {
    expect(f?.content.startsWith("#!/usr/bin/env bash\n")).toBe(true);
    expect(f?.content).toContain("review-$i.passed");
    expect(f?.content).toContain("git merge --abort");
  });
});

describe("VSC-01 tasks.json 렌더", () => {
  const files = build();
  const json = JSON.parse(find(files, ".vscode/tasks.json")) as { version: string; tasks: { label: string; type: string; command: string }[] };
  it("유효 JSON, 6작업, 순서 고정", () => {
    expect(json.version).toBe("2.0.0");
    expect(json.tasks.map((t) => t.label)).toEqual(["AF: 준비(setup)", "AF: worktree 생성", "AF: 병렬 실행", "AF: 붙기", "AF: 구성 검사", "AF: 통합 검증"]);
  });
  it("모든 작업이 shell 이고 scripts/ 의 실제 생성 파일을 가리킨다", () => {
    const paths = new Set(files.map((x) => x.path));
    for (const t of json.tasks) expect(t.type).toBe("shell");
    for (const script of json.tasks.flatMap((t) => [...t.command.matchAll(/scripts\/[\w.-]+\.sh/g)].map((m) => m[0]))) expect(paths.has(script), script).toBe(true);
  });
  it("입력과 무관하다(6명/UI 끔에서도 동일)", () => {
    const base = find(files, ".vscode/tasks.json");
    expect(find(build((d) => (d.uiDesign = false)), ".vscode/tasks.json")).toBe(base);
  });
  it("끝 개행 1개, LF", () => {
    const raw = find(files, ".vscode/tasks.json");
    expect(raw.endsWith("}\n")).toBe(true);
    expect(raw).not.toContain("\r");
  });
});
