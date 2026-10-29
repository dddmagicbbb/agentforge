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
