import { CORE_SKILLS, devSkill, FINAL, label, type RenderContext } from "./context.js";
import { text } from "./text.js";

// CLAUDE.md: 고정 규칙 + 마커 4구간(DOC-01). PROJECT 구간은 /forge-init 이 채운다.
// language: en 이면 고정 규칙·표 머리·단계명을 영어로(I18N-01). 마커·구간 구조는 같다.

export const ROUTINE_UI = text("ko").routineUi;
export const ROUTINE_NO_UI = text("ko").routineNoUi;

export function renderClaudeMd(c: RenderContext): string {
  const { p } = c;
  const lang = p.language;
  const t = text(lang);
  const routine = p.uiDesign ? t.routineUi : t.routineNoUi;
  const agentRows = [...c.seqActive(), FINAL].map((s) => `| ${s.id} | ${t.step[s.id] ?? s.step} | ${label(p.agents[s.id], lang)} |`).join("\n");
  const devRows = p.devs
    .map((d, i) => {
      const n = i + 1;
      const models = `${label(d.dev, lang)} / ${label(d.review, lang)}`;
      return d.domain !== "" && d.paths.length > 0
        ? `| dev-${n} / review-${n} | ${d.domain} | ${d.paths.join(" ")} | ${models} |`
        : `| dev-${n} / review-${n} | ${t.devsPending} | - | ${models} |`;
    })
    .join("\n");
  const skillRows = [
    ...CORE_SKILLS.filter((k) => c.enabledSkill(k.id)).map((k) => `| ${k.id} | ${t.layer[k.group]} | ${t.to[k.id]} |`),
    ...c.readyDevs().map(({ d, n }) => `| ${devSkill(d, n)} | ${t.devOnlyLayer} | dev-${n} · review-${n} |`),
    ...p.imported.map((m) => `| ${m.id} | ${lang === "ko" ? "가져옴" : "imported"}(${m.src}) | ${t.importTarget[m.target]} |`),
  ].join("\n");
  return `${t.claudeTitle}

- ${t.langLine}
- ${t.claudeRequirement}

${t.routineTitle}
${routine}
- ${t.claudeStageNote}

${t.claudeParallelTitle}
${t.claudeParallel.map((x) => `- ${x}`).join("\n")}

<!-- AGENTFORGE:PROJECT:BEGIN -->
${t.projectPlaceholder}
<!-- AGENTFORGE:PROJECT:END -->

<!-- AGENTFORGE:AGENTS:BEGIN -->
${t.agentsHead}
| --- | --- | --- |
${agentRows}
<!-- AGENTFORGE:AGENTS:END -->

<!-- AGENTFORGE:DEVS:BEGIN -->
${t.devsHead}
| --- | --- | --- | --- |
${devRows}
<!-- AGENTFORGE:DEVS:END -->

<!-- AGENTFORGE:SKILLS:BEGIN -->
${t.skillsHead}
| --- | --- | --- |
${skillRows}
<!-- AGENTFORGE:SKILLS:END -->
`;
}
