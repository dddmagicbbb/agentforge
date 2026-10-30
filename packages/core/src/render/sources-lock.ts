import { scanSkillRisk } from "../market/risk.js";
import type { ImportedSkillT } from "../schema/index.js";
import { sha256Hex } from "../util/sha256.js";
import { importedSkillFiles } from "./skills.js";

// .agentforge/sources.lock (MKT-02, design.md 9.3). 키 순서 고정, 2칸 들여쓰기 + 끝 줄바꿈.
export function renderSourcesLock(imported: readonly ImportedSkillT[]): string {
  const skills = imported.map((m) => ({
    id: m.id,
    src: m.src,
    trust: m.trust,
    ref: m.ref ?? null,
    target: m.target,
    // files 가 있으면 원문에서 재계산(입력 flags 무시)
    flags: m.files ? scanSkillRisk(m.files) : [...m.flags],
    // files 순서는 렌더와 같다(SKILL.md 먼저, 나머지 사전순)
    files: m.files ? importedSkillFiles(m, "ko").map((f) => ({ path: f.path.slice(`.claude/skills/${m.id}/`.length), sha256: sha256Hex(f.content) })) : [],
  }));
  return `${JSON.stringify({ version: 1, skills }, null, 2)}\n`;
}
