import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { render, validate } from "../src/index.js";

// PoC 실행 결과(tests/golden, tools/poc-golden.mjs)와 core 렌더 결과를 바이트 단위로 대조한다(ADR-0003).

const GOLDEN = fileURLToPath(new URL("../../../tests/golden/", import.meta.url));
const configs = fs.readdirSync(GOLDEN, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const intendedJson = JSON.parse(fs.readFileSync(path.join(GOLDEN, "intended-diffs.json"), "utf8"));
const intended: { config: string; path: string }[] = intendedJson.diffs;
// PoC 에 없는 새 생성 파일(ADR-0006 이후). 이 경로는 목록 비교에서 빼고, 존재만 따로 확인한다.
const added: { config: string; path: string }[] = intendedJson.added ?? [];

describe.each(configs)("golden: %s", (name) => {
  const dir = path.join(GOLDEN, name);
  const input: unknown = JSON.parse(fs.readFileSync(path.join(dir, "input.json"), "utf8"));
  const manifest: { files: { path: string; mode: string; author: string }[] } = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  const v = validate(input);

  it("입력이 스키마를 통과한다", () => {
    expect(v.issues).toEqual([]);
  });

  const files = v.project ? render(v.project) : [];

  const isAdded = (p: string) => added.some((d) => (d.config === name || d.config === "*") && d.path === p);

  it("파일 목록·순서·권한·작성 주체가 PoC 와 같다(의도적 추가 파일 제외)", () => {
    const listed = files.filter((f) => !isAdded(f.path));
    expect(listed.map((f) => ({ path: f.path, mode: f.mode.toString(8), author: f.author }))).toEqual(manifest.files);
  });

  it.each(added.filter((d) => d.config === name || d.config === "*").map((d) => d.path))("의도적 추가 파일 %s 가 생성된다", (p) => {
    expect(files.some((f) => f.path === p)).toBe(true);
  });

  it.each(manifest.files.map((f) => f.path))("%s 내용이 PoC 와 같다", (p) => {
    if (intended.some((d) => (d.config === name || d.config === "*") && d.path === p)) return;
    const expected = fs.readFileSync(path.join(dir, "files", p), "utf8");
    expect(files.find((f) => f.path === p)?.content).toBe(expected);
  });

  it("같은 입력이면 같은 출력(결정성)", () => {
    expect(render(v.project!)).toEqual(files);
  });
});
