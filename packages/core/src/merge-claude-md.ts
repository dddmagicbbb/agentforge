import { AppError } from "./errors.js";

// DOC-03: CLAUDE.md 재생성 병합(design.md 8.1). 순수 함수, I/O 없음.

const IDS = ["PROJECT", "AGENTS", "DEVS", "SKILLS"] as const;
type SectionId = (typeof IDS)[number];
/** 재생성 시 next 내용으로 교체하는 구간(PROJECT 는 사용자·AI 소유라 제외) */
const REPLACED: readonly SectionId[] = ["AGENTS", "DEVS", "SKILLS"];

const begin = (id: SectionId) => `<!-- AGENTFORGE:${id}:BEGIN -->`;
const end = (id: SectionId) => `<!-- AGENTFORGE:${id}:END -->`;

interface Span {
  /** BEGIN 마커 시작 위치 */
  readonly start: number;
  /** 안쪽 시작(BEGIN 마커 직후) */
  readonly inner: number;
  /** 안쪽 끝(END 마커 시작) */
  readonly innerEnd: number;
  /** END 마커 직후 */
  readonly stop: number;
}

function count(s: string, needle: string): number {
  return s.split(needle).length - 1;
}

/** 구간 위치를 찾는다. 없으면 undefined, BEGIN·END 짝이 맞지 않으면 CLAUDE_MD_MARKERS. */
function locate(md: string, id: SectionId): Span | undefined {
  const b = begin(id);
  const e = end(id);
  const nb = count(md, b);
  const ne = count(md, e);
  if (nb === 0 && ne === 0) return undefined;
  if (nb !== 1 || ne !== 1) throw new AppError("CLAUDE_MD_MARKERS", { id });
  const start = md.indexOf(b);
  const innerEnd = md.indexOf(e);
  if (innerEnd < start + b.length) throw new AppError("CLAUDE_MD_MARKERS", { id });
  return { start, inner: start + b.length, innerEnd, stop: innerEnd + e.length };
}

/** CLAUDE.md 재생성 병합: old 가 뼈대, AGENTS·DEVS·SKILLS 안쪽만 next 로 교체, PROJECT 는 old 보존. */
export function mergeClaudeMdImpl(oldMd: string, nextMd: string): string {
  // 짝 오류는 양쪽 모두 먼저 검사한다
  const oldSpans = locateAll(oldMd);
  const nextSpans = locateAll(nextMd);

  // 1) old 에 있는 교체 대상 구간의 안쪽을 뒤에서부터 바꾼다(앞쪽 위치가 밀리지 않게)
  let out = oldMd;
  const replacements = REPLACED.flatMap((id) => {
    const o = oldSpans.get(id);
    const n = nextSpans.get(id);
    return o && n ? [{ o, text: nextMd.slice(n.inner, n.innerEnd) }] : [];
  }).sort((a, b) => b.o.inner - a.o.inner);
  for (const r of replacements) out = out.slice(0, r.o.inner) + r.text + out.slice(r.o.innerEnd);

  // 2) next 에만 있는 구간은 끝에 붙인다(마커 포함)
  const missing = IDS.flatMap((id) => {
    const n = nextSpans.get(id);
    return n && !oldSpans.get(id) ? [nextMd.slice(n.start, n.stop)] : [];
  });
  if (missing.length === 0) return out;
  const base = out.replace(/(\r?\n)+$/, "");
  return `${base === "" ? "" : `${base}\n\n`}${missing.join("\n\n")}\n`;
}

/** 모든 구간을 찾고, 서로 다른 ID 구간이 엇갈리거나 포함되면(겹침) 뒤 구간 ID 로 오류를 던진다. */
function locateAll(md: string): Map<SectionId, Span | undefined> {
  const spans = new Map(IDS.map((id) => [id, locate(md, id)] as const));
  const found = IDS.flatMap((id) => {
    const s = spans.get(id);
    return s ? [{ id, s }] : [];
  }).sort((a, b) => a.s.start - b.s.start);
  for (let i = 1; i < found.length; i++) {
    if (found[i - 1]!.s.stop > found[i]!.s.start) throw new AppError("CLAUDE_MD_MARKERS", { id: found[i]!.id });
  }
  return spans;
}
