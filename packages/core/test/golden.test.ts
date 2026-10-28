import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render, validate } from "../src/index.js";

// PoC 실행 결과(tests/golden, tools/poc-golden.mjs)와 core 렌더 결과를 바이트 단위로 대조한다(ADR-0003).

const GOLDEN = fileURLToPath(new URL("../../../tests/golden/", import.meta.url));
const configs = fs.readdirSync(GOLDEN, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const intended: { config: string; path: string }[] = JSON.parse(fs.readFileSync(path.join(GOLDEN, "intended-diffs.json"), "utf8")).diffs;

describe.each(configs)("golden: %s", (name) => {
  const dir = path.join(GOLDEN, name);
  const input: unknown = JSON.parse(fs.readFileSync(path.join(dir, "input.json"), "utf8"));
  const manifest: { files: { path: string; mode: string; author: string }[] } = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const v = validate(input);

  it("입력이 스키마를 통과한다", () => {
    expect(v.issues).toEqual([]);
  });

  const files = v.project ? render(v.project) : [];

  it("파일 목록·순서·권한·작성 주체가 PoC 와 같다", () => {
    expect(files.map((f) => ({ path: f.path, mode: f.mode.toString(8), author: f.author }))).toEqual(manifest.files);
  });

  it.each(manifest.files.map((f) => f.path))("%s 내용이 PoC 와 같다", (p) => {
    if (intended.some((d) => d.config === name && d.path === p)) return;
    const expected = fs.readFileSync(path.join(dir, "files", p), "utf8");
    expect(files.find((f) => f.path === p)?.content).toBe(expected);
  });

  it("같은 입력이면 같은 출력(결정성)", () => {
    expect(render(v.project!)).toEqual(files);
  });
});
