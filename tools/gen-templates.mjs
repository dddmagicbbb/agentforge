// templates/** 를 core 가 import 하는 TS 모듈로 만든다(ADR-0001: core 는 I/O 금지).
// 출력: packages/core/src/templates.generated.ts (커밋하지 않음)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../templates/", import.meta.url));
const out = fileURLToPath(new URL("../packages/core/src/templates.generated.ts", import.meta.url));

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

const entries = walk(root)
  .map((f) => [path.relative(root, f).split(path.sep).join("/"), fs.readFileSync(f, "utf8")])
  .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

const crlf = entries.filter(([, c]) => c.includes("\r")).map(([k]) => k);
if (crlf.length) {
  console.error(`CRLF 가 들어간 템플릿: ${crlf.join(", ")} (LF 고정 규칙)`);
  process.exit(1);
}

const body = entries.map(([k, c]) => `  ${JSON.stringify(k)}: ${JSON.stringify(c)},`).join("\n");
const ts = `// 자동 생성 파일 — tools/gen-templates.mjs. 직접 수정하지 말고 templates/ 를 고친다.
export const TEMPLATES = {
${body}
} as const satisfies Readonly<Record<string, string>>;

export type TemplateKey = keyof typeof TEMPLATES;
`;
if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== ts) fs.writeFileSync(out, ts);
console.log(`templates.generated.ts: ${entries.length}개`);
