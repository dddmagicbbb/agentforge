// 입력(ProjectInput JSON) → core render → exporter toZip → .zip 파일. G3·E2E 시험용(빌드된 dist 사용).
// 사용: node tools/make-zip.mjs <input.json> <out.zip>
import fs from "node:fs";
import { render, validate } from "../packages/core/dist/index.js";
import { toZip } from "../packages/exporter/dist/index.js";

const [inputPath, outPath] = process.argv.slice(2);
if (!inputPath || !outPath) { console.error("사용: node tools/make-zip.mjs <input.json> <out.zip>"); process.exit(2); }
const v = validate(JSON.parse(fs.readFileSync(inputPath, "utf8")));
if (!v.project) { console.error(JSON.stringify(v.issues, null, 2)); process.exit(1); }
fs.writeFileSync(outPath, await toZip(render(v.project), v.project.name));
console.log(`${outPath}: ${v.project.name}`);
