// 빌드: vite 로 CLI 번들(dist/cli.js) → 같이 배포할 web dist·catalog 를 dist/ 안으로 복사한다.
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const webDist = here("../web/dist");
if (!existsSync(join(webDist, "index.html"))) {
  process.stderr.write("web dist 가 없습니다. 먼저 @agentforge/web 을 빌드하세요.\n");
  process.exit(1);
}
const viteBin = join(dirname(createRequire(import.meta.url).resolve("vite/package.json")), "bin", "vite.js");
// vite 는 dist 를 비우고 cli.js 를 쓴다
const vite = spawnSync(process.execPath, [viteBin, "build"], { cwd: here("."), stdio: "inherit" });
if (vite.status !== 0) process.exit(vite.status ?? 1);

// 소스맵(.map)은 배포하지 않는다
cpSync(webDist, here("dist/web"), { recursive: true, filter: (src) => !src.endsWith(".map") });
mkdirSync(here("dist/catalog"), { recursive: true });
cpSync(here("../../catalog/market-sources.json"), here("dist/catalog/market-sources.json"));
chmodSync(here("dist/cli.js"), 0o755);
