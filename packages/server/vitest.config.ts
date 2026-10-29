import { defineConfig } from "vitest/config";

// workspace 패키지는 소스를 직접 읽는다(@agentforge/source)
export default defineConfig({ resolve: { conditions: ["@agentforge/source"] }, ssr: { resolve: { conditions: ["@agentforge/source"] } } });
