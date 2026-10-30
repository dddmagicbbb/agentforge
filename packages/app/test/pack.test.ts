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

  it("소스맵(.map)은 들어가지 않는다", () => {
    expect(files.filter((f) => f.endsWith(".map"))).toEqual([]);
  });

  it("dist/cli.js 의 node: 아닌 모든 bare import 는 dependencies 에 있다 (번들 누락 방지)", () => {
    const js = readFileSync(`${pkgDir}dist/cli.js`, "utf8");
    const pkg = JSON.parse(readFileSync(`${pkgDir}package.json`, "utf8")) as { dependencies: Record<string, string> };
    const specs = new Set<string>();
    for (const m of js.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)["']([^"']+)["']/g)) specs.add(m[1]!);
    const bare = [...specs].filter((s) => !s.startsWith("node:") && !s.startsWith(".") && !s.startsWith("/"));
    const names = bare.map((s) => (s.startsWith("@") ? s.split("/").slice(0, 2).join("/") : s.split("/")[0]!));
    for (const n of names) expect(Object.keys(pkg.dependencies), `번들에 없는 외부 import: ${n}`).toContain(n);
    expect(names.length).toBeGreaterThan(0); // 검사가 비어 있지 않음(fastify 등)
  });

  it("실행 의존성은 fastify, @fastify/static, zod 뿐이다 (워크스페이스 패키지 없음)", () => {
    const pkg = JSON.parse(readFileSync(`${pkgDir}package.json`, "utf8")) as { dependencies: Record<string, string>; bin: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["@fastify/static", "fastify", "zod"]);
    expect(pkg.bin["agentforge"]).toBe("./dist/cli.js");
  });
});
