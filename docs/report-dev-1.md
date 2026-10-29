# dev-1 보고서 (PH6 1라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-601 DOC-03 | 완료 | `packages/core/src/merge-claude-md.ts`, `api.ts`, `test/merge-claude-md.test.ts`, `test/schema.test.ts` | 단위 + fast-check 4종 통과 | 없음 |
| T-602 RUN-04 | 완료 | `render/config.ts`, `render/scaffold.ts`, `render/index.ts`, `templates/static/run-agents.sh`, `test/tmux.test.ts` | core 통과, bats(g3·parallel-mock) 통과 | grid·role 실기 검증은 dev-2 run-agents.bats |
| T-606 S-3·S-4 | 완료 | `render/settings.ts`, `render/readme.ts`, `templates/static/integrate.sh`, `templates/static/wait-and-review.sh`, `test/security-followup.test.ts` | core 통과(golden 6건은 아래 의도적 차이) | integrate 성공 사례는 검토 파일 커밋이 필요 |

## 리드 조치: tests/golden/intended-diffs.json 갱신 필요
- templates `static/run-agents.sh`, diffs `scripts/run-agents.sh`: defect "RUN-04", adr "0006".
- templates `static/integrate.sh`, `static/wait-and-review.sh`, diffs `scripts/integrate.sh`, `scripts/wait-and-review.sh`: defect "S-4", adr "0006" (검토 파일 확인, 검토 요청 문구).
- diffs `.claude/settings.json`: 사유에 "S-3 defaultMode: default / ADR-0006" 추가.
- diffs `README.md`: **새 항목 필요**(현재 없음). 마지막에 권한 모드 한 줄 추가(S-3). 이 항목 전까지 golden `README.md 내용이 PoC 와 같다` 3건이 실패한다.
- 현재 golden 실패 6건 = run-agents.sh 3 + README 3(위 등록 시 해소).

## 설계 결정
- logs 의 pipe-pane 은 절대 경로. 접두키 안내는 기본 Ctrl-b, 그 외 tmux 표기.
- integrate.sh 검토 파일 확인은 신호 확인 직후·git status/tag/checkout 앞. 누락 dev-N 을 모두 나열하고 exit 1.

---

# PH6 2라운드 (ph6/dev1-r2): T-603, T-604 + review-1 반려 대응

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
| --- | --- | --- | --- | --- |
| T-602 반려 | `sq()` 를 `r="'\''"` 치환으로 수정, 왕복 동작 시험(bash+sh, 9사례) 추가, README 권한 문구 정정 | `templates/static/run-agents.sh`, `render/readme.ts`, `test/tmux.test.ts` | 통과 | Windows 에서 bash 인자의 `'` 가 변형돼 시험은 환경 변수·stdin 으로 전달 |
| T-603 PRV-03 | 완료 | `templates/static/check-models.sh`(신규), `render/scaffold.ts`(STATIC_SCRIPTS), `render/vscode.ts`(7번째 작업) | `test/ph6-round2.test.ts` | 실제 claude 호출 동작은 시험 불가(가짜 claude bats 는 dev-2) |
| T-604 VSC-02 | 완료 | `render/devcontainer.ts`(신규), `render/index.ts`, `render/readme.ts`, `checks.ts` | `test/ph6-round2.test.ts` | web 로케일에 `DEVCONTAINER_CLOSED_NET` 문구 필요(dev-3) |

## 리드 조치
- `tests/golden/intended-diffs.json` 갱신: golden 실패 6건(`파일 목록·순서·권한·작성 주체가 PoC 와 같다`, `.vscode/tasks.json 내용이 PoC 와 같다`, 각 3구성)은 아래 등록으로 해소.
  - diffs `*`/`scripts/check-models.sh`(PoC 에 없는 신규 파일, 파일 목록 비교 제외 필요), diffs `.vscode/tasks.json`(7번째 작업), defect "PRV-03", adr "0006".
  - templates `static/check-models.sh`: PoC 에 없으므로 `check:poc-static` 제외 항목으로 등록(tools/extract-poc-static.mjs 수정 대신 intended-diffs templates 목록 사용 가정).
- 파일 목록 비교는 구성별 `.devcontainer/devcontainer.json` 이 없을 때 불변이라 별도 등록 불필요(devcontainer 지정 구성 추가 시에만).
- web 로케일(ko/en)에 `DEVCONTAINER_CLOSED_NET` 키 추가 필요(dev-3 영역, UI_OFF 와 같은 패턴 — `checks()` 의 info 코드가 늘었음).
- 커밋 d2d726f 는 sq 수정만 담아 스냅샷이 구 상태이며, 2라운드 커밋에서 스냅샷을 갱신함.

## 설계 메모
- check-models.sh: 에이전트별 서브셸(`( check_one )`)로 agent-env 환경 격리, 종료 코드 0/1/2 를 집계. 사유 문구는 고정(키·응답 원문 미출력). `timeout` 없으면 제한 없이 실행.
