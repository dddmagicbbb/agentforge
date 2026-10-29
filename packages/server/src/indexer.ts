// 수집한 파일 목록 -> 스킬 인식·크기/바이너리 판정·위험 flags -> 색인 항목.
import { SkillFilePath, SkillName } from "@agentforge/core";
import type { Collected, IndexedSkill, RawEntry, ScanFn, SkillFile } from "./types.js";

export const LIMITS = { files: 50, fileChars: 200_000, totalChars: 512_000, descChars: 300 } as const;
/** UTF-8 은 문자당 최대 4바이트이므로, 이 바이트 수를 넘으면 문자 수 한도도 반드시 넘는다(내려받기 전 사전 차단) */
const MAX_FILE_BYTES = LIMITS.fileChars * 4;
const MAX_TOTAL_BYTES = LIMITS.totalChars * 4;
const CONCURRENCY = 6;

/** 저장소 안 상대 경로가 안전한지(절대·역슬래시·빈 세그먼트·`.`·`..`·.git 금지) */
export function isSafeRelPath(p: string): boolean {
  if (p === "" || p.startsWith("/") || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((s) => s !== "" && s !== "." && s !== ".." && s.toLowerCase() !== ".git");
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** SKILL.md frontmatter 의 description(한 줄 또는 > | 블록)을 읽는다 */
export function parseDescription(md: string): string {
  const m = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return "";
  const lines = m[1]!.split(/\r?\n/);
  const i = lines.findIndex((l) => /^description\s*:/.test(l));
  if (i < 0) return "";
  let v = lines[i]!.replace(/^description\s*:\s*/, "").trim();
  if (/^[>|][+-]?$/.test(v) || v === "") {
    const block: string[] = [];
    for (const l of lines.slice(i + 1)) {
      if (/^\s+\S/.test(l)) block.push(l.trim());
      else if (l.trim() === "") continue;
      else break;
    }
    v = block.join(" ");
  } else if (/^(".*"|'.*')$/.test(v)) {
    v = v.slice(1, -1);
  }
  return v.slice(0, LIMITS.descChars);
}

function decodeUtf8(buf: Buffer): string | null {
  try {
    const s = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
    return s.includes("\0") ? null : s;
  } catch {
    return null;
  }
}

export interface BuildInput {
  collected: Collected;
  /** 소스의 path(저장소 루트 기준). 없으면 루트 */
  basePath?: string;
  /** src 표시 접두(예: owner/repo 또는 git 주소) */
  srcPrefix: string;
  scan: ScanFn;
}

export async function buildSkills({ collected, basePath, srcPrefix, scan }: BuildInput): Promise<IndexedSkill[]> {
  const prefix = basePath ? `${basePath}/` : "";
  const rel = new Map<string, RawEntry>();
  for (const e of collected.entries) {
    if (!isSafeRelPath(e.path) || !e.path.startsWith(prefix)) continue;
    const r = e.path.slice(prefix.length);
    if (r !== "") rel.set(r, e);
  }
  const paths = [...rel.keys()].sort();

  // 깊이 1~2 에서 SKILL.md 를 가진 폴더 = 스킬. 폴더명이 SkillName 이 아니면 건너뜀, 같은 id 는 먼저 나온 것만
  const dirs: string[] = [];
  const seen = new Set<string>();
  // path 가 스킬 폴더 자체인 경우: 루트 SKILL.md 가 있으면 그 폴더 전체가 하나의 스킬(id = path 의 마지막 폴더명)
  const rootId = basePath?.split("/").pop();
  const rootSkill = rel.has("SKILL.md") && rootId !== undefined && SkillName.safeParse(rootId).success;
  for (const p of rootSkill ? [] : paths) {
    const segs = p.split("/");
    if (segs[segs.length - 1] !== "SKILL.md" || segs.length < 2 || segs.length > 3) continue;
    const dir = segs.slice(0, -1).join("/");
    const id = segs[segs.length - 2]!;
    if (!SkillName.safeParse(id).success || seen.has(id)) continue;
    seen.add(id);
    dirs.push(dir);
  }

  if (rootSkill) dirs.push("");
  const skills: IndexedSkill[] = [];
  for (const dir of dirs) {
    const id = dir === "" ? rootId! : dir.split("/").pop()!;
    const own = paths.filter((p) => dir === "" || p.startsWith(`${dir}/`)).map((p) => ({ full: p, path: dir === "" ? p : p.slice(dir.length + 1), entry: rel.get(p)! }));
    const base = { id, description: "", src: `${srcPrefix}/${prefix}${dir}`.replace(/\/$/, "").slice(0, 200), ref: collected.sha, flags: [] as string[], fileCount: own.length, files: [] as SkillFile[] };

    if (own.some((f) => !SkillFilePath.safeParse(f.path).success)) {
      skills.push({ ...base, blocked: "badPath" });
      continue;
    }
    if (own.length > LIMITS.files || own.some((f) => f.entry.size > MAX_FILE_BYTES) || own.reduce((a, f) => a + f.entry.size, 0) > MAX_TOTAL_BYTES) {
      skills.push({ ...base, blocked: "tooLarge" });
      continue;
    }
    const bufs = await mapLimit(own, CONCURRENCY, (f) => f.entry.load());
    const texts = bufs.map(decodeUtf8);
    const files: SkillFile[] = [];
    let binary = false;
    let chars = 0;
    let tooLarge = false;
    own.forEach((f, i) => {
      const t = texts[i];
      if (t === null || t === undefined) {
        binary = true;
        return;
      }
      chars += t.length;
      if (t.length > LIMITS.fileChars) tooLarge = true;
      files.push({ path: f.path, content: t });
    });
    if (chars > LIMITS.totalChars) tooLarge = true;
    if (tooLarge) {
      skills.push({ ...base, blocked: "tooLarge" });
      continue;
    }
    if (binary) {
      skills.push({ ...base, blocked: "binary" });
      continue;
    }
    const skillMd = files.find((f) => f.path === "SKILL.md")!;
    skills.push({ ...base, description: parseDescription(skillMd.content), flags: [...scan(files)], files });
  }
  return skills.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
