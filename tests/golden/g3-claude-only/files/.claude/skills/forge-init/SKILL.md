---
name: forge-init
description: 요구사항 파일로 PRD와 CLAUDE.md 프로젝트 구간을 생성한다. 사용자가 /forge-init 을 입력했을 때만 사용한다.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob
---
# 입력
- .agentforge/requirements.md : 사용자 요구사항 원문
- .agentforge/forge.config.json : 개발자 수, UI/UX 설계 여부(uiDesign), 언어
- .agentforge/templates/prd.md : PRD 양식(장 순서 고정)

# 절차
1. 요구사항을 읽고 모호한 점을 최대 5개 질문한다. 답을 받기 전에는 파일을 쓰지 않는다.
2. 양식의 장 순서대로 docs/prd.md 를 쓴다.
   - 기능마다 ID(F-001부터), 우선순위(필수/선택), 수용 기준(Given/When/Then)을 단다.
   - uiDesign 이 false 이면 화면 장은 "해당 없음"으로 둔다.
3. CLAUDE.md 의 <!-- AGENTFORGE:PROJECT:BEGIN --> ~ END 구간만 교체한다.
   - 프로젝트 소개 1줄, 기술 스택, 설치·테스트·빌드 명령어, 폴더 구조.
   - 다른 구간과 고정 규칙은 수정하지 않는다. CLAUDE.md 전체는 200줄을 넘기지 않는다.
4. 끝에 "사람이 확인할 항목"(가정한 내용, 기술 선택 근거)을 목록으로 출력한다.

# 금지
- 요구사항에 없는 기능 추가. 필요해 보이면 "제안" 절에만 적는다.
- 일정·인원 같은 숫자를 근거 없이 쓰기.
