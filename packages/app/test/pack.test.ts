import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pkgDir = fileURLToPath(new URL("..", import.meta.url));
// 빌드(pnpm build) 이후에만 의미가 있다. 루트 pnpm test 는 빌드를 먼저 한다.
const built = existsSync(`${pkgDir}dist/cli.js`) && existsSync(`${pkgDir}dist/web/index.html`);

describe.skipIf(!built)("패키지 내용 (npm pack --dry-run)", () => {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: pkgDir, encoding: "utf8", shell: process.platform === "win32" });
  const files: string[] = (JSON.parse(out) as { files: { path: string }[] }[])[0]!.files.map((f) => f.path.replace(/\\/g, "/"));

  it("bin, web index.html, 번들 자원, catalog 가 들어간다", () => {
    expect(files).toContain("dist/cli.js");
    expect(files).toContain("dist/web/index.html");
    expect(files.some((f) => /^dist\/web\/assets\/.+\.js$/.test(f))).toBe(true);
    expect(files).toContain("dist/catalog/market-sources.json");
    expect(files).toContain("package.json");
  });

  it("소스·시험은 들어가지 않는다", () => {
    expect(files.some((f) => f.startsWith("src/") || f.startsWith("test/"))).toBe(false);
  });

  it("CLI 번들은 워크스페이스 패키지를 포함하고 shebang 이 있다", () => {
    const js = readFileSync(`${pkgDir}dist/cli.js`, "utf8");
    expect(js.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(js).not.toMatch(/from ["']@agentforge\//);
  });

  it("실행 의존성은 fastify, @fastify/static, zod 뿐이다 (워크스페이스 패키지 없음)", () => {
    const pkg = JSON.parse(readFileSync(`${pkgDir}package.json`, "utf8")) as { dependencies: Record<string, string>; bin: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@fastify/static", "fastify", "zod"]);
    expect(pkg.bin["agentforge"]).toBe("./dist/cli.js");
  });
});
