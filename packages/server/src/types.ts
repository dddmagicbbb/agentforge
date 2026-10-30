// 서버 공용 타입. fetch 는 전역 fetch 와 호환되는 최소 형태만 요구한다(시험에서 주입).
export interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}
export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<FetchResponseLike>;

export interface SkillFile {
  path: string;
  content: string;
}

/** 위험 검사. 통합 시 core 의 scanSkillRisk 를 연결한다(결정적·정렬된 코드 목록) */
export type ScanFn = (files: readonly SkillFile[]) => readonly string[];

export type Trust = "official" | "org" | "community" | "unverified";

/** 수집기가 돌려주는 원시 파일(경로는 소스 path 기준 상대) */
export interface RawEntry {
  path: string;
  size: number;
  load(): Promise<Buffer>;
}

export interface Collected {
  sha: string;
  entries: RawEntry[];
}

export interface SourceRecord {
  id: string;
  kind: "github" | "git";
  trust: Trust;
  tokenEnv?: string;
  ref?: string;
  path?: string;
  owner?: string;
  repo?: string;
  baseUrl?: string;
  url?: string;
  lastIndexedAt?: string;
  lastSha?: string;
  lastError?: string;
}

export interface IndexedSkill {
  id: string;
  description: string;
  src: string;
  ref: string;
  flags: string[];
  fileCount: number;
  blocked?: "tooLarge" | "binary" | "badPath";
  files: SkillFile[];
}

export interface IndexFile {
  sourceId: string;
  sha: string;
  indexedAt: string;
  skills: IndexedSkill[];
}

/** HTTP 상태와 {code, params} 로 변환되는 오류. 내부 메시지는 담지 않는다 */
export class ServerError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly params: Record<string, string | number | boolean> = {},
  ) {
    super(code);
    this.name = "ServerError";
  }
}
