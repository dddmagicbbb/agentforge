import { CORE_SKILLS, devSkill, FINAL, IMPORT_TARGET_LABEL, label, type RenderContext } from "./context.js";

// CLAUDE.md: 고정 규칙 + 마커 4구간(DOC-01). PROJECT 구간은 /forge-init 이 채운다.

export const ROUTINE_UI = "기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증";
export const ROUTINE_NO_UI = "기획 → 분석 → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증";

export function renderClaudeMd(c: RenderContext): string {
  const { p } = c;
  const routine = p.uiDesign ? ROUTINE_UI : ROUTINE_NO_UI;
  const langLine = p.language === "ko" ? "모든 답변과 문서는 한국어로 쓴다. 코드 식별자는 영어." : "Write all answers and documents in English.";
  const agentRows = [...c.seqActive(), FINAL].map((s) => `| ${s.id} | ${s.step} | ${label(p.agents[s.id])} |`).join("\n");
  const devRows = p.devs
    .map((d, i) => {
      const n = i + 1;
      const models = `${label(d.dev)} / ${label(d.review)}`;
      return d.domain !== "" && d.paths.length > 0
        ? `| dev-${n} / review-${n} | ${d.domain} | ${d.paths.join(" ")} | ${models} |`
        : `| dev-${n} / review-${n} | (분석 후 /forge-agents) | - | ${models} |`;
    })
    .join("\n");
  const skillRows = [
    ...CORE_SKILLS.filter((k) => c.enabledSkill(k.id)).map((k) => `| ${k.id} | ${k.layer} | ${k.to} |`),
    ...c.readyDevs().map(({ d, n }) => `| ${devSkill(d, n)} | 개발자 전용 | dev-${n} · review-${n} |`),
    ...p.imported.map((m) => `| ${m.id} | 가져옴(${m.src}) | ${IMPORT_TARGET_LABEL[m.target]} |`),
  ].join("\n");
  return `# 프로젝트 규칙

- ${langLine}
- 요구사항 기준은 docs/prd.md(기능 ID), 작업 배정은 docs/tasks.md.

## 개발 루틴
${routine}
- 단계 전환은 사람이 한다. 관문 조건을 확인해 보고만 하고 다음 단계를 시작하지 않는다.

## 병렬 개발 기본 기준
- 각 개발자는 자기 worktree(feature/devN)에서만 작업한다. 브랜치를 바꾸거나 병합하지 않는다.
- 담당 범위는 .claude/devs/<에이전트>.paths. 범위 밖 변경이 필요하면 report에 적고 멈춘다.
- API 계약·공통 모듈은 읽기 전용. 변경은 리드가 develop에서만 한다.
- 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.
- 커밋 메시지: [에이전트] 작업ID 요약
- 완료·요청은 신호 파일로 알린다: touch "$AF_SIGNALS/<신호>"

<!-- AGENTFORGE:PROJECT:BEGIN -->
(/forge-init 이 채움: 소개, 기술 스택, 명령어, 폴더 구조)
<!-- AGENTFORGE:PROJECT:END -->

<!-- AGENTFORGE:AGENTS:BEGIN -->
| 에이전트 | 단계 | 모델 |
| --- | --- | --- |
${agentRows}
<!-- AGENTFORGE:AGENTS:END -->

<!-- AGENTFORGE:DEVS:BEGIN -->
| 에이전트 | 도메인 | 담당 폴더 | 모델(개발 / 검증) |
| --- | --- | --- | --- |
${devRows}
<!-- AGENTFORGE:DEVS:END -->

<!-- AGENTFORGE:SKILLS:BEGIN -->
| 스킬 | 계층 | 사용 에이전트 |
| --- | --- | --- |
${skillRows}
<!-- AGENTFORGE:SKILLS:END -->
`;
}
