# dev-2 보고 (PH4 1라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-411 | 완료. toZip 구현 변경 없이 시험 보강으로 충족(golden 3구성 동등·755/644·LF·디렉터리 항목 없음·빈 파일·결정성·2초) | `packages/exporter/test/zip.test.ts`, `docs/design/detail/dev-2.md` | exporter vitest 20건 통과, typecheck·lint 통과 | 없음 |
| T-412 | 작성 완료. 로컬에 bats·jq 없어 미실행(CI 확인 필요) | `tests/scripts/guard-paths.bats`, `tests/scripts/helpers.bash`(`skip_on_no_realpath_m` 추가) | `bash tests/scripts/run.sh` bash -n 단계 통과 | D7: macOS 는 `realpath -m` 미지원으로 skip(templates/static/guard-paths.sh 수정은 범위 밖). CI ubuntu 실행 결과 확인 필요 |
