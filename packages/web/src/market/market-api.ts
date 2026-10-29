import type { ImportedSkillT } from "@agentforge/core";

export type Trust = ImportedSkillT["trust"];

/** 서버 오류 응답 `{ code, params }` 를 코드로만 전달한다. 문장은 화면에서 만든다. */
export class MarketError extends Error {
  constructor(readonly code: string, readonly params: Record<string, unknown> = {}) {
    super(code);
    this.name = "MarketError";
  }
}

export interface MarketSource {
  readonly id: string;
  readonly kind: string;
  readonly trust: Trust;
  readonly owner?: string;
  readonly repo?: string;
  readonly url?: string;
  readonly ref?: string;
  readonly path?: string;
  readonly baseUrl?: string;
  readonly tokenEnv?: string;
  readonly lastSha?: string;
  readonly lastIndexedAt?: string;
  /** 마지막 색인 오류 코드 */
  readonly lastError?: string;
}

/** 등록 요청 본문. 토큰 값 필드는 없다(tokenEnv 는 서버 환경 변수 "이름"). */
export interface NewSource {
  readonly kind: "github" | "git";
  readonly id: string;
  readonly trust: Trust;
  readonly owner?: string;
  readonly repo?: string;
  readonly url?: string;
  readonly ref?: string;
  readonly path?: string;
  readonly baseUrl?: string;
  readonly tokenEnv?: string;
}

export interface SearchHit {
  readonly sourceId: string;
  readonly id: string;
  readonly description: string;
  readonly trust: Trust;
  readonly src: string;
  readonly ref?: string | null;
  readonly flags: readonly string[];
  readonly fileCount: number;
  readonly blocked?: "tooLarge" | "binary" | "badPath";
}

export interface SkillDetail {
  readonly id: string;
  readonly src: string;
  readonly trust: Trust;
  readonly ref?: string | null;
  readonly description: string;
  readonly flags: readonly string[];
  readonly files: readonly { readonly path: string; readonly content: string }[];
}

/** 갱신 결과. 실패도 HTTP 200 이며 code 로 구분한다 */
export interface RefreshResult {
  readonly id: string;
  readonly ok: boolean;
  readonly sha?: string;
  readonly skillCount?: number;
  readonly code?: string;
  readonly params?: Record<string, unknown>;
}

const TRUSTS = ["official", "org", "community", "unverified"];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isStr = (v: unknown): v is string => typeof v === "string";
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
/** 서버 응답 런타임 검증(R2): 필수 필드가 없거나 형식이 틀린 항목은 걸러낸다 */
const okSource = (v: unknown): v is MarketSource => isObj(v) && isStr(v["id"]) && isStr(v["kind"]) && isStr(v["trust"]) && TRUSTS.includes(v["trust"]);
const okHit = (v: unknown): v is SearchHit =>
  isObj(v) && isStr(v["sourceId"]) && isStr(v["id"]) && isStr(v["description"]) && isStr(v["src"]) && isStr(v["trust"]) && TRUSTS.includes(v["trust"]) && strs(v["flags"]) && typeof v["fileCount"] === "number";
const okDetail = (v: unknown): v is SkillDetail =>
  isObj(v) && isStr(v["id"]) && isStr(v["src"]) && isStr(v["trust"]) && TRUSTS.includes(v["trust"]) && isStr(v["description"]) && strs(v["flags"]) &&
  Array.isArray(v["files"]) && v["files"].every((f) => isObj(f) && isStr(f["path"]) && isStr(f["content"]));

const BASE = "/api/market";

/** 계약(design 9.7)의 정확한 키 하나만 읽는다 */
const list = <T,>(data: unknown, key: string): T[] => {
  const inner = (data as Record<string, unknown> | null)?.[key];
  return Array.isArray(inner) ? (inner as T[]) : [];
};

/** 마켓 서버 API(같은 출처). fetch 는 주입한다(시험·미지원 환경). */
export function createMarketApi(fetchFn: typeof fetch) {
  async function call(path: string, init?: RequestInit): Promise<unknown> {
    let res: Response;
    try {
      res = await fetchFn(`${BASE}${path}`, init);
    } catch {
      throw new MarketError("NETWORK");
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* JSON 이 아닌 응답 */
    }
    if (!res.ok) {
      const o = (data ?? {}) as { code?: unknown; params?: unknown };
      throw new MarketError(typeof o.code === "string" && /^[A-Za-z_]+$/.test(o.code) ? o.code : "UNKNOWN", (o.params as Record<string, unknown>) ?? {});
    }
    return data;
  }
  const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  return {
    /** 서버 존재 감지. 어떤 실패든 null, 성공이면 admin 여부 */
    async health(): Promise<{ admin: boolean } | null> {
      try {
        const d = (await call("/health")) as { ok?: unknown; admin?: unknown } | null;
        return d?.ok === true ? { admin: d.admin === true } : null;
      } catch {
        return null;
      }
    },
    async sources(): Promise<MarketSource[]> {
      return list<unknown>(await call("/sources"), "sources").filter(okSource);
    },
    async addSource(s: NewSource): Promise<void> {
      await call("/sources", jsonInit("POST", s));
    },
    async removeSource(id: string): Promise<void> {
      await call(`/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async refresh(id?: string): Promise<RefreshResult[]> {
      return list<unknown>(await call("/refresh", jsonInit("POST", id ? { id } : {})), "results").filter((r): r is RefreshResult => isObj(r) && isStr(r["id"]) && typeof r["ok"] === "boolean");
    },
    async search(q: string, trust: string): Promise<SearchHit[]> {
      const p = new URLSearchParams();
      p.set("q", q);
      if (trust) p.set("trust", trust);
      return list<unknown>(await call(`/search?${p.toString()}`), "skills").filter(okHit);
    },
    async skill(sourceId: string, skillId: string): Promise<SkillDetail> {
      const d = await call(`/skills/${encodeURIComponent(sourceId)}/${encodeURIComponent(skillId)}`);
      if (!okDetail(d)) throw new MarketError("UNKNOWN");
      return d;
    },
  };
}

export type MarketApi = ReturnType<typeof createMarketApi>;

/** 서버 응답 -> ImportedSkill. 위험 flags 는 응답 그대로(core 가 files 로 재계산·판정). */
export function toImported(d: SkillDetail): ImportedSkillT {
  return {
    id: d.id,
    src: d.src,
    trust: d.trust,
    desc: d.description.slice(0, 300),
    flags: [...d.flags],
    target: "all",
    acknowledged: false,
    ...(d.ref ? { ref: d.ref } : {}),
    files: d.files.map((f) => ({ path: f.path, content: f.content })),
  };
}
