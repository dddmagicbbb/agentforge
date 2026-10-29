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
  readonly sha?: string;
  readonly indexedAt?: string;
  readonly error?: string;
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
  readonly blocked?: string | boolean;
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

export interface RefreshResult {
  readonly id: string;
  readonly ok?: boolean;
  readonly error?: string;
}

const BASE = "/api/market";

const list = <T,>(data: unknown, key: string): T[] => {
  if (Array.isArray(data)) return data as T[];
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
      throw new MarketError(typeof o.code === "string" ? o.code : "UNKNOWN", (o.params as Record<string, unknown>) ?? {});
    }
    return data;
  }
  const jsonInit = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  return {
    /** 서버 존재 감지. 어떤 실패든 false */
    async health(): Promise<boolean> {
      try {
        const d = (await call("/health")) as { ok?: unknown } | null;
        return d?.ok === true;
      } catch {
        return false;
      }
    },
    async sources(): Promise<MarketSource[]> {
      return list<MarketSource>(await call("/sources"), "sources");
    },
    async addSource(s: NewSource): Promise<void> {
      await call("/sources", jsonInit("POST", s));
    },
    async removeSource(id: string): Promise<void> {
      await call(`/sources/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
    async refresh(id?: string): Promise<RefreshResult[]> {
      return list<RefreshResult>(await call("/refresh", jsonInit("POST", id ? { id } : {})), "results");
    },
    async search(q: string, trust: string): Promise<SearchHit[]> {
      const p = new URLSearchParams();
      p.set("q", q);
      if (trust) p.set("trust", trust);
      return list<SearchHit>(await call(`/search?${p.toString()}`), "items");
    },
    async skill(sourceId: string, skillId: string): Promise<SkillDetail> {
      return (await call(`/skills/${encodeURIComponent(sourceId)}/${encodeURIComponent(skillId)}`)) as SkillDetail;
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
