// poc.html 의 `const STATIC = {...}` 를 읽는다(공용 모듈). 정적 원본의 유일한 출처.
import fs from "node:fs";

export const POC_PATH = new URL("../docs/reference/poc.html", import.meta.url);

/** PoC STATIC 키 → templates/ 상대 경로 */
export function templatePathOf(key) {
  return key.startsWith("md/") ? key : `static/${key}`;
}

export function readPocStatic(pocPath = POC_PATH) {
  const html = fs.readFileSync(pocPath, "utf8");
  const prefix = "const STATIC = ";
  const line = html.split("\n").find((l) => l.startsWith(prefix));
  if (!line) throw new Error("poc.html 에서 const STATIC 을 찾지 못했습니다");
  return JSON.parse(line.slice(prefix.length).replace(/;\s*$/, ""));
}
