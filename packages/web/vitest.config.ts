import { defaultClientConditions } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// 컴포넌트 시험: jsdom. workspace 패키지는 소스를 직접 읽는다.
export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ["@agentforge/source", ...defaultClientConditions] },
  test: { environment: "jsdom", setupFiles: ["./test/setup.ts"], css: false },
});
