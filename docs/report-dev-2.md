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

# dev-2 보고 (PH6 3라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-615 | 작성 완료. I18N-01 (a) 화면 en 전환 + ZIP 내용은 화면 언어와 무관, (b) language=en 생성물(README·CLAUDE.md 한글 없음, core 렌더와 동일), DOC-03 (c) 기존 CLAUDE.md 붙여넣기 병합(마커 밖·PROJECT 보존, core `mergeClaudeMd` 결과와 동일) + 마커 오류 시 ZIP 버튼 비활성 | `tests/e2e/i18n-doc.spec.ts`(신규, 4건) | 로컬 Windows 에서 `tsc -p tests/e2e` 통과, (a) 는 Playwright 실행 통과. (b) 는 T-605(생성물 영어, README 에 한글 남음)·(c) 2건은 T-624(입력 UI 없음) 구현 전이라 실패가 정상. 셸 단계는 없음 | 아래 가정 참조. 리드 통합 브랜치에서 4건 모두 확인 필요 |
| 정리 | `check-models.bats` 19번 제목을 본문(num_turns=2 통과)에 맞춤, `devcontainer-check.sh` SC2012 사유 주석 | `tests/scripts/check-models.bats`, `tests/scripts/devcontainer-check.sh` | `bash -n` 통과 | 없음 |

## T-624 접근명 확정
- 6단계 붙여넣기 입력: 라벨 "기존 CLAUDE.md 붙여넣기(선택)". 마커 오류 시 textarea aria-invalid="true" 와 #doc-error 표시, ZIP 버튼 비활성(정상 "ZIP 다운로드" 또는 차단 "오류 N건을 먼저 해결하세요" 모두 disabled 이면 통과로 봄).
- (b) 는 요구사항을 영어로 입력하고, 기대값은 `{...defaultDraft(), language: "en", requirement}` 의 core render 와 README·CLAUDE.md 동등 + 한글 정규식 `[가-힣]` 없음으로 단언한다.
- 로컬 주의: 포트 4173 에 다른 worktree 의 vite preview 가 떠 있으면 `reuseExistingServer` 로 그 오래된 번들을 쓰게 된다(이번에 (a) 가 그 때문에 처음엔 실패). CI 는 `CI` 변수로 재사용하지 않는다.

# dev-2 보고 (PH7 1라운드)

| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-711 | MKT-01 마켓 색인 서버 구현. `createServer({dataDir, scan, fetch?, gitBin?, webDist?, env?, defaultSourcesFile?, gitTimeoutMs?, fetchTimeoutMs?})`, API 7종, github(REST)·git(execFile, file:// 는 `AF_ALLOW_FILE_SOURCES=1` 에서만) 소스, 스킬 인식·tooLarge·binary 차단, 색인 저장, 기본 소스 복사, webDist 정적 제공 | `packages/server/src/{app,types,schemas,store,indexer,fetch-github,fetch-git,index}.ts`, `packages/server/test/{helpers,api,github,git}.ts`, `packages/server/{package.json,tsconfig*.json,vitest.config.ts}`, `pnpm-lock.yaml`, `docs/design/detail/dev-2.md` | server 32건 통과(api 15·github 10·git 7), 전체 `pnpm build`·`typecheck`·`lint` 통과, core 382·exporter 20·web 9 파일 통과 | 아래 |

## 리드 조치 필요
1. **core 연결**: `scan` 은 필수 주입이다(`ServerOptions.scan`, 코드에 TODO). core 에 `scanSkillRisk` 가 병합되면 `app.ts` 에서 기본값을 `scanSkillRisk` 로 두거나, 서버 기동 스크립트에서 주입한다. 시험은 `scripts/` 경로만 보는 대역(`fakeScan`)을 쓴다. 반환 타입은 `readonly string[]` 이라 `RiskCode[]` 와 호환된다.
2. 서버 기동 진입점(listen)은 만들지 않았다(계약: 호출자가 listen). E2E(T-713)에서 `createServer(...).listen()` 을 쓰면 된다.

## 추가 의존성
| 패키지 | 버전 | 라이선스 | 용도 |
|---|---|---|---|
| fastify | ^5.12.7 | MIT | 서버 |
| @fastify/static | ^10.1.8 | MIT | webDist 정적 제공 |
| zod | ^4.6.7 | MIT | 입력 검증(core 와 같은 버전). core 의 `SkillName`·`GitBranch`·`HttpUrl`·`SkillFilePath` 패턴을 import 해 재사용 |
GPL 계열 신규 의존성 없음(전이 의존성도 확인: 기존 jszip 의 `MIT OR GPL` 이중 라이선스뿐).

## 설계 판단·계약 외 확장
- 응답 코드: 입력 오류 400 `SOURCE_INVALID`(params.field 만), 중복 409 `SOURCE_EXISTS`, 차단 409 `SKILL_BLOCKED {reason}`, 없음 404 `NOT_FOUND`, 갱신 실패는 refresh 결과 안의 `{ok:false, code, params}`(HTTP 200), 그 밖 500 `INTERNAL`. `NOT_FOUND`·`INTERNAL` 은 9.6 목록에 없는 추가 코드다.
- `blocked` 값에 `badPath` 를 추가했다: 스킬 안 파일 경로가 SkillFilePath 패턴(공백·한글·깊이 6 이상 등)에 맞지 않으면 일부만 가져오지 않고 스킬 전체를 차단한다(원문 보존 원칙). web 은 `tooLarge|binary|badPath` 를 처리해야 한다.
- 한도 판정: 50개·200,000자·512,000자(문자 수). 내려받기 전에는 바이트×4 기준으로만 사전 차단하고 정확한 문자 수는 디코드 후 판정.
- 깊이 2 는 `path` 기준이다. 같은 id 의 스킬이 두 폴더에 있으면 경로순으로 먼저 나온 것만 쓴다.
- git clone 은 `-c core.autocrlf=false` 로 원문 줄바꿈을 보존하고, `GIT_ALLOW_PROTOCOL`(https 또는 file), `GIT_TERMINAL_PROMPT=0` 을 쓴다. git 에 넘기는 환경 변수는 필요한 것만 복사한다. git 소스의 `tokenEnv` 는 `GIT_CONFIG_*` 환경 변수(`http.extraHeader`, Basic `x-access-token`)로 전달해 프로세스 인자에 나타나지 않게 했다(실제 비공개 저장소 시험은 하지 못함).
- 갱신 실패 시 기존 색인은 유지하고 sources.json 에 `lastError` 코드만 기록한다. github 는 `commits/HEAD`(ref 없음) 로 기본 브랜치를 얻는다. tree 가 `truncated` 이면 실패 처리(대형 저장소 미지원).
- frontmatter `name` 과 폴더명이 다른 스킬은 색인에서 걸러내지 않는다(가져오기 시 core 불변식 `IMPORT_NAME_MISMATCH` 가 막음). web 이 미리 알리려면 후속 과제.

## 남은 위험
- 등록·갱신 API 에 인증이 없다. 등록된 주소를 서버가 가져가므로(SSRF 성격) 사내 설치형이라도 접근 통제(리버스 프록시·내부망)가 필요하다. 인증은 이번 범위 밖이다.
- github 소스는 트리 `truncated`(저장소가 매우 큼) 를 지원하지 않는다. `anthropics/skills` 규모는 해당 없음. 실제 github.com 호출은 시험하지 않았다(가짜 fetch).
- Windows 에서 git 시간 제한 종료 시 자식 프로세스가 남을 수 있다(임시 폴더 삭제는 재시도 후 실패 무시).

## PH7 1라운드 보강 (리드 요청, review-2 전)
- **관리 API 보호(SSRF 대책)**: `POST/DELETE /api/market/sources`, `POST /api/market/refresh` 는 `env.AF_MARKET_ADMIN === "1"` 일 때만 동작하고, 아니면 본문 파싱 전에 403 `ADMIN_DISABLED`. 읽기 API 는 항상 허용. `GET /api/market/health` 는 `{ ok, version, admin }`.
- **listen**: 진입점(헬퍼)은 만들지 않았다. 호출자는 기본 host 를 `127.0.0.1` 로 둔다(`createServer` 옵션 주석에 명시). 외부 노출 시 별도 접근 통제 필요.
- **scan**: 주입 유지. `fakeScan` 은 `packages/server/test/helpers.ts` 에만 있고 `src/` 에는 없다. 통합 때 리드가 core `scanSkillRisk` 를 기본값으로 연결.
- **9.6 외 추가 코드**: `NOT_FOUND`(404), `INTERNAL`(500), `ADMIN_DISABLED`(403). `blocked` 값 `badPath`(스킬 파일 경로가 SkillFilePath 패턴 위반).
- 시험: 관리 꺼짐(3개 API 403, 깨진 본문도 403, 읽기 정상, health.admin=false), 미설정도 꺼짐 추가. server 34건 통과, typecheck·lint 통과.

## PH7 1라운드 보안 보강 2차 (review-2 권고, design.md 9.7)
- 반영: tokenEnv 접두(`AF_MARKET_TOKEN_`)·토큰 소스 https 만(등록·갱신 시), repo/path 의 `.`·`..` 금지, 관리 POST Content-Type JSON 만(415), Host 허용 목록(`AF_MARKET_HOSTS`, 403 `HOST_DENIED`), git `ls-tree` 로 symlink·서브모듈 제외(OS 무관), `listenServer`·`startFromEnv`·`src/main.ts`, BOM description, path 가 스킬 폴더 자체인 경우, 파일 20,000개 상한, 시험 임시 폴더 정리(setup.ts).
- 추가 코드: `ADMIN_DISABLED`, `HOST_DENIED`, `NOT_FOUND`, `INTERNAL`, `blocked` 의 `badPath` (design/detail/dev-2.md 에 기록).
- 시험: server 62건 통과(연속 2회, 병렬 시험 간 임시 폴더 간섭은 `workDir` 옵션으로 제거). typecheck·lint 통과, 임시 폴더 누적 없음.
- 한계: `--` 구분자·GIT_ALLOW_PROTOCOL 은 실제 공격 재현이 어려워 `cloneArgs`·`gitEnv` 단위 시험으로 고정했다. clone 크기 상한은 없고(파일 수 상한만), 시간 제한 60초에 의존한다.
- 리드: `src/main.ts` 는 core 에 `scanSkillRisk` 가 병합돼야 기동된다(없으면 오류로 종료). 기본 소스·`createServer` 의 `scan` 필수 주입은 그대로.

## PH7 2라운드
| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-712 | 완료. `pushToGithub` create(커밋 1건·force ref)/pr(base_tree·브랜치·PR), 오류 코드 매핑, 토큰 미노출 | `packages/exporter/src/github.ts`, `src/index.ts`, `package.json`(`./github` 진입점, `@octokit/core` ^7.0.8 MIT), `test/github.test.ts`, `pnpm-lock.yaml`, 상세 설계 | exporter 39 통과(신규 20 이상 포함), typecheck·lint 통과 | 1) 내부 `planTree` 를 core `planGithubTree` 로 교체(TODO 주석). 2) 기존 스텁 `pushToGitHub`(대문자 H) 제거, web 사용처 없음. 3) auto_init 직후 ref PATCH 가 일시적으로 실패할 수 있어 재시도 미구현. 4) exporter 단독 build 는 core dist 가 없으면 실패(기존 상태) |

### T-712 보강 (design 9.7 EXP-02 보강)
blob 개별 요청 제거(tree content), 2차 rate limit 분류(retry-after·메시지), GITHUB_PARTIAL(create commit·pr 단계, params 는 stage·url 만), auto_init 직후 409·404 재시도 1초 x 3(`sleep` 옵션 주입), Octokit 로거 noop, 루트 index 에서 pushToGithub 재export 제거(`@agentforge/exporter/github` 만), 생존 변이 대응 시험(trunk pr, login 대소문자, retry-after 403). exporter 50 통과·typecheck·lint 통과. 참고: 재시도 소진·재시도 불가 실패도 저장소 생성 뒤라면 PARTIAL.

## PH7 3라운드: T-713
| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-713 | 완료 | `tests/e2e/market.spec.ts`, `tests/e2e/github.spec.ts`, `tests/e2e/helpers.ts`(freePort·repoRoot·makeGitRepo), 상세 설계 3라운드 절 | E2E 14건 중 13 통과·1 skip(기존 ④ 셸 단계, Windows). 신규 5건(마켓 2·GitHub 3) 통과, 전체 약 15초. build·typecheck·lint 통과 | 실제 GitHub 실기는 사람 확인 필요(G 조건). GitHub 시험은 브라우저 가로채기라 exporter 의 Node 경로는 단위 시험이 담당 |
- 서버·exporter 코드 변경 없음. 마켓 시험은 서버를 spawn(임시 dataDir, 임시 git 저장소, 종료 시 삭제).

## PH7 실기 후속
| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| PH7 실기 후속 | 완료. 1) 콘솔 출력 0: `@octokit/request` 는 `request.log \|\| console` 로 deprecation 경고를 내므로(`dist-bundle/index.js` 41·99행) `request: { log }` 에도 noop 로거 주입. 2) 모든 요청에 `X-GitHub-Api-Version: 2022-11-28`(core 는 생성자 `headers` 옵션을 읽지 않아 `hook.before("request")` 로 주입) | `packages/exporter/src/github.ts`, `test/github.test.ts` | exporter 52 통과(신규 2), typecheck·lint 통과 | `POST /user/repos` 는 공식 대체 경로 확인 못 해 변경 안 함. 버전 헤더 고정 + 2028-03-10 이전 재확인 필요 |

## PH8 1라운드: T-812, T-813
| 작업 ID | 결과 | 변경 파일 | 테스트 | 남은 문제 |
|---|---|---|---|---|
| T-812 | 완료. `agentforge` CLI(`--port --host --data --license-file --admin --help`), vite ssr 단일 번들(`dist/cli.js`, core·server 포함) + `dist/web`·`dist/catalog` 복사, SIGINT/SIGTERM 정리 종료 | `packages/app/**`, `pnpm-lock.yaml` | app 28건(args·run·pack) 통과, 루트 build·typecheck 통과 | 1) 라이선스 파일은 `AF_LICENSE` 로 넘기는 자리만(T-811 TODO). 2) 루트와 앱 npm 이름이 같아 `--filter agentforge` 는 둘 다 선택 → 경로 필터 사용 |
| T-813 | 작성 완료, docker 실행 검증은 못 함 | `Dockerfile`, `.dockerignore`, `tests/scripts/airgap-check.sh` | `bash -n`·shellcheck 통과, docker 없음/데몬 꺼짐 시 건너뜀·REQUIRED=1 실패 확인. `pnpm deploy --legacy` 산출물(dist+prod node_modules)로 `node dist/cli.js` 기동 확인 | 이미지 빌드·폐쇄망 절차는 이 PC 에서 docker 데몬이 꺼져 있어 실제로 못 돌렸다 |

### CI 연결 제안 (리드)
- ubuntu 잡 1개: `AF_AIRGAP_REQUIRED=1 bash tests/scripts/airgap-check.sh` (docker·curlimages/curl 이미지 pull 가능해야 함, 약 2~4분). 실패 시 `docker logs` 는 스크립트가 출력한다.
- 첫 CI 실행에서 확인할 것: Dockerfile 의 `pnpm install --frozen-lockfile`(corepack 이 packageManager 의 pnpm 10.34.7 을 받음), `pnpm deploy --legacy`, `HEALTHCHECK`.
- T-811 뒤에 `airgap-check.sh` 에 `/api/license` 단계 추가(스크립트 상단 TODO).

### 남은 위험
- Dockerfile 미실행: 빌드 단계의 네트워크(corepack·npm registry) 의존, alpine 에서 git 소유권 처리(시험 저장소는 af 사용자로 만들어 회피).
- `AF_MARKET_ADMIN` 은 CLI 에서도 환경 변수로 켜진다(Docker 용). 컨테이너 포트를 외부에 노출하면 관리 API 도 열리므로 `-p 127.0.0.1:` 바인드와 Host 목록 지정이 전제(문서 T-890에 명시 필요).
- 루트 `pnpm lint` 는 `tools/license-issue.mjs`(리드 파일)의 `Buffer` no-undef 2건으로 실패한다. 내 변경과 무관.

### PH8 1라운드 반려 반영 (review-2, 리드 "배포 보안 확정")
- 번들: `ssr.noExternal` 에 `/^@noble\//` 추가(실행 의존성 3개 유지). pack 시험에 "dist/cli.js 의 node: 아닌 bare import 가 모두 dependencies 에 있다"와 "`.map` 없음" 추가. 시험을 먼저 돌려 `.map`, AF_* 환경 변수 시험이 실패하는 것을 확인한 뒤 수정. 이 브랜치엔 noble 이 없어 bare import 시험은 현재 fastify 등만 검사하므로, ph8/dev1 병합 후 통합에서 확인 필요.
- CLI: 관리 API 는 `--admin` 인자로만(`AF_MARKET_ADMIN` 무시). 바인드 env 는 `AF_HOST`·`AF_PORT`(일반 이름 `HOST`·`PORT` 는 읽지 않음). 웹 dist 의 `.map` 은 복사하지 않는다.
- Dockerfile: 매니페스트·lock 먼저 COPY 후 install(레이어 캐시), `ENV AF_MARKET_DATA=/data AF_PORT=3456`(HOST 제거). 넓은 바인드는 `ENTRYPOINT ["node","dist/cli.js","--host","0.0.0.0"]` 로 했다 — 지시는 CMD 였으나, CMD 면 `docker run IMG --admin` 이 CMD 를 대체해 `--host` 가 사라지기 때문이다. 관리 API 는 `docker run … IMAGE --admin`. `.dockerignore` 에 `license-private*` 추가.
- 권고: node 이미지 digest 고정은 릴리스 때(Dockerfile 주석에 기록). airgap 스크립트: curl 이미지 `8.11.1` 고정, 모드 755, 외부 연결 판정 분리(차단됨=정상, 새어 나감=exit 3, 판정 불가=exit 1 — "연결 실패 시 exit 3" 지시는 "연결이 성공해 망이 새는 경우"로 해석), `--admin` 인자 사용. `tests/scripts/run.sh` shellcheck 대상에 `tests/scripts/*.sh` 포함(CI 의 airgap 잡 연결은 리드). 이 PC 는 여전히 docker 데몬이 꺼져 있어 실행 검증 못 함.
- 시험: app 30건 통과, typecheck·eslint packages 통과, shellcheck(`tests/scripts/*.sh`) 통과.
