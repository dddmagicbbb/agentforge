import { defineConfig } from "vitest/config";

// workspace 패키지는 소스를 직접 읽는다(@agentforge/source). 시험은 운영(기본) 빌드와 같게 __AF_TEST_LICENSE__ = false
export default defineConfig({
  define: { __AF_TEST_LICENSE__: "false" },
  resolve: { conditions: ["@agentforge/source"] },
  ssr: { resolve: { conditions: ["@agentforge/source"] } },
});
