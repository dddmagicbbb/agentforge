import type { Issue } from "@agentforge/core";

export type Tier = "free" | "pro" | "team";
export type LicenseCode = "LICENSE_FORMAT" | "LICENSE_SIGNATURE" | "LICENSE_EXPIRED" | "LICENSE_UNKNOWN_KID";

/** 키 검증 결과. core `verifyLicense` 의 반환 형태(design 10.1)와 같다. */
export type VerifyResult =
  | { readonly ok: true; readonly tier: Tier; readonly licensee: string; readonly seats: number; readonly expires: string | null; readonly id: string }
  | { readonly ok: false; readonly code: LicenseCode };
export type VerifyFn = (key: string, opts: { today: string }) => VerifyResult | Promise<VerifyResult>;

/** 화면이 쓰는 등급 상태. 키 원문은 담지 않는다. */
export interface LicenseState {
  readonly tier: Tier;
  readonly licensee?: string;
  readonly seats?: number;
  readonly expires?: string | null;
  /** 서버가 알려 준 실패 사유(Free 로 동작) */
  readonly code?: LicenseCode;
  /** 서버가 판정한 경우 true: 키 입력 버튼을 숨긴다 */
  readonly fromServer?: boolean;
}

export const FREE: LicenseState = { tier: "free" };

const TIERS: readonly string[] = ["free", "pro", "team"];
const CODES: readonly string[] = ["LICENSE_FORMAT", "LICENSE_SIGNATURE", "LICENSE_EXPIRED", "LICENSE_UNKNOWN_KID"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * TODO(통합): core `tierLimits(tier | null).maxDevelopers` 로 교체한다(null·free 2, pro·team 6).
 * core `checks(input, { license })` 가 LICENSE_LIMIT 을 내면 아래 licenseIssues 는 지운다.
 */
export function maxDevelopers(tier: Tier | null): number {
  return tier === "pro" || tier === "team" ? 6 : 2;
}

/** LICENSE_LIMIT(오류)·LICENSE_INVALID(안내) 항목. core checks 와 같은 code·path·params. */
export function licenseIssues(developerCount: number, state: LicenseState): Issue[] {
  const out: Issue[] = [];
  const max = maxDevelopers(state.tier);
  if (developerCount > max) out.push({ level: "error", code: "LICENSE_LIMIT", path: ["developerCount"], params: { tier: state.tier, max } });
  if (state.code) out.push({ level: "info", code: "LICENSE_INVALID", path: [], params: { code: state.code } });
  return out;
}

/** 서버 `/api/license` 응답 검증. 형태가 틀리면 null(무시). 키 원문 필드는 읽지 않는다. */
export function parseLicenseResponse(data: unknown): LicenseState | null {
  if (!isObj(data) || typeof data["tier"] !== "string" || !TIERS.includes(data["tier"])) return null;
  const { licensee, seats, expires, code } = data;
  if (licensee !== undefined && (typeof licensee !== "string" || licensee.length > 100)) return null;
  if (seats !== undefined && (typeof seats !== "number" || !Number.isInteger(seats) || seats < 1)) return null;
  if (expires !== undefined && expires !== null && (typeof expires !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(expires))) return null;
  if (code !== undefined && (typeof code !== "string" || !CODES.includes(code))) return null;
  const tier = data["tier"] as Tier;
  return {
    tier: code ? "free" : tier,
    fromServer: true,
    ...(licensee !== undefined ? { licensee } : {}),
    ...(seats !== undefined ? { seats } : {}),
    ...(expires !== undefined ? { expires } : {}),
    ...(code ? { code: code as LicenseCode } : {}),
  };
}

/** 서버 등급 조회(같은 출처). 서버가 없거나 응답이 깨졌으면 null. fetch 는 주입한다. */
export async function fetchServerLicense(fetchFn: typeof fetch): Promise<LicenseState | null> {
  try {
    const res = await fetchFn("/api/license");
    if (!res.ok) return null;
    return parseLicenseResponse(await res.json());
  } catch {
    return null;
  }
}

/** 브라우저 날짜(로컬) YYYY-MM-DD */
export function todayIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * TODO(통합): core `verifyLicense` 로 교체한다. 지금은 core 에 함수가 없어 항상 형식 오류를 낸다.
 * 연결 방법: `import { verifyLicense } from "@agentforge/core"; export const defaultVerify: VerifyFn = (k, o) => verifyLicense(k, o);`
 */
export const defaultVerify: VerifyFn = () => ({ ok: false, code: "LICENSE_FORMAT" });
