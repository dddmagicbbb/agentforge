import { ed25519 } from "@noble/curves/ed25519.js";
import { z } from "zod";

// LIC-01 라이선스 키 검증(design 10.1, ADR-0008). 순수 함수 — Date·I/O 금지, 오늘 날짜는 인자로 받는다.
// 형식: AF1.<b64url(payload)>.<b64url(Ed25519 서명)>, 서명 대상은 "AF1.<b64url(payload)>" 의 UTF-8 바이트.

export type LicenseTier = "free" | "pro" | "team";
export type LicenseErrorCode = "LICENSE_FORMAT" | "LICENSE_UNKNOWN_KID" | "LICENSE_SIGNATURE" | "LICENSE_EXPIRED";
export type LicenseResult =
  | { readonly ok: true; readonly tier: LicenseTier; readonly licensee: string; readonly seats: number; readonly expires: string | null; readonly id: string }
  | { readonly ok: false; readonly code: LicenseErrorCode };

/** 운영 공개 키(kid → 32바이트 hex). 비밀 키는 저장소에 없다. */
export const LICENSE_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  "af-2026-1": "3dcad4039de3a1d45d72fbdf1f442008600fb3ec1bfd1e50a26ecd17d2df0bb1",
};

export interface VerifyLicenseOptions {
  /** 오늘 날짜 YYYY-MM-DD(호출자가 정한다) */
  readonly today: string;
  readonly publicKeys?: Readonly<Record<string, Uint8Array | string>>;
}

const MAX_KEY_LENGTH = 2000;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const B64URL = /^[A-Za-z0-9_-]+$/;
const HEX = /^[0-9a-fA-F]{64}$/;

const Payload = z.object({
  v: z.literal(1),
  kid: z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/),
  id: z.string().min(1).max(64),
  tier: z.enum(["free", "pro", "team"]),
  licensee: z.string().min(1).max(100),
  seats: z.number().int().min(1).max(10000),
  issued: z.string().regex(DATE),
  expires: z.string().regex(DATE).nullable(),
});

const fail = (code: LicenseErrorCode): LicenseResult => ({ ok: false, code });

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// core 는 DOM·Node 타입이 없으므로 base64url 을 직접 푼다(패딩 없음, 잘못된 길이는 throw)
function b64urlDecode(s: string): Uint8Array {
  if (s.length % 4 === 1) throw new Error("base64url");
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of s) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
      acc &= (1 << bits) - 1;
    }
  }
  return Uint8Array.from(out);
}

// 엄격한 UTF-8 해석(잘못된 바이트열이면 throw)
function utf8Decode(b: Uint8Array): string {
  return decodeURIComponent(Array.from(b, (x) => "%" + x.toString(16).padStart(2, "0")).join(""));
}

function pubBytes(v: Uint8Array | string): Uint8Array | null {
  if (typeof v !== "string") return v.length === 32 ? v : null;
  if (!HEX.test(v)) return null;
  return Uint8Array.from(v.match(/../g)!, (h) => parseInt(h, 16));
}

export function verifyLicense(key: string, opts: VerifyLicenseOptions): LicenseResult {
  if (typeof key !== "string" || typeof opts?.today !== "string" || !DATE.test(opts.today)) return fail("LICENSE_FORMAT");
  const k = key.replace(/\s+/g, "");
  if (k.length === 0 || k.length > MAX_KEY_LENGTH) return fail("LICENSE_FORMAT");
  const parts = k.split(".");
  if (parts.length !== 3 || parts[0] !== "AF1" || !B64URL.test(parts[1]!) || !B64URL.test(parts[2]!)) return fail("LICENSE_FORMAT");

  let payload: z.infer<typeof Payload>;
  let sig: Uint8Array;
  try {
    const text = utf8Decode(b64urlDecode(parts[1]!));
    const r = Payload.safeParse(JSON.parse(text));
    if (!r.success) return fail("LICENSE_FORMAT");
    payload = r.data;
    sig = b64urlDecode(parts[2]!);
  } catch {
    return fail("LICENSE_FORMAT");
  }

  const keys = opts.publicKeys ?? LICENSE_PUBLIC_KEYS;
  if (!Object.prototype.hasOwnProperty.call(keys, payload.kid)) return fail("LICENSE_UNKNOWN_KID");
  const pub = pubBytes(keys[payload.kid]!);
  if (!pub) return fail("LICENSE_SIGNATURE");
  try {
    if (!ed25519.verify(sig, Uint8Array.from(`AF1.${parts[1]}`, (c) => c.charCodeAt(0)), pub)) return fail("LICENSE_SIGNATURE");
  } catch {
    return fail("LICENSE_SIGNATURE");
  }

  // YYYY-MM-DD 는 문자열 비교가 날짜 비교와 같다
  if (payload.expires !== null && payload.expires < opts.today) return fail("LICENSE_EXPIRED");
  return { ok: true, tier: payload.tier, licensee: payload.licensee, seats: payload.seats, expires: payload.expires, id: payload.id };
}

/** 등급별 개발자 상한. 라이선스가 없거나 free 이면 2, pro·team 은 6. */
export function tierLimits(tier: LicenseTier | null): { maxDevelopers: number } {
  return { maxDevelopers: tier === "pro" || tier === "team" ? 6 : 2 };
}
