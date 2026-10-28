# ADR-0004 정적 스크립트·생성 스킬 템플릿 보정(PoC 원본 변경)

- 상태: 승인 (리드, 2026-10-28) — PH4 3라운드 T-403·T-404에서 구현
- 관련: design.md 6장 D2·D7, review-2 지적(guard-paths fail-open, 파일 항목 접두어), ADR-0003

## 맥락
`templates/static/`·`templates/md/`는 PoC 원본을 바이트 그대로 옮긴 것이다(C-02). 그러나 다음 결함은 PRD 목표·보안 규칙과 충돌한다.
| ID | 파일 | 결함 | 근거 |
| --- | --- | --- | --- |
| D7a | setup.sh | `sed -i 's/\r$//'`가 GNU 전용 → macOS에서 setup 실패 | PRD 2장(macOS 수정 없이 동작), CI macOS bats 4건 skip |
| D7b | guard-paths.sh | `realpath -m`이 GNU 전용 → macOS에서 범위 강제 불가 | DEV-03, CI macOS bats 6건 skip |
| G1 | guard-paths.sh | jq가 없으면 `file`이 비어 **검사 없이 통과(fail-open)** | 보안 규칙(범위 강제), review-2 |
| G2 | guard-paths.sh | 끝에 `/`가 없는 항목(`docs/report-dev-1.md`)도 접두어 비교 → `docs/report-dev-1.md.bak` 허용 | review-2 |
| D2 | forge-agents.md, check-forge.sh | 지시문의 자리표시 이름(`{{PATHS}}`)이 템플릿(`{{PATHS_INLINE}} {{MODEL}} {{SKILLS}} {{UI_READ}}`)과 다르고, check-forge가 미치환 `{{`를 검사하지 않음 | GEN-02·03 |

## 결정
1. setup.sh: CR 제거를 이식성 있는 방식(`tr -d '\r' < f > f.tmp && mv`)으로 바꾸고 권한은 별도 `chmod +x`.
2. guard-paths.sh:
   - jq가 없으면 **차단(exit 2)** 하고 설치 안내(fail-closed). 단 `AF_AGENT`가 없으면(리드 세션) 지금처럼 검사하지 않는다.
   - `realpath -m` 대신 bash 순수 함수로 경로를 어휘적으로 정규화(`.`·`..`·중복 `/` 처리, 파일 존재 불필요).
   - paths 항목이 `/`로 끝나면 디렉터리 접두어, 아니면 **정확히 같은 파일**만 허용.
3. forge-agents.md: 채울 자리표시 목록을 템플릿과 같게 고치고 각 값의 출처(MODEL = forge.config.json의 agents, SKILLS = `  - devN-<domain>` 줄, UI_READ = uiDesign)를 적는다.
4. check-forge.sh: `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`에 `{{`가 남으면 실패하는 항목을 추가한다(7항목). GEN-03 완료 기준 "6항목"은 "7항목"으로 읽는다.
5. 변경한 템플릿은 `tests/golden/intended-diffs.json`의 `templates`에, 그 결과 달라지는 생성 파일은 `diffs`에 config별로 등록한다. golden(PoC 실행 결과)은 그대로 두고, 새 동작은 bats·Vitest 전용 시험으로 검증한다.
6. 변경 후 bash -n·shellcheck 0·bats(ubuntu·macOS 모두, D7 skip 제거)·모의 병렬 실행을 다시 통과해야 한다.

## 대안
| 대안 | 판단 |
| --- | --- |
| PoC를 고치고 golden 재생성 | PoC는 참조 문서로 고정(ADR-0003) — 기각 |
| macOS에 coreutils 설치 요구 | 사용자 환경 요구 증가, PRD "수정 없이 동작" 위배 — 기각 |
| **템플릿 보정 + 차이 목록 (채택)** | PoC와의 경계가 기록되고 변경 범위가 시험으로 보장됨 |
