import { defaultClientConditions, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 폐쇄망 설치형: 외부 CDN 없이 모든 자원을 번들에 포함한다.
export default defineConfig({
  plugins: [react()],
  // 개발 서버·테스트는 workspace 패키지의 소스를 직접 읽는다(빌드 시에는 dist)
  resolve: { conditions: ["@agentforge/source", ...defaultClientConditions] },
  build: { outDir: "dist", sourcemap: true },
});
