import os from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";

// 포트 고정. 웹 빌드 결과를 vite preview 로 서빙한다(개발 서버가 아닌 배포 번들을 시험).
const PORT = 4173;

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: path.join(os.tmpdir(), "agentforge-e2e-results"), // 저장소에 산출물을 남기지 않는다
  workers: 1, // 시나리오가 ZIP 산출물을 이어서 쓴다(직렬)
  fullyParallel: false,
  timeout: 60_000,
  reporter: process.env["CI"] ? [["list"], ["github"]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, acceptDownloads: true, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `pnpm --filter @agentforge/web build && pnpm --filter @agentforge/web exec vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
