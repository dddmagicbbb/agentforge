// PoC 정적 원본(스크립트·md 템플릿)을 templates/ 로 바이트 그대로 옮기거나(--write) 대조한다(--check).
// 사용: node tools/extract-poc-static.mjs --write | --check
// tests/golden/intended-diffs.json 의 templates 목록(ADR-0004)은 대조·덮어쓰기에서 제외한다.
import fs from "node:fs";
import path from "node:path";
import { readPocStatic, templatePathOf } from "./poc-static.mjs";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (mode !== "--write" && mode !== "--check") {
  console.error("사용: node tools/extract-poc-static.mjs --write | --check");
  process.exit(2);
}
const root = new URL("../templates/", import.meta.url);
const stat = readPocStatic();
// ADR-0004: PoC 원본과 의도적으로 달라진 템플릿(리드 승인 목록). 대조·덮어쓰기에서 제외한다.
const intended = new Map(
  (JSON.parse(fs.readFileSync(new URL("../tests/golden/intended-diffs.json", import.meta.url), "utf8")).templates ?? []).map((t) => [t.template, t]),
);
let diff = 0;
for (const [key, content] of Object.entries(stat)) {
  const file = new URL(templatePathOf(key), root);
  if (intended.has(templatePathOf(key))) {
    if (mode === "--check") console.log(`의도적 차이: templates/${templatePathOf(key)} (${intended.get(templatePathOf(key)).defect}, ADR-${intended.get(templatePathOf(key)).adr})`);
    continue;
  }
  if (mode === "--write") {
    fs.mkdirSync(path.dirname(fileURLToPath(file)), { recursive: true });
    fs.writeFileSync(file, content);
    continue;
  }
  const cur = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (cur !== content) {
    diff++;
    console.error(`${cur === null ? "없음" : "다름"}: templates/${templatePathOf(key)}`);
  }
}
if (mode === "--write") console.log(`templates/ 에 ${Object.keys(stat).length}개 기록`);
else if (diff) { console.error(`PoC 원본과 다른 템플릿 ${diff}개 (의도한 변경이면 ADR 필요)`); process.exit(1); }
else console.log(`PoC 원본 ${Object.keys(stat).length}개와 일치`);
