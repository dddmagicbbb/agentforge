import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { AppError, defaultDraft, render, validate } from "@agentforge/core";
import { toZip } from "../src/index.js";

// EXP-01(기본): ZIP 내용 = RenderedFile[] (경로·내용·권한), 결정적 출력

const files = render(validate(defaultDraft()).project!);

describe("toZip", () => {
  it("모든 파일이 root/ 아래에 같은 내용·권한으로 들어간다", async () => {
    const zip = await JSZip.loadAsync(await toZip(files, "order-portal"));
    const entries = Object.values(zip.files).filter((e) => !e.dir);
    expect(entries.map((e) => e.name)).toEqual(files.map((f) => `order-portal/${f.path}`));
    for (const f of files) {
      const e = zip.file(`order-portal/${f.path}`)!;
      expect(await e.async("string")).toBe(f.content);
      // unixPermissions 에는 파일 종류 비트(0o100000)가 붙을 수 있으므로 권한 비트만 비교
      expect(Number(e.unixPermissions) & 0o777).toBe(f.mode);
    }
  });

  it("같은 입력이면 같은 바이트", async () => {
    expect(await toZip(files, "x")).toEqual(await toZip(files, "x"));
  });

  it("잘못된 root·경로는 거부한다", async () => {
    await expect(toZip(files, "../evil")).rejects.toBeInstanceOf(AppError);
    await expect(toZip([{ path: "../x", content: "", mode: 0o644, author: "template" }], "ok")).rejects.toBeInstanceOf(AppError);
    await expect(toZip([files[0]!, files[0]!], "ok")).rejects.toBeInstanceOf(AppError);
  });

  it("2초 이내(PRD 성능)", async () => {
    const t = performance.now();
    await toZip(files, "perf");
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
