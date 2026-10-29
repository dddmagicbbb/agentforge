// 가져온 스킬의 위험 검사(MKT-02, design.md 9.2·9.7). 순수 함수 — I/O 없음.
// "애매하면 위험" 원칙: 오탐은 사용자 확인으로 해소되지만 미탐은 보안 사고다.
// 알려진 오탐: 마크다운 표의 `| bash |` 같은 셀, 줄 머리 `!공백아님` 문장.

export type RiskCode = "SCRIPTS" | "BANG_COMMAND" | "BROAD_TOOLS" | "BYPASS_PERMISSIONS" | "REMOTE_DOWNLOAD";

export interface SkillFileLike {
  path: string;
  content: string;
}

export interface SkillMd {
  /** 키별 첫 값(이어지는 들여쓰기·`- 항목` 줄은 공백으로 합침). frontmatter 가 없으면 null */
  fm: Record<string, string> | null;
  /** 같은 키가 여러 번 나오면 모든 값을 공백으로 합친 것 */
  fmAll: Record<string, string>;
  body: string;
}

const SCRIPT_EXT = /\.(sh|bash|zsh|py|rb|pl|js|mjs|cjs|ts|ps1|bat|cmd|exe)$/i;
// 경로의 SKILL.md 판정은 대소문자를 구분하지 않는다(skill.md 로 우회 방지)
const isSkillMd = (path: string): boolean => /(^|\/)skill\.md$/i.test(path);

/** 키 정규화: 소문자, `_` → `-` (Allowed-Tools, allowed_tools 를 같은 키로) */
const normKey = (k: string): string => k.toLowerCase().replace(/_/g, "-");

/** 첫 `---` 블록을 파싱한다(`key : value`, 따옴표 키, CRLF, 들여쓰기 없는 `- 항목` 허용). */
export function parseSkillMd(content: string): SkillMd {
  const src = content.replace(/^﻿/, "");
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(src);
  if (!m) return { fm: null, fmAll: {}, body: src };
  const fm: Record<string, string> = {};
  const fmAll: Record<string, string> = {};
  let last = "";
  let first = false;
  for (const line of m[1]!.split(/\r?\n/)) {
    const kv = /^(["']?)([A-Za-z][\w-]*)\1[ \t]*:[ \t]*(.*)$/.exec(line);
    if (kv) {
      last = normKey(kv[2]!);
      first = !(last in fm);
      if (first) fm[last] = kv[3]!.trim();
      fmAll[last] = `${fmAll[last] ?? ""} ${kv[3]!.trim()}`.trim();
    } else if (last !== "" && /\S/.test(line)) {
      if (first) fm[last] = `${fm[last]} ${line.trim()}`.trim();
      fmAll[last] = `${fmAll[last]} ${line.trim()}`.trim();
    }
  }
  return { fm, fmAll, body: src.slice(m[0].length) };
}

/** frontmatter 값의 따옴표를 벗긴다. */
export function unquote(v: string): string {
  return v.replace(/^(["'])(.*)\1$/, "$2");
}

// Bash(*)·Bash(**)·Bash 단독·* 만 광범위로 본다(도구 이름 대소문자 무시).
// Bash(git:*)·Bash(npm run *) 처럼 범위를 좁힌 항목은 제외.
const BROAD = /(^|[\s,[\]'"-])(Bash\(\s*\*+(?::\*+)?\s*\)|Bash|\*)(?=$|[\s,\]'"])/i;

const DOWNLOAD = /\b(?:curl|wget|Invoke-WebRequest|iwr|Invoke-RestMethod|irm)\b[^\n]*https?:\/\//i;
// 인터프리터가 URL 을 직접 여는 코드
const INTERP = /(?:urllib|urlopen|requests\.\w+|fetch\(|LWP|Net::HTTP|https?\.get)[^\n]*https?:\/\//i;

const SHELLS = "(?:sh|bash|zsh|dash|ksh)";
// 접두 명령(경로 허용) + 옵션(인자 1개까지) + 환경변수 할당
const PREFIX = String.raw`(?:(?:\S*/)?(?:sudo|env|command|exec|nohup|time)\s+(?:-\S+(?:\s+[^-\s|;&]\S*)?\s+|\w+=\S+\s+)*)*`;
const PIPE_SHELL = new RegExp(
  String.raw`(?:\||>\()\s*${PREFIX}(?:\S*/)?${SHELLS}\b(?![-.\w])|\|\s*(?:iex|Invoke-Expression)\b`,
  "i",
);
const BYPASS = /bypassPermissions|dangerously-skip-permissions/i;
// 백틱 앞 `!`(동적 명령) 또는 줄 머리 `!`+비공백(이미지 `![`·`!=` 제외)
const BANG_INLINE = /!`/;
const BANG_LINE = /^[ \t]*!(?![[=\s])/m;

/** 줄 이어쓰기(`\`, PowerShell 백틱, 줄 끝 `|`, 여는 괄호)를 합쳐 한 줄로 만든다. */
function joinContinuations(s: string): string {
  return s
    .replace(/\\[ \t]*\r?\n/g, " ")
    .replace(/`[ \t]*\r?\n/g, " ")
    .replace(/\|[ \t]*\r?\n[ \t]*/g, "| ")
    .replace(/\([ \t]*\r?\n\s*/g, "(");
}

/** 위험 코드의 정렬된 고유 목록. */
export function scanSkillRisk(files: readonly SkillFileLike[]): RiskCode[] {
  const out = new Set<RiskCode>();
  for (const f of files) {
    const dirs = f.path.split("/").slice(0, -1).map((s) => s.toLowerCase());
    if (dirs.includes("scripts") || SCRIPT_EXT.test(f.path) || f.content.replace(/^﻿/, "").startsWith("#!")) out.add("SCRIPTS");
    if (BYPASS.test(f.content)) out.add("BYPASS_PERMISSIONS");
    const joined = joinContinuations(f.content);
    if (DOWNLOAD.test(joined) || INTERP.test(joined) || PIPE_SHELL.test(joined)) out.add("REMOTE_DOWNLOAD");
    if (isSkillMd(f.path)) {
      const { fmAll, body } = parseSkillMd(f.content);
      if (BANG_INLINE.test(body) || BANG_LINE.test(body)) out.add("BANG_COMMAND");
      const tools = fmAll["allowed-tools"];
      if (tools !== undefined && BROAD.test(tools)) out.add("BROAD_TOOLS");
    }
  }
  return [...out].sort();
}
