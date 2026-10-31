# ADR-0009 신호 전용 스크립트와 개발자 간 동기화 절차

- 상태: 승인 (사람 "진행", 2026-10-30)
- 근거: G5 리드 사전 시험 발견 사항 B-6·B-5·B-9 (`docs/report-beta.md` 5.3)
- 관련: PRD RUN-02·RUN-03, ADR-0004·0005·0006, S-3(Bash 범위 검사 후속 과제)

## 맥락
- **B-6 (승인 창)**: 기본 권한 모드(`defaultMode: default`)에서 병렬 에이전트는 신호를 `touch "$AF_SIGNALS/<신호>"`로 만든다.
  - Claude Code는 변수가 든 명령을 실행 전에 판단할 수 없어, 허용 목록(`Bash(touch:*)`)과 관계없이 매번 승인 창을 띄운다.
  - 사전 시험(3명) 한 주기에 승인 창이 35번 떴다. 그중 신호 12건이 전부였다.
  - 나머지 승인 창은 `cd` 복합 명령(24건), heredoc 파일 쓰기(14건), 파이프 연결 등이다(건수는 중복 포함).
- **B-5 (개발자 간 의존)**: dev-3의 코드가 dev-1 결과에 기대면, 병렬 단계 안에서 이를 풀 절차가 없었다.
  - 개발자는 병합할 수 없고, `integrate.sh`는 전원이 통과한 뒤에만 돈다.
  - 리드가 feature/dev1을 feature/dev3에 직접 병합하자, 범위 검사(`develop...HEAD`)가 dev-1 파일 15개를 범위 밖 변경으로 오판했다.
- **B-9**: 검토 에이전트가 검토 파일을 Bash heredoc으로 써서 Edit·Write용 guard hook을 거치지 않았다.

## 결정
1. **신호 전용 스크립트 `scripts/signal.sh <신호>`** (정적 템플릿, 755)
   - 인자 1개만 받는다. 변수가 없는 고정 명령이라 생성 `settings.json` 허용 목록 `Bash(bash scripts/signal.sh:*)`로 승인 없이 실행된다.
   - `AF_AGENT`·`AF_SIGNALS`(run-agents.sh가 설정)가 없으면 exit 2.
   - 자기 번호·역할의 신호만 만들 수 있다. 에이전트가 다른 개발자의 신호를 꾸밀 수 없다.
     - dev-N: `design-N.done`, `dev-N.done`, `dev-N.wait-M`(M≠N)
     - review-N: `design-N.pass|reject`, `review-N.pass|reject`
   - 허용 목록에서 `Bash(touch:*)`를 뺀다. 에이전트의 신호는 이 스크립트로만 만든다.
2. **개발자 간 동기화 `scripts/sync-dev.sh <선행 i> <대상 j>`** (정적 템플릿, 755, 사람이 실행)
   - 전제 조건:
     - `review-i.passed`가 있어야 한다(검토를 통과한 결과만 반영).
     - 메인 폴더가 develop이고 커밋하지 않은 변경이 없어야 한다.
     - dev-j worktree에도 커밋하지 않은 변경이 없어야 한다.
   - 순서:
     1. develop ← feature/dev*i* (`--no-ff`)
     2. feature/dev*j* ← develop
     3. dev-j pane에 반영 사실을 알린다.
   - develop이 먼저 바뀌므로 dev-j의 범위 검사 기준(`develop...HEAD`)에 dev-i 파일이 섞이지 않는다.
   - 충돌하면 해당 병합만 abort하고 멈춘다.
   - `integrate.sh`는 이미 병합된 feature/dev*i*를 다시 병합해도 "Already up to date"로 지나간다(변경 없음).
3. **대기 신호 `dev-N.wait-M`**
   - dev-N이 dev-M 결과 없이는 테스트를 통과시킬 수 없으면 보고서에 적고 이 신호를 낸 뒤 멈춘다.
   - `wait-and-review.sh`는 신호를 소비하고 감시 창에 `bash scripts/sync-dev.sh M N` 안내를 출력한다. dev-M이 아직 통과 전이면 그렇게도 알린다.
   - 병합은 자동으로 하지 않는다. 단계 전환·병합은 사람이 한다.
4. **에이전트 명령 실행 지침** (dev·review 템플릿, ko·en)
   - 작업 폴더에서 바로 실행하고, `cd`로 시작하는 복합 명령과 파이프·`;`·`&&` 연결을 피한다.
   - 파일은 Write·Edit 도구로만 쓴다. Bash 리다이렉션(`cat > 파일 <<EOF`)을 쓰지 않는다(B-9).
   - 신호는 `bash scripts/signal.sh`로만 만든다.
5. **analyst 지침**: 개발자 간 의존 작업은 tasks.md 선행 칸에 표시하고, 가능하면 공통 작업(인터페이스·스텁)으로 옮긴다.
6. CLAUDE.md 고정 규칙의 신호 문구, README 실행 순서(동기화 안내)를 함께 바꾼다.
7. **(보강, 재실행 B-10) `integrate.sh`는 병합한 뒤 테스트보다 먼저 `commands.install`을 실행한다.**
   - 설치 출력도 `integration-test.log`에 남긴다.
   - 설치가 실패하면 결과를 "실패"로 보고하고, integrator는 그대로 실행해 원인을 정리하게 한다.

## 결과
- 신호 12건은 더 이상 승인 창을 띄우지 않는다.
- `cd` 복합 명령과 heredoc 쓰기는 지침으로만 줄인다. 강제 수단은 S-3 후속 과제에서 다룬다.
- PoC와의 차이:
  - 템플릿: `md/dev.tpl.md`, `md/review.tpl.md`, `md/analyst.md`, `static/wait-and-review.sh`
  - golden 내용: `.claude/settings.json`(기존 등록), `CLAUDE.md`, 에이전트 파일
  - 새 파일: `scripts/signal.sh`, `scripts/sync-dev.sh`
  - 모두 `tests/golden/intended-diffs.json`에 기록한다.
- 이미 생성한 프로젝트는 다시 생성해야 반영된다(CLAUDE.md는 `mergeClaudeMd`로 PROJECT 구간 보존).
