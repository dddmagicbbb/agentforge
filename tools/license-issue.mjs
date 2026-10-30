// 라이선스 키 발급(ADR-0008, T-800). 형식: AF1.<b64url(payload)>.<b64url(Ed25519 서명)>
// 사용: node tools/license-issue.mjs --kid <kid> --tier free|pro|team --licensee <이름> [--seats N] [--expires YYYY-MM-DD] [--issued YYYY-MM-DD] [--key <비밀 키 pem>]
//   비밀 키 기본 위치: ~/.agentforge/license-signing/<kid>.pem
import { createPrivateKey, randomUUID, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const opt = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, "")] = argv[i + 1];

const fail = (m) => { console.error(m); process.exit(2); };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
if (!opt.kid || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(opt.kid)) fail("--kid 가 필요합니다(영문 소문자·숫자·-)");
if (!["free", "pro", "team"].includes(opt.tier)) fail("--tier 는 free|pro|team");
if (!opt.licensee || opt.licensee.length > 100) fail("--licensee 는 1~100자");
const seats = Number(opt.seats ?? 1);
if (!Number.isInteger(seats) || seats < 1 || seats > 10000) fail("--seats 는 1~10000");
if (opt.expires && !DATE.test(opt.expires)) fail("--expires 는 YYYY-MM-DD");
const issued = opt.issued ?? new Date().toISOString().slice(0, 10);
if (!DATE.test(issued)) fail("--issued 는 YYYY-MM-DD");

const keyPath = opt.key ?? path.join(os.homedir(), ".agentforge", "license-signing", `${opt.kid}.pem`);
if (!fs.existsSync(keyPath)) fail(`비밀 키가 없습니다: ${keyPath}`);
const privateKey = createPrivateKey(fs.readFileSync(keyPath));

const payload = { v: 1, kid: opt.kid, id: randomUUID(), tier: opt.tier, licensee: opt.licensee, seats, issued, expires: opt.expires ?? null };
const b64 = (buf) => Buffer.from(buf).toString("base64url");
const head = `AF1.${b64(JSON.stringify(payload))}`;
const sig = sign(null, Buffer.from(head, "utf8"), privateKey);
console.log(`${head}.${b64(sig)}`);
