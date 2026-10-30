import { defineConfig } from "vite";

// CLI 를 한 파일(dist/cli.js)로 묶는다. 워크스페이스 패키지(core·server)는 포함하고 fastify·zod 는 실행 의존성으로 남긴다.
export default defineConfig({
  ssr: { noExternal: [/^@agentforge\//] },
  build: {
    ssr: "src/cli.ts",
    outDir: "dist",
    target: "node22",
    sourcemap: false,
    emptyOutDir: true,
    rolldownOptions: { output: { entryFileNames: "cli.js", banner: "#!/usr/bin/env node" } },
  },
});
