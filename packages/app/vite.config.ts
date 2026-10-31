import { defineConfig } from "vite";

// CLI 를 한 파일(dist/cli.js)로 묶는다. 워크스페이스 패키지(core·server)는 포함하고 fastify·zod 는 실행 의존성으로 남긴다.
// AF_TEST_BUILD=1 로 빌드할 때만 시험 공개 키 경로를 넣는다(Docker 시험 이미지 전용). 기본은 false
const testBuild = process.env["AF_TEST_BUILD"] === "1";

export default defineConfig({
  define: { __AF_TEST_LICENSE__: JSON.stringify(testBuild) },
  ssr: { noExternal: [/^@agentforge\//, /^@noble\//] },
  build: {
    ssr: "src/cli.ts",
    outDir: "dist",
    target: "node22",
    sourcemap: false,
    emptyOutDir: true,
    rolldownOptions: { output: { entryFileNames: "cli.js", banner: "#!/usr/bin/env node" } },
  },
});
