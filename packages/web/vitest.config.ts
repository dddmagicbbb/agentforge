import { fileURLToPath } from "node:url";
import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 컴포넌트 시험: jsdom. workspace 패키지는 소스를 직접 읽는다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    conditions: ["@agentforge/source", ...defaultClientConditions],
    // exporter ./github 진입점(dev-2)이 아직 없는 브랜치용: 시험은 push 를 주입하므로 빈 모듈로 대체. 통합 후 제거
    alias: { "@agentforge/exporter/github": fileURLToPath(new URL("./test/stub-exporter-github.ts", import.meta.url)) },
  },
  // exporter ./github 진입점(dev-2)이 이 브랜치엔 없다: 시험은 push 를 주입하므로 빈 모듈로 대체. 통합 후 제거 가능
  test: { environment: "jsdom", setupFiles: ["./test/setup.ts"], css: false },
});
