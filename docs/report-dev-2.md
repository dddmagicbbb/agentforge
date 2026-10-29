# dev-2 보고 (PH4 1라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-411 | 완료. toZip 구현 변경 없이 시험 보강으로 충족(golden 3구성 동등·755/644·LF·디렉터리 항목 없음·빈 파일·결정성·2초) | `packages/exporter/test/zip.test.ts`, `docs/design/detail/dev-2.md` | exporter vitest 20건 통과, typecheck·lint 통과 | 없음 |
| T-412 | 작성 완료. 로컬에 bats·jq 없어 미실행(CI 확인 필요) | `tests/scripts/guard-paths.bats`, `tests/scripts/helpers.bash`(`skip_on_no_realpath_m` 추가) | `bash tests/scripts/run.sh` bash -n 단계 통과 | D7: macOS 는 `realpath -m` 미지원으로 skip(templates/static/guard-paths.sh 수정은 범위 밖). CI ubuntu 실행 결과 확인 필요 |

# dev-2 보고 (PH6 1라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-612 | 작성 완료(계약 기준 TDD). review-2 반려 반영: prefix 긍정 단언(`C-a`), grid·role pane 순서 단언(`pane_order`), pair+prefix·mouse 사례 추가 | `tests/scripts/run-agents.bats`(신규, 사례 8개), `docs/design/detail/dev-2.md` | int-r1b(dev-1 구현 포함) bats 22/22 통과(리드 보고). 2라운드에서 한글·공백·작은따옴표 경로 + LC_ALL=C tmux 재기동 사례로 보강(dev-1 sq 인용 수정 전이면 실패가 정상) | 없음 |
| T-614 | 작성 완료. 기존 통합 사례 4건 준비 단계에 검토 파일 커밋(`add_reviews`) 추가, S-4 사례 3건 추가(누락·미커밋·요청 문구) | `tests/scripts/parallel-mock.bats` | 기존 사례 통과, S-4 3건 포함 int-r1b 통과(리드 보고) | 가정: 병합 전에 전원의 검토 파일을 먼저 확인해 develop 이 하나도 바뀌지 않음(시험이 단언). 실패 안내에 누락 개발자 `dev-N` 포함 |
