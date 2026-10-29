// 가져온 스킬의 위험 검사(MKT-02, design.md 9.2). 순수 함수 — I/O 없음.

export type RiskCode = "SCRIPTS" | "BANG_COMMAND" | "BROAD_TOOLS" | "BYPASS_PERMISSIONS" | "REMOTE_DOWNLOAD";

export interface SkillFileLike {
  path: string;
  content: string;
}

const SCRIPT_EXT = /\.(sh|bash|py|js|mjs|cjs|ts|ps1|bat|cmd|exe)$/i;

/** 첫 `---` 블록을 파싱한다(`key: value` 줄, 이어지는 `- 항목` 줄은 값에 공백으로 합침). 없으면 fm 이 null. */
export function parseSkillMd(content: string): { fm: Record<string, string> | null; body: string } {
  const src = content.replace(/^\uFEFF/, "");
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { fm: null, body: src };
  const fm: Record<string, string> = {};
  let last = "";
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]*(.*)$/.exec(line);
    if (kv) {
      last = kv[1]!;
      fm[last] = kv[2]!.trim();
    } else if (last !== "" && /^[ \t]+\S/.test(line)) {
      fm[last] = `${fm[last]} ${line.trim()}`.trim();
    }
  }
  return { fm, body: src.slice(m[0].length) };
}

/** frontmatter 값의 따옴표를 벗긴다. */
export function unquote(v: string): string {
  return v.replace(/^(["'])(.*)\1$/, "$2");
}

// Bash(*)·Bash 단독·* 만 광범위로 본다. Bash(git:*) 처럼 범위를 좁힌 항목은 제외.
const BROAD = /(^|[\s,[\]'"-])(Bash\(\*(?::\*)?\)|Bash|\*)(?=$|[\s,\]'"])/;
const DOWNLOAD = /\b(curl|wget|Invoke-WebRequest|iwr)\b[^\n]*https?:\/\//i;
const PIPE_SHELL = /\|\s*(?:sudo\s+)?(?:ba)?sh\b/;
// 백틱 앞 `!`(동적 명령) 또는 줄 머리 `!`(이미지 `![`·`!=` 제외)
const BANG_INLINE = /!`/;
const BANG_LINE = /^[ \t]*!(?![[=\s])/m;

/** 위험 코드의 정렬된 고유 목록. */
export function scanSkillRisk(files: readonly SkillFileLike[]): RiskCode[] {
  const out = new Set<RiskCode>();
  for (const f of files) {
    const segs = f.path.split("/");
    if (segs.slice(0, -1).includes("scripts") || SCRIPT_EXT.test(f.path)) out.add("SCRIPTS");
    if (/permissionMode:\s*["']?bypassPermissions/.test(f.content) || f.content.includes("dangerously-skip-permissions")) out.add("BYPASS_PERMISSIONS");
    if (DOWNLOAD.test(f.content) || PIPE_SHELL.test(f.content)) out.add("REMOTE_DOWNLOAD");
    if (f.path === "SKILL.md") {
      const { fm, body } = parseSkillMd(f.content);
      if (BANG_INLINE.test(body) || BANG_LINE.test(body)) out.add("BANG_COMMAND");
      const tools = fm?.["allowed-tools"];
      if (tools !== undefined && BROAD.test(tools)) out.add("BROAD_TOOLS");
    }
  }
  return [...out].sort();
}
