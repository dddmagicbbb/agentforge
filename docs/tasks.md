# 작업 분할 (PH1 산출물)

> 기준: `docs/prd.md` v2 10장, `docs/design.md`. 단계 전환 전에는 해당 단계 작업만 진행한다.
> 담당 `lead` = 리드 단일 세션, `common` = 공통(리드 승인), `dev-N` = 병렬 개발자(PH4).
> 담당 폴더는 `.claude/devs/dev-N.paths`와 같다. 개발자 사이 폴더 겹침 0.

## 담당 폴더
| 담당 | 도메인 | 폴더 |
| --- | --- | --- |
| common / lead | 공통 | 루트 설정(`package.json`, `pnpm-workspace.yaml`, `tsconfig*`, CI), `catalog/`, `tools/`, `tests/golden/`, `packages/core/src/schema/`(G2 이후 읽기 전용) |
| dev-1 | core | `packages/core/`(schema 제외), `templates/` |
| dev-2 | exporter | `packages/exporter/`, `packages/server/`, `tests/scripts/`, `tests/e2e/` |
| dev-3 | web | `packages/web/` |

## PH2 골격·공통 (lead, 선행 작업)
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | — | common | 공통 | 루트, `packages/*/package.json` | G1 | pnpm workspaces 4패키지, TS strict, ESM, eslint(core I/O 금지 규칙 포함), `pnpm build·typecheck·lint·test` 통과 |
| C-02 | — | common | 공통 | `templates/`, `tools/` | C-01 | PoC `STATIC` 26종을 바이트 그대로 이관(`tools/extract-poc-static.mjs`로 추출·대조), codegen → `templates.generated.ts` |
| C-03 | 전체 | common | 공통 | `packages/core/src/schema/` | C-01 | design.md 2장 스키마·패턴·불변식 I1~I6 + 불변식 테스트, `AppError`, core API 시그니처(본문 `throw not implemented`) |
| C-04 | — | common | 공통 | `tests/scripts/`, CI | C-02 | `pnpm test:scripts` 틀(bash -n + shellcheck + bats), CI(GitHub Actions: ubuntu + macos) |
| C-05 | — | common | 공통 | git | C-01 | `develop` 브랜치 생성, G2 태그 `g2-schema-freeze` |

## PH3 세로 한 줄 (lead)
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| T-301 | — | lead | 공통 | `tools/`, `tests/golden/` | C-02 | `tools/poc-golden.mjs`(ADR-0003), golden 2구성(기본 / UI 끔·개발자 2·LiteLLM), `intended-diffs.ts`(D5·D6) |
| T-302 | REQ-01, REQ-02 | lead | core | `packages/core/src/render/` | C-03 | requirements.md 원문 저장, forge.config.json golden 일치, 이름 규칙 위반 시 `validate` 오류 |
| T-303 | RTN-01, RTN-02 | lead | core | `packages/core/src/render/` | C-03 | 순차 에이전트 6종 렌더, uiDesign 끔 → ux-designer·docs/design/ui·README·CLAUDE.md 루틴에서 제외(I7) |
| T-304 | DOC-01, DOC-02 | lead | core | `packages/core/src/render/` | T-303 | CLAUDE.md 고정 규칙 + 마커 4구간, 200줄 이하, PRD 양식 7장 순서 고정, golden 일치 |
| T-305 | PRV-01 | lead | core | `packages/core/src/providers/`, `render/` | C-03 | agent-env.sh case(모델 `shQuote`), 비 Claude 별칭 3종 매핑, env.local.example, bats: 에이전트별 BASE_URL·MODEL, 키 누락 오류 |
| T-306 | RUN-01, RUN-02 | lead | core | `packages/core/src/render/scaffold.ts` | C-02 | 정적 스크립트·guard·hook·settings.json 렌더, 모든 golden 구성에서 bash -n·shellcheck 0 |
| T-307 | EXP-01(기본) | lead | exporter·web | `packages/exporter/`, `packages/web/` | T-302~T-306 | `toZip`(755 유지), 최소 화면: 1단계 + 미리보기 + ZIP 버튼 |
| T-308 | RUN-02 | lead | 공통 | `tests/scripts/` | T-307 | **G3**: 받은 ZIP → setup.sh → create-worktrees.sh → run-agents.sh → 신호 1건이 review pane에 도달(가짜 claude), bats setup.sh 4사례 |

## PH4 MVP 병렬 개발
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| T-401 | DEV-01, DEV-02 | dev-1 | core | `packages/core/` | G3 | dev-N·review-N·paths·전용 스킬 렌더(ready 아닌 dev는 전부 생략), `resizeDevs`, fast-check 3→5→2 일관성, 경로 정규화(D4) |
| T-402 | SKL-01, SKL-02 | dev-1 | core | `packages/core/`, `templates/md/` | T-401 | conventions·tdd 토글, 고정 스킬 4종, `devN-<domain>`은 dev-N·review-N에만, SKILL.md frontmatter 형식 검증 |
| T-403 | GEN-01, GEN-02 | dev-1 | core | `templates/md/` | T-401 | forge-init(`disable-model-invocation`, 질문 후 작성), forge-agents(재시도 3회), D2 자리표시 이름 정합 |
| T-404 | GEN-03, DEV-03 | dev-1 | core | `templates/static/` | T-403 | check-forge 미치환 `{{` 검사 추가(D2), guard·setup macOS 호환(D7) — **ADR + 리드 승인 후** 변경 |
| T-405 | PRV-02, PRV-04 | dev-1 | core | `packages/core/` | T-401 | litellm.yaml·start-gateway.sh 조건부, `checks()` 코드 12종(design.md 3장), `canExport` |
| T-406 | RUN-03, VSC-01 | dev-1 | core | `packages/core/` | T-401 | integrate.sh·tasks.json(6작업) 렌더, 대표 구성 6종 스냅샷 |
| T-411 | EXP-01(완성) | dev-2 | exporter | `packages/exporter/` | G3 | 루트 폴더명, 755/644, LF, ZIP ↔ `RenderedFile[]` 동등 테스트, 2초 이내 |
| T-412 | DEV-03 | dev-2 | exporter | `tests/scripts/` | G3 | bats guard-paths 6사례(허용, 차단 exit 2, 상대 경로, `../`, AF_AGENT 없음, paths 없음) |
| T-413 | GEN-03 | dev-2 | exporter | `tests/scripts/` | G3 | bats check-forge 6사례(통과, 겹침, 스킬 누락, paths 누락, 기능 ID 미배정, prd/tasks 없음) |
| T-414 | RUN-02, RUN-03 | dev-2 | exporter | `tests/scripts/` | G3 | 모의 병렬: 범위 밖 변경 감지, 반려 한도 → `dev-N.blocked`, integrate 충돌 시 abort·`pre-integration` 태그 |
| T-415 | EXP-01 | dev-2 | exporter | `tests/e2e/` | T-411, T-426 | Playwright: 6단계 → ZIP → 풀기 → setup.sh → check-forge.sh(문서 더미) → 파일 목록·권한 |
| T-421 | REQ-01, REQ-02, DEV-01, RTN-01 | dev-3 | web | `packages/web/` | G3 | 화면 1 요구사항: 이름·언어·요구사항·개발자 수(1~6)·UI 토글·명령·반려 한도 |
| T-422 | RTN-02 | dev-3 | web | `packages/web/` | T-421 | 화면 2 루틴·에이전트: 흐름도, 제공자·모델 선택, 산출물·관문 표시 |
| T-423 | DEV-02 | dev-3 | web | `packages/web/` | T-421 | 화면 3 개발자: 도메인·폴더·개발/검증 모델, 겹침·약한 검증 경고 |
| T-424 | SKL-01, SKL-02 | dev-3 | web | `packages/web/` | T-421 | 화면 4 스킬: 계층별 표시, 토글(마켓 영역은 P1 — 비활성 안내만) |
| T-425 | PRV-01, PRV-04 | dev-3 | web | `packages/web/` | T-421 | 화면 5 연결·실행: 사용 제공자·주소, tmux 미리보기, 경고 |
| T-426 | EXP-01 | dev-3 | web | `packages/web/` | T-421~T-425 | 화면 6 생성: 검사 목록, 오류 시 내보내기 차단, ZIP, 미리보기 트리(AI·755 표시), 100ms 갱신 |

## PH5 통합·실기 검증 (lead + 사람, 신규 기능 없음)
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| T-501 | — | lead | 공통 | `tests/realdevice/`, `tests/scripts/realdevice.bats`, CI | PH4 | 구성 3종(Claude 단일 / 제공자 혼용 / 개발자 1명·UI 끔) × ZIP→setup→check-forge→agent-env→worktree→병렬 실행→신호 전달 자동 점검. CI: ubuntu·macOS·Dev Container |
| T-502 | — | 사람 | 공통 | — | T-501 | WSL 칸(`pnpm test:scripts`) + 실제 Claude Code 로 `/forge-init` → `/forge-agents` → `check-forge.sh` → 병렬 실행 1주기, `model` vs `ANTHROPIC_MODEL` 우선순위 확인(prd 9장) → `docs/report-realdevice.md` 기록 |
| T-503 | — | lead | 공통 | `docs/report-security.md` | PH4 | 셸 인자 이스케이프, 비밀 값 미저장, 외부 CDN 미사용, hook 우회(`../`, glob, Bash 리다이렉션) 점검과 조치 |
| T-504 | — | lead + 사람 | 공통 | `.claude/`, `scripts/` | T-501, T-503 | dogfooding: 완성된 앱으로 이 저장소 개발 환경을 다시 생성해 현재 PoC 산출물과 대조 → 교체(settings.json 병합은 사람) |
| T-505 | — | lead | 공통 | 해당 패키지 | PH4 | PH4 잔여 권고 정리: 이름 규칙 문구 ".", 테스트 데이터 `as never`, web 번들 500kB 경고 |

G4(`v0.1.0`): 점검표 12칸 통과(T-501 자동 9칸 + T-502 WSL 3칸·실제 주기), 보안 조치 완료(T-503).

## PH6 확장 1 — 편집·다국어·배치 (dev 3 + review 3, 계약: design.md 8장 · ADR-0006)
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| T-601 | DOC-03 | dev-1 | core | `packages/core/` | — | `mergeClaudeMd` 8.1 규칙 6개·`CLAUDE_MD_MARKERS`, fast-check(마커 밖 보존·PROJECT 보존·멱등) |
| T-602 | RUN-04 | dev-1 | core | `templates/static/run-agents.sh`, `packages/core/` | — | 8.2: config `tmux` 출력, run-agents pair·grid·role·prefix·mouse·logs, logs 시 .gitignore, 기본값이면 golden 불변 |
| T-603 | PRV-03 | dev-1 | core | `templates/static/`, `packages/core/` | — | 8.3: check-models.sh(항상 생성·755), VS Code 7번째 작업, shellcheck 0 |
| T-604 | VSC-02 | dev-1 | core | `packages/core/` | — | 8.4: devcontainer.json(지정 시만), README 폐쇄망 안내, `DEVCONTAINER_CLOSED_NET` info |
| T-605 | I18N-01 | dev-1 | core | `templates/md-en/`, `packages/core/` | — | 8.5: md-en 16종(자리표시 동일), language=en 이면 CLAUDE.md·README·PRD 양식·에이전트·스킬 영어, ko 는 golden 불변 |
| T-606 | (보안) | dev-1 | core | `templates/static/`, `packages/core/` | — | 8.6: settings `defaultMode`, integrate 검토 파일 확인, 코드 검토 요청 문구 — ADR-0006, intended-diffs 갱신(리드 승인) |
| T-611 | PRV-03 | dev-2 | exporter | `tests/scripts/` | 계약 | bats check-models: 통과·경고(도구 미호출·값 없음)·실패(is_error·명령 실패·JSON 깨짐·agent-env 실패)·종료 코드·키 미출력 |
| T-612 | RUN-04 | dev-2 | exporter | `tests/scripts/` | 계약 | bats run-agents: grid·role 창·pane 기록·신호 중계, prefix·mouse 세션 범위, logs 파일 생성 |
| T-613 | VSC-02 | dev-2 | exporter | `tests/scripts/` | 계약 | `tests/scripts/devcontainer-check.sh`: 생성 devcontainer.json 의 이미지로 postCreateCommand 실행 후 tmux·claude·jq 동작 확인(CI 연결은 리드) |
| T-614 | (보안) | dev-2 | exporter | `tests/scripts/` | 계약 | bats: 검토 파일 없는 feature 는 integrate 실패(exit 1)·develop 불변, 있으면 병합 |
| T-615 | I18N-01, DOC-03 | dev-2 | exporter | `tests/e2e/` | T-621, T-624 | E2E: en 전환 화면, language=en ZIP 영어 README, 기존 CLAUDE.md 병합 후 ZIP 에 마커 밖 보존 |
| T-621 | I18N-01 | dev-3 | web | `packages/web/` | — | en.json, ko/en 전환, 키·변수·빈 값 동등 시험(CI) |
| T-622 | RUN-04 | dev-3 | web | `packages/web/` | — | 5단계: 배치·접두키·마우스·로그 입력, tmux 미리보기가 배치를 반영 |
| T-623 | VSC-02, PRV-03 | dev-3 | web | `packages/web/` | — | Dev Container 토글·안내 issue 표시, 6단계 "받은 뒤 할 일"에 모델 점검 |
| T-624 | DOC-03 | dev-3 | web | `packages/web/` | T-601 | 6단계: 기존 CLAUDE.md 붙여넣기(선택) → 병합 결과가 미리보기·ZIP 에 반영, 마커 오류 표시 |

라운드: 1) T-601·T-602 / T-612·T-614 / T-621 → 2) T-603·T-604 / T-611·T-613 / T-622·T-623 → 3) T-605·T-606 / T-615 / T-624.
G(`v0.2.0`): 기능 ID별 검증 통과, CI(ubuntu·macOS·Dev Container) 통과, 기본값 구성 golden 불변.

## PH7 확장 2 — 마켓·GitHub (dev 3 + review 3, 계약: design.md 9장 · ADR-0007)
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| T-701 | MKT-02 | dev-1 | core | `packages/core/` | 스키마(리드 완료) | 9.2 `scanSkillRisk` 표(5종) + 불변식(flags 재계산·SKILL.md·name·중복·크기), 렌더 9.3(원문 644), 시험(위험 표·조작 방지·기본값 불변) |
| T-702 | MKT-02, EXP-02 | dev-1 | core | `packages/core/` | T-701 | `sources.lock`(sha256 순수 구현·키 순서), `planGithubTree`(mode·env.local 차단), ZIP 동등 시험 |
| T-703 | MKT-02, EXP-02 | dev-1 | core | `packages/core/` | T-702 | checks 문구 코드(위험 5종 info·IMPORT_* ), README 가져온 스킬 안내(조건부), ko·en |
| T-711 | MKT-01 | dev-2 | server | `packages/server/` | 스키마 | 9.4 Fastify 앱·소스 등록/삭제·github(가짜 fetch)·git(file:// 로컬 저장소) 색인·검색·상세, 보안(패턴·인자 배열·시간 제한·토큰 미노출), 시험 |
| T-712 | EXP-02 | dev-2 | exporter | `packages/exporter/` | T-702 | 9.5 `pushToGithub` create(커밋 1건·force ref)/pr(base_tree·브랜치·PR), 오류 코드 매핑·토큰 미노출, 가짜 GitHub API 시험 |
| T-713 | MKT-01·02, EXP-02 | dev-2 | exporter | `tests/e2e/`, `tests/scripts/` | T-711, T-721, T-722 | E2E: 서버(webDist)+file:// 소스 → 검색·미리보기·위험 확인·가져오기 → ZIP 에 원문·sources.lock; 가짜 GitHub 서버로 push |
| T-721 | MKT-01·02 | dev-3 | web | `packages/web/` | 계약 | 4단계 마켓: 서버 감지(없으면 비활성 안내), 소스 목록·등록·삭제·갱신, 검색, 미리보기(SKILL.md·파일 목록·위험), 위험 확인 없이는 가져오기 불가, 대상 선택 |
| T-722 | EXP-02 | dev-3 | web | `packages/web/` | 계약 | 6단계 GitHub: owner·repo·공개·mode·GHES 주소·branch, 토큰(password, 저장 안 함·푸시 후 지움), 진행·결과 링크·오류 코드 문구, ZIP 과 같은 파일 |
| T-723 | — | dev-3 | web | `packages/web/` | — | 시험 안정화: "ZIP 파일명" 시험이 부하 시 시간 초과(지연 로딩) → 대기 시간 보강 |

라운드: 1) T-701 / T-711 / T-721 → 2) T-702·T-703 / T-712 / T-722·T-723 → 3) 통합 수정 / T-713 / 화면 마무리.
G(`v0.3.0`): 기능 ID별 검증 통과, CI 3종 통과, 기본값 golden 불변, 실제 GitHub 실기 1회(사람 확인 후 임시 저장소 생성·삭제).

## PH8 상용화·베타 (dev 3 + review 3 + 사람, 계약: design.md 10장 · ADR-0008)
| 작업 ID | 기능 ID | 담당 | 도메인 | 담당 폴더 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- | --- | --- |
| T-800 | LIC-01 | lead | 공통 | `tools/`, `.gitignore` | — | `license-keygen.mjs`·`license-issue.mjs`(node:crypto Ed25519, 비밀 키 저장소 밖), 운영 공개 키 1개 생성(kid `af-2026-1`), 비밀 키 위치 안내 |
| T-801 | LIC-01 | dev-1 | core | `packages/core/` | T-800 | 10.1 `verifyLicense`·`tierLimits`·`LICENSE_PUBLIC_KEYS`·checks `LICENSE_LIMIT`/`LICENSE_INVALID`·canExport, `@noble/curves` 추가, 시험(위조·만료·kid·형식·경계, 시험 키 주입) |
| T-811 | LIC-01·DPL-01 | dev-2 | server | `packages/server/` | T-801 | 10.2 `/api/license`·health.license, env/파일 우선순위, 원문 미응답, 시험 공개 키 주입 조건 |
| T-812 | DPL-01 | dev-2 | app | `packages/app/`(신규) | T-811 | npx CLI(`agentforge`), 인자·종료 처리, 패키지 내용(web·server dist·catalog), 시험 |
| T-813 | DPL-01 | dev-2 | 배포 | `Dockerfile`, `.dockerignore`, `tests/scripts/airgap-check.sh` | T-812 | 10.2 Docker(비루트·HEALTHCHECK)·폐쇄망 시험 스크립트(CI 연결은 리드) |
| T-821 | LIC-01 | dev-3 | web | `packages/web/` | T-801 | 10.3 등급 표시·키 입력(메모리만)·LICENSE_* 문구·제한 안내·생성 차단 |
| T-890 | — | lead | 문서 | `docs/deploy.md`, `docs/report-beta.md` | T-813 | 설치·폐쇄망 반입·라이선스 적용 문서, 베타 5명·폐쇄망 VM 점검표 |

담당 폴더 메모: `packages/app/`·`Dockerfile`·`.dockerignore`는 이번 단계에서 dev-2에게 배정한다(`.claude/devs/dev-2.paths` 갱신은 리드).
G5(`v0.9.0`): 기능 ID별 검증 통과, CI 3종 + 폐쇄망 시험(docker) 통과, **사람: 베타 5명 실제 프로젝트 적용·폐쇄망 VM 설치 시험**.

## 기능 ID 배정 확인 (P0 22개)
REQ-01 T-302·T-421 / REQ-02 T-302·T-421 / RTN-01 T-303·T-421 / RTN-02 T-303·T-422 / DEV-01 T-401·T-421 / DEV-02 T-401·T-423 / DEV-03 T-404·T-412 / GEN-01 T-403 / GEN-02 T-403 / GEN-03 T-404·T-413 / DOC-01 T-304 / DOC-02 T-304 / SKL-01 T-402·T-424 / SKL-02 T-402·T-424 / PRV-01 T-305·T-425 / PRV-02 T-405 / PRV-04 T-405·T-425 / RUN-01 T-306 / RUN-02 T-306·T-308·T-414 / RUN-03 T-406·T-414 / VSC-01 T-406 / EXP-01 T-307·T-411·T-415·T-426

## 메모
- i18n: PH4 화면은 문자열을 i18n 키 + ko 리소스로만 작성한다. en 번역과 누락 키 CI 검사는 I18N-01(PH6).
- 작업량: dev-1 6건(렌더러 중심), dev-2 5건(테스트 중심), dev-3 6건(화면). 최대/최소 1.2배 이내.
