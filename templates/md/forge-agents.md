---
name: forge-agents
description: 분석(docs/tasks.md)과 시스템 설계가 끝난 뒤 개발자별 에이전트, 짝 검증 에이전트, 개발자 전용 스킬, 담당 범위 파일을 생성·보완한다. 사용자가 /forge-agents 를 입력했을 때만 사용한다.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Bash(bash scripts/check-forge.sh)
---
# 입력
- .agentforge/forge.config.json 의 developers(N), agents(에이전트별 모델)
- docs/tasks.md : 작업 ID, 기능 ID, 담당 개발자, 담당 폴더
- docs/design/system.md, API 계약 파일, docs/design/ui/(있으면)
- .agentforge/templates/dev.md, review.md, dev-skill.md

# 절차 (i = 1..N)
1. tasks.md 에서 dev-i 의 기능 ID·담당 폴더·도메인명을 뽑는다. 담당 폴더가 다른 개발자와 겹치면 파일을 만들지 말고 겹치는 목록을 보고한 뒤 멈춘다.
2. 이미 .claude/agents/dev-i.md 가 있으면 담당 기능·폴더만 tasks.md 기준으로 고친다. 없으면 템플릿의 자리표시 `{{N}} {{DOMAIN}} {{PATHS_INLINE}} {{MODEL}} {{SKILLS}} {{FEATURES}} {{UI_READ}}` 를 모두 채워 만든다. 남기면 check-forge.sh 가 실패한다. frontmatter 키와 작업 순서는 바꾸지 않는다. review-i.md 도 같다. 값의 출처는 다음과 같다.
   - `{{N}}` : 개발자 번호 i
   - `{{DOMAIN}}` : tasks.md 의 도메인명
   - `{{PATHS_INLINE}}` : 담당 폴더를 쉼표로 이은 한 줄
   - `{{MODEL}}` : forge.config.json agents 의 dev-i / review-i 값. 제공자가 claude 면 모델 별칭, 아니면 `inherit`
   - `{{SKILLS}}` : frontmatter skills 에 이어 붙일 `  - devi-<도메인>` 줄(가져온 스킬이 있으면 그 줄도). 각 줄은 줄바꿈으로 끝낸다
   - `{{FEATURES}}` : 담당 기능 ID 목록(tasks.md)
   - `{{UI_READ}}` : uiDesign 이 켜져 있으면 dev 는 `, docs/design/ui/`, review 는 `·화면 설계`. 꺼져 있으면 빈 문자열
3. .claude/devs/dev-i.paths(담당 폴더 + docs/design/detail/dev-i.md + docs/report-dev-i.md), review-i.paths(docs/review/dev-i.md)를 만든다.
4. .claude/skills/devi-<도메인>/SKILL.md 의 빈 절을 채운다(없으면 만든다).
   - description 첫 문장: "dev-i 담당 작업에서만 사용한다."
   - 본문: 도메인 용어, 업무 규칙, 담당 API·테이블, 테스트 데이터 예. 500줄 이하. PRD·설계에 없는 규칙을 만들지 않는다.
5. CLAUDE.md 의 AGENTFORGE:DEVS / SKILLS 구간 표를 갱신한다.
6. bash scripts/check-forge.sh 를 실행한다. 실패하면 고치고 다시 실행한다. 3회 연속 실패하면 멈추고 보고한다.
