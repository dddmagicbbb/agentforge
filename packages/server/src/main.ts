// CLI: node dist/main.js (T-713 E2E 등에서 사용). core 의 scanSkillRisk 를 연결해 기동한다.
import * as core from "@agentforge/core";
import { startFromEnv } from "./listen.js";
import type { ScanFn } from "./types.js";

// TODO(통합): core 에 scanSkillRisk 가 병합되기 전에는 없으므로 동적으로 확인한다
const scan = (core as unknown as Record<string, unknown>)["scanSkillRisk"];
if (typeof scan !== "function") {
  console.error("@agentforge/core 에 scanSkillRisk 가 없습니다.");
  process.exit(1);
}
const { address } = await startFromEnv(process.env, scan as ScanFn);
console.log(`market server: http://${address.host}:${address.port}`);
