// 라이선스 서명 키 쌍 생성(ADR-0008, T-800). 비밀 키는 저장소 밖에만 저장한다.
// 사용: node tools/license-keygen.mjs <kid> [--dir <폴더>]
//   기본 폴더: ~/.agentforge/license-signing/  →  <kid>.pem(비밀 키, 권한 600)
//   표준 출력: 공개 키 hex(32바이트) — core LICENSE_PUBLIC_KEYS 에 넣는다.
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const kid = args[0];
if (!kid || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(kid)) {
  console.error("사용: node tools/license-keygen.mjs <kid> [--dir <폴더>]  (kid: 영문 소문자·숫자·-)");
  process.exit(2);
}
const dirIdx = args.indexOf("--dir");
const dir = dirIdx >= 0 ? args[dirIdx + 1] : path.join(os.homedir(), ".agentforge", "license-signing");
const out = path.join(dir, `${kid}.pem`);

// 저장소 안에 비밀 키를 만드는 실수를 막는다
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
if (path.resolve(out).toLowerCase().startsWith(repo.toLowerCase() + path.sep)) {
  console.error("비밀 키를 저장소 안에 만들 수 없습니다. --dir 로 저장소 밖 폴더를 지정하세요.");
  process.exit(2);
}
if (fs.existsSync(out)) {
  console.error(`이미 있습니다: ${out} (덮어쓰지 않습니다)`);
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.writeFileSync(out, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
// SPKI DER 의 끝 32바이트가 Ed25519 공개 키 원값
const raw = publicKey.export({ type: "spki", format: "der" }).subarray(-32);
console.error(`비밀 키 저장: ${out}  (백업하세요. 잃어버리면 이 kid 로 새 라이선스를 발급할 수 없습니다)`);
console.log(raw.toString("hex"));
