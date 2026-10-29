import { defaultClientConditions, defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 폐쇄망 설치형: 외부 CDN 없이 모든 자원을 번들에 포함한다.
export default defineConfig({
  plugins: [react()],
  // 개발 서버·테스트는 workspace 패키지의 소스를 직접 읽는다(빌드 시에는 dist)
  resolve: { conditions: ["@agentforge/source", ...defaultClientConditions] },
  build: {
    outDir: "dist",
    sourcemap: true,
    // 같은 번들 안의 별도 파일로 분리(외부 CDN 아님): 템플릿 내장 core 와 react 계열은 앱 코드와 따로 캐시된다
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-core", test: /packages[\\/]core[\\/]|@agentforge[\\/]core/, priority: 20 },
            { name: "vendor-react", test: /node_modules[\\/](react|react-dom|scheduler|i18next|react-i18next)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
