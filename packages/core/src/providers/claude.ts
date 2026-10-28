import type { ProviderDef } from "./types.js";

// 사용자가 직접 로그인한 계정을 쓴다. 키·주소 없음.
export const claude: ProviderDef = { id: "claude", label: "Claude 로그인", via: "claude", models: ["opus", "sonnet", "haiku"] };
