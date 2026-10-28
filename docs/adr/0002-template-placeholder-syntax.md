# ADR-0002 템플릿 문법: `{{KEY}}` 자리표시 유지, eta 미도입

- 상태: 제안 (G1 승인 대상) — **project-rules 기술 스택의 "eta(템플릿)"를 바꾸는 결정이므로 승인 시 project-rules 갱신 필요**
- 날짜: 2026-10-28

## 맥락
- PoC는 정적 원본 26종을 `STATIC`에 두고 `{{N}}`, `{{MODEL}}` 등을 `replace`로 치환한다.
- `.agentforge/templates/dev.md` 등은 **치환하지 않은 원문**을 사용자 프로젝트에 넣어야 한다. `/forge-agents`(사용자 PC의 AI)가 이 자리표시를 채운다.
- 셸 스크립트 9종은 "문자열 조립 금지, 그대로 복사" 규칙이다. 동적 스크립트는 agent-env.sh의 case 블록 하나뿐이다.

## 결정
- md 템플릿은 PoC의 `{{KEY}}` 문법을 그대로 쓴다. 치환은 `util/tpl.ts`의 순수 함수 `fill(tpl, vars)`가 한다.
  - 정의되지 않은 키가 남으면 예외(`AppError("TPL_UNFILLED")`). 단 AI용 원문(`.agentforge/templates/*`, forge-agents 본문)은 `fill`을 거치지 않는다.
- 동적 파일(CLAUDE.md, README, settings.json, config, env-example, litellm.yaml, tasks.json, agent-env case)은 TS 함수로 만든다.
- eta는 도입하지 않는다.

## 대안
| 대안 | 장점 | 단점 |
| --- | --- | --- |
| **`{{KEY}}` + TS 함수 (채택)** | PoC 원본 바이트 그대로 이관, AI용 템플릿과 문법 일치, 의존성 0 | 반복·조건은 TS 코드에서 처리 |
| eta 전면 사용 | 반복·조건을 템플릿 안에서 표현 | `{{ }}`(AI용)와 `<% %>`(앱용) 두 문법 공존, PoC 원본 변환 필요 → golden 차이 위험, 자동 이스케이프 규칙 별도 검토 |
| eta + AI용 원문만 `{{ }}` | 일부 유연성 | 위 단점 대부분 유지 |

## 결과
- project-rules "core: zod, eta(템플릿)" → "core: zod" 로 갱신 필요(승인 후 리드).
- 템플릿 수정은 원본 파일 편집 + golden 갱신으로 끝난다.
