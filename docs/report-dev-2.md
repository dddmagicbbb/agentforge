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

# dev-2 보고 (PH6 2라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-611 | 작성 완료(계약 기준 TDD). 사례 13개: 통과, 경고 2(값 없음·num_turns<2), 실패 5(is_error·claude exit 3·JSON 깨짐·agent-env 키 누락·AF_CHECK_TIMEOUT), 일부 에이전트만, 전체 agents, 혼합 요약·exit 1, claude 인자(`--agent`·`--output-format json`·`--max-turns 3`·표준입력 EOF), 키·응답 원문 미출력. golden `ui-off-dev2-litellm` + 가짜 claude 사용 | `tests/scripts/check-models.bats` | dev-1 T-603 구현 전이라 13건 모두 `templates/static/check-models.sh` 없음으로 실패(계약 미구현). 구현 후 재확인 필요 | 판정은 기호(✓ ! ✗)·요약 `통과 N · 경고 N · 실패 N`·종료 코드로만 단언 |
| T-612 보강 | 한글·공백·작은따옴표 상위 폴더 + `LC_ALL=C` 로 tmux 서버 재기동 사례, `tr` 표기 정리, 문서 갱신 | `tests/scripts/run-agents.bats`, `docs/design/detail/dev-2.md`, 본 보고서 | WSL 재확인은 아래 참조 | dev-1 의 sq(작은따옴표 인용) 수정 전이면 해당 사례 실패가 정상 |
| T-613 | 작성 완료. 구조 확인(항상) → docker 가 있으면 이미지로 postCreateCommand 실행 후 `tmux -V`·`jq --version`·`claude --version` → docker 없고 `AF_IN_DEVCONTAINER_IMAGE=1` 이면 현재 환경에서 동일 확인 → 둘 다 아니면 건너뜀 exit 0 | `tests/scripts/devcontainer-check.sh` | 로컬 문법 검사(`bash -n`)만. 실제 컨테이너 실행은 CI 에서 확인 필요 | 아래 CI 단계 참조 |

## T-613 CI 연결(리드 작업) 제안
1. `pnpm build` 이후 단계로 `bash tests/scripts/devcontainer-check.sh` 를 ubuntu 잡에 추가(docker 가 있는 러너에서는 컨테이너 방식으로 자동 실행).
2. docker 없이 이미지 안에서 돌리려면 잡에 `container: mcr.microsoft.com/devcontainers/javascript-node:22` 를 지정하고 `AF_IN_DEVCONTAINER_IMAGE=1` 을 설정(이 경우 postCreateCommand 의 `sudo apt-get`·`npm install -g` 가 외부 네트워크를 쓴다).
3. 폐쇄망·네트워크 제한 러너에서는 건너뜀(exit 0)이므로 필수 단계가 아니라 별도 선택 잡으로 두는 것을 권장.

## 2라운드 반려 반영 (review-2)
- T-611: 비밀 미출력 사례를 판정 경로별로 분리(통과·경고 값 없음·경고 num_turns=1·is_error·JSON 깨짐·claude exit≠0, 모두 litellm 에이전트로 `ANTHROPIC_AUTH_TOKEN` 에 키가 실린 상태에서 출력에 키·응답 원문이 없음을 단언). 경계값 num_turns=2 통과 사례 추가. 설계 문서에 "PH6 2라운드: T-611·T-613" 절 추가.
- T-613: `AF_DEVCONTAINER_REQUIRED=1` 이면 건너뛰는 대신 exit 1. 구조 확인에 name=slug·mode 644 추가.
- 참고: `run-agents.bats` 의 작은따옴표 경로 사례는 bash 5.3(WSL)에서 현재 `sq` 가 올바르므로 회귀 검출력은 인용이 달라지는 환경, 특히 macOS 기본 bash 3.2 CI 에서 의미가 있다(`sq` 를 따옴표 미처리로 바꾸면 실패하는 것은 WSL 에서 변이로 확인).
