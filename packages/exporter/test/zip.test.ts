import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AppError, defaultDraft, render, validate, type RenderedFile } from "@agentforge/core";
import { toZip } from "../src/index.js";

// EXP-01: ZIP 내용 = RenderedFile[] (경로·순서·내용·권한), 루트 폴더, LF, 결정적 출력, 성능

const GOLDEN = fileURLToPath(new URL("../../../tests/golden/", import.meta.url));
const configs = fs.readdirSync(GOLDEN, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

function load(config: string): { name: string; files: RenderedFile[] } {
  const input: unknown = JSON.parse(fs.readFileSync(path.join(GOLDEN, config, "input.json"), "utf8"));
  const v = validate(input);
  if (!v.project) throw new Error(`golden 입력 오류: ${config}`);
  return { name: v.project.name, files: render(v.project) };
}

const enc = new TextEncoder();

describe.each(configs)("toZip golden: %s", (config) => {
  const { name, files } = load(config);

  it("zip ↔ RenderedFile[] 동등(목록·순서·내용·권한)", async () => {
    const zip = await JSZip.loadAsync(await toZip(files, name));
    const entries = Object.values(zip.files);
    expect(entries.map((e) => e.name)).toEqual(files.map((f) => `${name}/${f.path}`));
    for (const f of files) {
      const e = zip.file(`${name}/${f.path}`)!;
      expect(await e.async("uint8array")).toEqual(enc.encode(f.content));
      // unixPermissions 에는 파일 종류 비트가 붙을 수 있으므로 권한 비트만 비교
      expect(Number(e.unixPermissions) & 0o777).toBe(f.mode);
    }
  });

  it("모든 항목이 <프로젝트 이름>/ 아래, 디렉터리 항목 없이 파일만", async () => {
    const zip = await JSZip.loadAsync(await toZip(files, name));
    const entries = Object.values(zip.files);
    expect(entries.length).toBe(files.length);
    expect(entries.every((e) => !e.dir && e.name.startsWith(`${name}/`))).toBe(true);
  });

  it("755 파일(스크립트·훅)이 있고 나머지는 644", async () => {
    const zip = await JSZip.loadAsync(await toZip(files, name));
    const modes = Object.values(zip.files).map((e) => ({ n: e.name, m: Number(e.unixPermissions) & 0o777 }));
    const exec = modes.filter((x) => x.m === 0o755);
    expect(exec.length).toBeGreaterThan(0);
    expect(exec.every((x) => x.n.endsWith(".sh"))).toBe(true);
    expect(modes.every((x) => x.m === 0o755 || x.m === 0o644)).toBe(true);
  });

  it("ZIP 안 모든 텍스트에 CR 이 없다(LF 유지)", async () => {
    const zip = await JSZip.loadAsync(await toZip(files, name));
    for (const e of Object.values(zip.files)) {
      expect((await e.async("string")).includes("\r"), e.name).toBe(false);
    }
  });

  it("같은 입력이면 같은 바이트", async () => {
    expect(await toZip(files, name)).toEqual(await toZip(files, name));
  });

  it("2초 이내(PRD 성능)", async () => {
    const t = performance.now();
    await toZip(files, name);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe("toZip 경계", () => {
  const files = render(validate(defaultDraft()).project!);

  it("빈 파일(.gitkeep)이 크기 0 으로 보존된다", async () => {
    const input: RenderedFile[] = [
      { path: "docs/review/.gitkeep", content: "", mode: 0o644, author: "template" },
      { path: "a.sh", content: "#!/bin/sh\n", mode: 0o755, author: "template" },
    ];
    const zip = await JSZip.loadAsync(await toZip(input, "demo"));
    const e = zip.file("demo/docs/review/.gitkeep");
    expect(e).not.toBeNull();
    expect((await e!.async("uint8array")).length).toBe(0);
    expect(Object.values(zip.files).every((x) => !x.dir)).toBe(true);
  });

  it("잘못된 root·경로는 거부한다", async () => {
    await expect(toZip(files, "../evil")).rejects.toBeInstanceOf(AppError);
    await expect(toZip([{ path: "../x", content: "", mode: 0o644, author: "template" }], "ok")).rejects.toBeInstanceOf(AppError);
    await expect(toZip([files[0]!, files[0]!], "ok")).rejects.toBeInstanceOf(AppError);
  });
});
