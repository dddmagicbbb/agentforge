import { defaultDraft, render, validate, type ProjectInput, type RenderedFile } from "../src/index.js";

/** 기본 입력을 patch 로 바꿔 검증·렌더한다. 검증 실패면 즉시 throw. */
export function build(patch: (d: ProjectInput) => void = () => {}): RenderedFile[] {
  const d = defaultDraft();
  patch(d);
  const v = validate(d);
  if (!v.project) throw new Error(`입력 검증 실패: ${JSON.stringify(v.issues)}`);
  return render(v.project);
}

export const find = (files: readonly RenderedFile[], p: string): string => files.find((f) => f.path === p)?.content ?? "";

/** frontmatter 의 skills: 목록 추출 */
export function fmSkills(md: string): string[] {
  const m = /^skills:\n((?: {2}- .+\n)+)/m.exec(md);
  return m ? m[1]!.split("\n").filter(Boolean).map((l) => l.replace(/^ {2}- /, "")) : [];
}

/** 첫 `---` 블록을 key: value 로 파싱(단순 한 줄 값만) */
export function frontmatter(md: string): Record<string, string> | null {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (!m) return null;
  const out: Record<string, string> = {};
  for (const line of m[1]!.split("\n")) {
    const kv = /^([A-Za-z-]+):\s?(.*)$/.exec(line);
    if (kv) out[kv[1]!] = kv[2]!;
  }
  return out;
}
