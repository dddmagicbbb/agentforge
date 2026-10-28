// PoC(docs/reference/poc.html)의 GEN 구간을 Node vm 에서 실행해 golden 기준 출력을 만든다(ADR-0003).
// 사용: node tools/poc-golden.mjs            → tests/golden/*/input.json 전부 재생성
//       node tools/poc-golden.mjs <구성명>    → 해당 구성만
// 입력(input.json)은 core 스키마 형식(ProjectInput). PoC 상태(S) 형식으로 바꿔 실행한다.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { POC_PATH } from "./poc-static.mjs";

const goldenRoot = fileURLToPath(new URL("../tests/golden/", import.meta.url));
const TRUST_LABEL = { official: "공식", org: "조직 승인", community: "커뮤니티", unverified: "미검증" };

/** ProjectInput → PoC S(v6) */
export function toPocState(p) {
  return {
    name: p.name,
    lang: p.language,
    req: p.requirement,
    devCount: p.developerCount,
    ui: p.uiDesign,
    cmd: { ...p.commands },
    maxRejects: p.maxRejects,
    agents: Object.fromEntries(Object.entries(p.agents).map(([id, a]) => [id, { p: a.provider, m: a.model }])),
    devs: p.devs.map((d) => ({
      domain: d.domain,
      paths: d.paths.join(", "),
      dp: d.dev.provider, dm: d.dev.model, rp: d.review.provider, rm: d.review.model,
    })),
    skills: { ...p.skills },
    imported: p.imported.map((m) => ({ id: m.id, src: m.src, trust: TRUST_LABEL[m.trust], desc: m.desc, flags: m.flags, target: m.target })),
    ack: Object.fromEntries(p.imported.map((m) => [m.id, m.acknowledged])),
    conn: { vllm: p.connections.vllmUrl, ollama: p.connections.ollamaUrl },
  };
}

/** PoC GEN 구간 실행 → { files: [{path, content, exec, ai}], checks } */
export function runPoc(projectInput) {
  const html = fs.readFileSync(POC_PATH, "utf8");
  const staticLine = html.split("\n").find((l) => l.startsWith("const STATIC = "));
  const gen = html.slice(html.indexOf("/*GEN-START*/"), html.indexOf("/*GEN-END*/"));
  const ctx = { __state: toPocState(projectInput), result: null };
  vm.runInNewContext(
    `"use strict";\n${staticLine}\n${gen}\nS = Object.assign(DEF(), __state);\nsyncDevs();\nresult = { files: buildFiles(), checks: checks() };`,
    ctx,
  );
  return ctx.result;
}

function writeGolden(name) {
  const dir = path.join(goldenRoot, name);
  const input = JSON.parse(fs.readFileSync(path.join(dir, "input.json"), "utf8"));
  const { files, checks } = runPoc(input);
  fs.rmSync(path.join(dir, "files"), { recursive: true, force: true });
  for (const f of files) {
    const p = path.join(dir, "files", f.path);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, f.content);
  }
  const manifest = files.map((f) => ({ path: f.path, mode: f.exec ? "755" : "644", author: f.ai ? "ai-fill" : "template" }));
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ files: manifest, checks }, null, 2) + "\n");
  console.log(`${name}: 파일 ${files.length}개, 검사 ${checks.length}건`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const only = process.argv[2];
  const names = fs.readdirSync(goldenRoot, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(goldenRoot, e.name, "input.json")))
    .map((e) => e.name)
    .filter((n) => !only || n === only);
  if (!names.length) { console.error("golden 구성이 없습니다"); process.exit(1); }
  names.forEach(writeGolden);
}
