import { generateKeyPairSync, sign } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LICENSE_PUBLIC_KEYS,
  canExport,
  checks,
  defaultDraft,
  tierLimits,
  verifyLicense,
  type LicenseResult,
  type ProjectInput,
} from "../src/index.js";

// T-801 LIC-01: 라이선스 검증·등급 강제

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const pubRaw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const pubHex = Buffer.from(pubRaw).toString("hex");
const KEYS = { "t-1": pubHex };
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

const base = { v: 1, kid: "t-1", id: "11111111-1111-4111-8111-111111111111", tier: "pro", licensee: "ACME", seats: 5, issued: "2026-01-01", expires: "2027-01-01" };
function make(over: Record<string, unknown> = {}, signWith = privateKey): string {
  const head = `AF1.${b64(JSON.stringify({ ...base, ...over }))}`;
  return `${head}.${b64(sign(null, Buffer.from(head, "utf8"), signWith))}`;
}
const TODAY = "2026-10-30";
const v = (k: string, today = TODAY) => verifyLicense(k, { today, publicKeys: KEYS });
const code = (r: LicenseResult) => (r.ok ? "OK" : r.code);

describe("verifyLicense 정상", () => {
  it.each(["free", "pro", "team"] as const)("%s 키", (tier) => {
    const r = v(make({ tier }));
    expect(r).toEqual({ ok: true, tier, licensee: "ACME", seats: 5, expires: "2027-01-01", id: base.id });
  });
  it("expires null 은 만료 없음", () => {
    const r = v(make({ expires: null }));
    expect(r.ok && r.expires).toBe(null);
  });
  it("만료 경계: expires == today 유효, 하루 전은 만료", () => {
    expect(code(v(make({ expires: TODAY })))).toBe("OK");
    expect(code(v(make({ expires: "2026-10-29" })))).toBe("LICENSE_EXPIRED");
  });
  it("앞뒤 공백·줄바꿈·중간 줄바꿈 무시", () => {
    const k = make();
    expect(code(v(`  \n${k}\r\n`))).toBe("OK");
    expect(code(v(`${k.slice(0, 30)}\n${k.slice(30)}`))).toBe("OK");
  });
  it("공개 키는 Uint8Array 도 허용", () => {
    expect(code(verifyLicense(make(), { today: TODAY, publicKeys: { "t-1": new Uint8Array(pubRaw) } }))).toBe("OK");
  });
});

describe("verifyLicense 거부", () => {
  it("payload 의 tier 변경(위조)", () => {
    const [h, p, s] = make({ tier: "free" }).split(".");
    const forged = `${h}.${b64(JSON.stringify({ ...base, tier: "team" }))}.${s}`;
    expect(p).toBeTruthy();
    expect(code(v(forged))).toBe("LICENSE_SIGNATURE");
  });
  it("서명 1비트 변경", () => {
    const parts = make().split(".");
    const sig = Buffer.from(parts[2]!, "base64url");
    sig[0] = sig[0]! ^ 1;
    expect(code(v(`${parts[0]}.${parts[1]}.${b64(sig)}`))).toBe("LICENSE_SIGNATURE");
  });
  it("다른 키로 서명", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    expect(code(v(make({}, other)))).toBe("LICENSE_SIGNATURE");
  });
  it("모르는 kid", () => {
    expect(code(v(make({ kid: "zz-9" })))).toBe("LICENSE_UNKNOWN_KID");
  });
  it("기본 공개 키(운영)로는 시험 키가 서명 불일치/모르는 kid", () => {
    expect(code(verifyLicense(make(), { today: TODAY }))).toBe("LICENSE_UNKNOWN_KID");
    expect(code(verifyLicense(make({ kid: "af-2026-1" }), { today: TODAY }))).toBe("LICENSE_SIGNATURE");
  });
  const fmt: [string, string][] = [
    ["빈 문자열", ""],
    ["조각 2개", "AF1.abc"],
    ["조각 4개", `${make()}.x`],
    ["접두 불일치", make().replace("AF1.", "AF2.")],
    ["base64url 아님", "AF1.!!!.???"],
    ["JSON 아님", (() => { const h = `AF1.${b64("not json")}`; return `${h}.${b64(sign(null, Buffer.from(h), privateKey))}`; })()],
    ["필드 누락", make({ licensee: undefined })],
    ["잘못된 tier", make({ tier: "gold" })],
    ["seats 0", make({ seats: 0 })],
    ["seats 10001", make({ seats: 10001 })],
    ["seats 소수", make({ seats: 1.5 })],
    ["licensee 빈값", make({ licensee: "" })],
    ["licensee 101자", make({ licensee: "a".repeat(101) })],
    ["v 불일치", make({ v: 2 })],
    ["날짜 형식 오류", make({ issued: "2026/01/01" })],
    ["expires 형식 오류", make({ expires: "2027-1-1" })],
    ["2000자 초과", `AF1.${"a".repeat(2000)}.b`],
  ];
  it.each(fmt)("형식 오류: %s", (_n, k) => {
    expect(code(v(k))).toBe("LICENSE_FORMAT");
  });
  it("today 형식 오류", () => {
    expect(code(v(make(), "2026-1-1"))).toBe("LICENSE_FORMAT");
    expect(code(v(make(), ""))).toBe("LICENSE_FORMAT");
  });
  it("문자열이 아닌 입력도 throw 하지 않는다", () => {
    fc.assert(fc.property(fc.anything(), (x) => {
      expect(() => verifyLicense(x as string, { today: TODAY, publicKeys: KEYS })).not.toThrow();
    }));
    fc.assert(fc.property(fc.string(), (s) => v(s).ok === false));
  });
});

describe("T-801 리뷰 반영", () => {
  it("작은 차수 공개 키 + identity 서명(R=identity, S=0) 거부 (RFC 8032 엄격)", () => {
    const ident = "01" + "00".repeat(31);
    const head = `AF1.${b64(JSON.stringify({ ...base, kid: "t-small" }))}`;
    const sig = Buffer.from(ident + "00".repeat(32), "hex");
    const r = verifyLicense(`${head}.${b64(sig)}`, { today: TODAY, publicKeys: { "t-small": ident } });
    expect(code(r)).toBe("LICENSE_SIGNATURE");
  });
  it("base64url 꼬리 비트가 0 이 아니면 LICENSE_FORMAT", () => {
    const parts = make().split(".");
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const last = parts[2]!.slice(-1);
    const flipped = parts[2]!.slice(0, -1) + A[A.indexOf(last) ^ 1];
    expect(code(v(`${parts[0]}.${parts[1]}.${flipped}`))).toBe("LICENSE_FORMAT");
  });
  it.each([["hex 아님", "zz".repeat(32)], ["31바이트", "ab".repeat(31)], ["Uint8Array 31바이트", new Uint8Array(31)]])("등록된 공개 키 값 오류(%s)는 LICENSE_SIGNATURE", (_n, bad) => {
    expect(code(verifyLicense(make(), { today: TODAY, publicKeys: { "t-1": bad } }))).toBe("LICENSE_SIGNATURE");
  });
  it.each(["2026-02-30", "2026-13-01", "2025-02-29", "2026-00-10", "2026-04-31"])("today 가 실제 날짜가 아님: %s", (d) => {
    expect(code(v(make(), d))).toBe("LICENSE_FORMAT");
  });
  it("윤일은 유효", () => {
    expect(code(v(make(), "2024-02-29"))).toBe("OK");
  });
  it("payload 날짜도 실제 날짜여야 한다", () => {
    expect(code(v(make({ expires: "2027-02-30" })))).toBe("LICENSE_FORMAT");
  });
});

describe("운영 공개 키", () => {
  it("af-2026-1 은 32바이트 hex", () => {
    expect(LICENSE_PUBLIC_KEYS["af-2026-1"]).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("tierLimits·checks 등급 강제", () => {
  it("상한", () => {
    expect(tierLimits(null)).toEqual({ maxDevelopers: 2 });
    expect(tierLimits("free")).toEqual({ maxDevelopers: 2 });
    expect(tierLimits("pro")).toEqual({ maxDevelopers: 6 });
    expect(tierLimits("team")).toEqual({ maxDevelopers: 6 });
  });
  const withN = (n: number): ProjectInput => {
    const d = defaultDraft();
    d.developerCount = n;
    d.devs = d.devs.slice(0, n);
    return d;
  };
  const ok = (tier: "free" | "pro" | "team"): LicenseResult => ({ ok: true, tier, licensee: "A", seats: 1, expires: null, id: "i" });
  const limit = (i: ReturnType<typeof checks>) => i.find((x) => x.code === "LICENSE_LIMIT");
  it("Free(인자 없음) 2/3 경계", () => {
    expect(limit(checks(withN(2)))).toBeUndefined();
    expect(limit(checks(withN(3)))).toEqual({ level: "error", code: "LICENSE_LIMIT", path: ["developerCount"], params: { tier: "free", max: 2 } });
    expect(canExport(checks(withN(3)))).toBe(false);
  });
  it("Pro 6/7 경계", () => {
    expect(limit(checks(withN(6), { license: ok("pro") }))).toBeUndefined();
    const d = withN(6);
    d.developerCount = 7;
    expect(limit(checks(d, { license: ok("pro") }))?.params).toEqual({ tier: "pro", max: 6 });
    expect(limit(checks(withN(3), { license: ok("team") }))).toBeUndefined();
  });
  it("실패한 license 는 info LICENSE_INVALID + Free 상한", () => {
    const bad: LicenseResult = { ok: false, code: "LICENSE_EXPIRED" };
    const r = checks(withN(3), { license: bad });
    expect(r.find((x) => x.code === "LICENSE_INVALID")).toEqual({ level: "info", code: "LICENSE_INVALID", path: [], params: { code: "LICENSE_EXPIRED" } });
    expect(limit(r)?.params).toEqual({ tier: "free", max: 2 });
  });
  it("정상 license 에는 LICENSE_INVALID 가 없다", () => {
    expect(checks(withN(2), { license: ok("pro") }).some((x) => x.code === "LICENSE_INVALID")).toBe(false);
  });
});
