# 단계 결과 요약

## PH0 준비 — 2026-10-28
- PoC(v6) GEN 구간을 실행해 자기 개발 환경 생성: 에이전트 11종, 스킬 9종, 담당 범위 3쌍, scripts 8종.
- 미해결: `.claude/settings.json`에 PoC 권한·guard hook 병합(사람 작업), WSL `jq·shellcheck·bats` 설치 후 `check-forge.sh` 실기 확인.

## PH1 설계 — 2026-10-28 · `g1-design`
- 산출물: `docs/design.md`, `docs/tasks.md`, ADR-0001~0003.
- G1: 스키마 ↔ PoC 입력 대응 완료, core I/O 금지(ADR-0001), 담당 폴더 겹침 0, P0 기능 22개 배정.
- 결정: 템플릿 `{{KEY}}` 유지·eta 미도입(ADR-0002), golden = PoC 실행 결과 + 의도적 차이 목록(ADR-0003).
- 이월: PoC 결함 D2·D7(정적 스크립트 수정)은 PH4 T-404에서 ADR 후 처리.

## PH2 골격·공통 — 2026-10-28 · `g2-schema-freeze`
- 산출물: pnpm 모노레포(core·exporter·server·web), PoC 정적 원본 26종 `templates/` 이관(`check:poc-static`), zod 스키마·불변식 I1~I6(테스트 32건), `test:scripts`, CI(ubuntu·macOS).
- G2: build·typecheck·lint·test·test:scripts 모두 CI 통과(run 40641712379). 이후 스키마 변경은 ADR + 리드 승인.
- 결정: TypeScript 6.0(typescript-eslint 지원 범위), `@agentforge/source` export 조건(typecheck·vite·vitest는 소스, build는 dist).
- 미해결(사람): `.claude/settings.json` PoC 권한·guard hook 병합, WSL `jq·shellcheck·bats` 설치.

## PH3 세로 한 줄 — 2026-10-28 · `g3-vertical-slice`
- 산출물: `tools/poc-golden.mjs` + golden 3구성, core 렌더러(PoC buildFiles 이식), exporter `toZip`, web 최소 화면(1단계·미리보기·ZIP), bats 13건.
- G3: golden 146파일 바이트 일치(의도적 차이 0), core 199·exporter 4 테스트 통과, shellcheck 0, bats 13/13(ubuntu) — **ZIP → setup → create-worktrees → run-agents → design-1.done 이 review-1 pane 에 도착**(가짜 claude, CI run 40642862952).
- 결정: D5·D6은 `shWord`(안전 단어 외 인용)로 처리해 PoC 출력 유지(ADR-0003 갱신). 패턴 오류는 패턴 코드로 보고.
- 이월: macOS 에서 setup.sh 의존 bats 4건 skip(D7, T-404). 화면 2~6단계는 PH4.

## PH4 MVP 병렬 개발 — 2026-10-29 (G4 전, 단계 전환 대기)
- 방식: 리드 + 서브에이전트 dev-1..3 / review-1..3(worktree 격리), 5라운드. 신호 파일 대신 "상세 설계 → 구현 → review-N 설계·코드 동시 검토", 보고서는 응답으로 받고 리드가 요약(리드 결정).
- 완료 작업: T-401~T-406(dev-1), T-411~T-415(dev-2), T-421~T-426(dev-3) — tasks.md PH4 17건 전부. P0 기능 22개 구현 완료.
- 시험(develop 4c80bbc): core 285 · exporter 20 · web 73 · bats 47 · E2E 5(6단계→ZIP→풀기→setup→check-forge). golden 3구성 바이트 일치(의도적 차이 6파일, ADR-0004).
- CI: ubuntu 전 단계 통과(run 40727988115). macOS 는 3라운드까지 bats 44/44 통과(run 40722628452), 5라운드는 GitHub 러너 미할당으로 미검증.
- 반려·재작업: review 반려 4회(dev-3 시험 누락, dev-1 export 문장 노출, dev-1 guard glob 우회 — 보안, dev-3 마무리 없음). 보안 결함은 재현 → 수정 → bats 고정.
- 결정: ADR-0004(정적 스크립트 보정: macOS 호환, guard fail-closed·완전 일치·glob/제어 문자 차단, integrate 충돌 복구, 반려 이력 순번, check-forge 7항목). 심볼릭 링크 우회는 한계로 수용(2차 방어: git diff 범위 검사·리뷰).
- 운영 교훈: 서브에이전트 worktree 가 main 기준으로 생성됨 → 시작 시 `git merge --ff-only develop` 필수. 병합 커밋 push 를 위해 post-merge 훅 추가. core 빌드 설정(types: [])으로도 typecheck.
- 미결: macOS CI 재검증(Actions 사용량 확인 필요), `.claude/settings.json` 병합(사람), WSL jq·shellcheck·bats 설치(사람), web 번들 500kB 경고, review 권고 잔여(R5-3 이름 규칙 문구에 "." 누락, 테스트 데이터 `as never`).

## PH5 통합·실기 검증 — 2026-10-29 · `v0.1.0`
- 전환: 사람 승인(2026-10-29) → prd "현재 단계" PH5, tasks T-501~T-505.
- T-501 실기 점검 자동화: 구성 3종(`tests/realdevice/`) × ZIP→setup→check-forge→agent-env→worktree→병렬 실행→신호 전달(`tests/scripts/realdevice.bats`). **자동 9칸 통과** — ubuntu·macOS·Dev Container(CI run 40754097160). macOS bats 50/50 으로 PH4 5라운드 미검증분도 해소.
- T-503 보안 점검(`docs/report-security.md`): 수정 2건 — S-1 모델 ID 첫 글자(YAML 예약 문자), S-2 guard 가 NotebookEdit(`notebook_path`)를 검사하지 않음 → ADR-0005. 수용 3건 — S-3 Bash 리다이렉션(실기 확인 R-6), S-4 신호 위조(위협 모델 밖), S-5 심볼릭 링크(ADR-0004).
- T-505 잔여 권고: 이름 규칙 문구 ".", 테스트 데이터 `as never` 제거, exporter 지연 로딩(첫 화면 번들 538→443kB, 경고 해소).
- T-504 dogfooding: 이 저장소 설정(`tests/realdevice/self-agentforge.json`)으로 다시 생성 → 51파일 중 42개 바이트 일치. 의도된 개선분 6개(scripts 4·guard·forge-agents, ADR-0004·0005)를 생성 결과로 교체. CLAUDE.md·.gitignore 는 저장소 고유 내용이라 유지. `.claude/settings.json` 은 병합안만 준비(사람 적용).
- T-502 WSL 3칸 통과(사람 실행: realdevice 3/3, test:scripts 51/51) → 자동 점검 12칸 완료.
- settings.json 병합 적용(d40c3fa): 생성 권한·guard hook + 기존 git-pull hook.
- T-502 실제 Claude Code 주기(WSL, 구성 C) R-1~R-8 전부 ✓ — /forge-init → analyst → check-forge → 병렬 1주기 → integrate·integrator 완주. 결과는 `docs/report-realdevice.md` 3.2.
  - 실기에서 발견해 수정(ADR-0005): D-C 짝 검토 파일이 범위 밖으로 오탐, D-D integrate 가 develop 의 테스트 명령을 무시, D-E 설계 반려 한도 없음. bats 로 재현(수정 전 실패) 후 수정.
  - 확인: guard 가 실제 Claude Code 의 Write·NotebookEdit 를 차단(S-2 실효). frontmatter model 이 ANTHROPIC_MODEL 보다 우선, inherit 일 때만 환경 변수(PRD 9장 미결 해소).
  - 관찰: 대화형 기본 권한이 auto mode 라 Bash 쓰기를 자동 허용할 수 있음 → S-3 갱신, PH6 권고.
- **G4 통과(사람 승인 2026-10-29)**: 점검표 12칸 ✓, 실제 주기 완주, 보안 조치 완료. develop → main 병합(PR #4, 2a4d26a), 태그 `v0.1.0`.
- 다음: PH6(확장 1 — DOC-03·PRV-03·RUN-04·VSC-02·I18N-01) 착수는 사람 결정. PH6 검토 후보: Bash 리다이렉션 범위 검사(S-3), integrate 전 리뷰 판정 확인(S-4), dev pane 권한 모드 안내.

## PH6 확장 1 — 편집·다국어·배치 — 2026-10-29 · `v0.2.0`
- 계약 선행: PoC 에 기준 구현이 없어 design.md 8장·ADR-0006 으로 계약을 고정한 뒤 3라운드 병렬 개발(dev 3 + review 3). 원칙 "선택값 미지정이면 생성물은 PH5 와 바이트 동일" — golden·ko 스냅샷 유지.
- 완료 작업(tasks.md PH6 15건 전부):
  - dev-1: T-601 `mergeClaudeMd`(DOC-03), T-602 tmux pair·grid·role·접두키·마우스·로그(RUN-04), T-603 `check-models.sh`(PRV-03), T-604 Dev Container(VSC-02), T-605 생성물 영어판 `templates/md-en`(I18N-01), T-606 보안 후속(S-3 defaultMode, S-4 검토 파일 확인).
  - dev-2: T-611 check-models bats 19, T-612 run-agents bats 8, T-613 devcontainer-check.sh, T-614 S-4 bats, T-615 E2E 4(화면 en·생성물 en·CLAUDE.md 병합).
  - dev-3: T-621 화면 en·언어 전환·키 동등 시험, T-622 tmux 입력·미리보기, T-623 Dev Container·모델 점검 안내, T-624 기존 CLAUDE.md 붙여넣기 → 병합.
- 시험(develop 6beda8f): core 378 · exporter 20 · web 109 · bats 84 · E2E 9. CI ubuntu·macOS·Dev Container 통과(PR #5·#6).
- 검토: 반려 7회, 모두 수정. 주요 결함 — 마커 구간 겹침 시 PROJECT 내용 소실, pane 순서 역전, 로그 경로 인용(sq), check-models `num_turns` 비숫자 통과, tmux 오류의 단계 연결 오류, 키 미출력 시험의 거짓 통과(변이 시험으로 발견). macOS 전용 결함 2건(bash 3.2 `mapfile`, tmux 전역 옵션 출력)은 CI macOS 로 발견.
- 운영 결정·교훈:
  - settings.json 의 `git merge` 거부가 리드·서브에이전트에도 적용 → 우회하지 않고 develop 기준 worktree(저장소 밖 `af-wt/`)를 처음부터 만들고, 통합은 GitHub API(서버 병합·PR)로 했다.
  - 서브에이전트 6개 동시 실행으로 사용량 한도 1회 도달(초기화 후 재개, 손실 없음).
  - review 에이전트의 변이 시험이 시험의 거짓 통과를 실제로 잡았다 → 시험 검토 기본 절차로 유지.
  - 로컬 E2E: 다른 worktree 의 미리보기 서버가 4173 을 점유하면 낡은 번들을 재사용 → `AF_E2E_PORT` 로 회피.
- dogfooding: 자기 환경 재생성 → scripts 4종(check-models 신규)·README·VS Code 작업을 생성 결과로 교체. `.claude/settings.json` 의 `defaultMode: "default"`(S-3)는 이 저장소 세션의 권한 모드를 바꾸므로 적용하지 않음(사람 결정).
- 남은 것(PH7 이후 후보): 정적 스크립트 출력 문구 영어화(메시지 카탈로그, P2), 영어 문구 원어민 검수, Bash PreToolUse 범위 검사(S-3 근본 대책).
- **게이트 통과(사람 승인 2026-10-29)**: develop → main 병합(PR #7, 84a5aef), 태그 `v0.2.0`. 최종 CI(580bde2)에서 Dev Container 생성물 postCreateCommand 실동작(tmux 3.5a·jq 1.7·Claude Code 2.1.312) 확인.
- 다음: PH7(확장 2 — MKT-01·02, EXP-02) 착수는 사람 결정.

## PH7 확장 2 — 마켓·GitHub — 2026-10-30 · `v0.3.0`
- 계약 선행: design.md 9장·ADR-0007. 스키마 확장(가져온 스킬 `files`·`ref`, GitHub `mode`·`baseUrl`(https 전용)·`branch`)은 리드가 했다. 기본값 생성물은 v0.2.0과 바이트 단위로 같다(golden 유지).
- 완료 작업(tasks.md PH7 전부):
  - dev-1: 위험 검사 `scanSkillRisk`(5종, YAML 표기 변형·줄 이어쓰기·파이프 셸·irm/iex·인터프리터 URL), 위험을 files로 재계산하는 불변식, 가져온 스킬 원문 렌더(644), `sources.lock`(순수 sha256), `planGithubTree`(mode 기준, env.local 차단), IMPORT_RISK·README 안내
  - dev-2: 마켓 색인 서버
    - Fastify, github·git 소스
    - 보안: 관리 API는 `AF_MARKET_ADMIN`일 때만 열고, Host 허용 목록·JSON 전용·tokenEnv 접두·https 강제·symlink 제외를 적용했다. 기본 바인드는 127.0.0.1이다.
  - dev-2: `pushToGithub`(create는 커밋 1건, pr은 PR. tree 일괄 전송, 2차 한도 분류, GITHUB_PARTIAL, 재시도, 로거 noop), E2E 5건
  - dev-3: 4단계 마켓 화면, 6단계 GitHub 화면(토큰은 비제어 입력, 사용 즉시 삭제, https 링크만), 청크 분리(메인 62kB)
- 시험(develop 467b0c6, WSL 로컬): bats 84, core 494 · exporter 50 · server 62 · web 163, E2E 13/14(Windows. 1건은 셸 단계라 CI에서 실행).
- 검토: 반려 8회, 모두 수정.
  - 보안 결함 우회: 위험 검사 우회 총 12종, 인터프리터·SSRF·토큰 평문 전송 경로·CSRF·DNS rebinding
  - 정합성: 응답 계약 불일치, 가져오기 경쟁 상태
  - 시험 판별력: 거짓 통과 다수(변이 시험으로 발견)
- 운영:
  - 계약 누락 2건(응답 필드, 관리 API 보호)은 리드가 9.7로 보충했다.
  - 서브에이전트 사용량 한도에 1회 걸려(4시간 대기) 동시 실행 상한을 3개로 낮췄다.
  - 통합 연결(core planGithubTree, web 임시 대역 제거)은 리드가 통합 브랜치에서 했다.
- **CI 미실행**: GitHub Actions가 결제·지출 한도 문제로 job을 시작하지 않는다(PR #8 이후). develop 병합은 로컬 검증을 근거로 했다. 게이트 전에 CI 3종 통과가 필요하다.
- 게이트 남은 조건(사람): ① Actions 결제 해결 후 CI 통과 ② 실제 GitHub 실기 1회(임시 비공개 저장소 생성 → 푸시 확인 → 삭제, 사람 승인 후).
- 후속 후보:
  - ~~마켓 인터프리터 변형 추가(`require('https').get`, `deno run https://` 등)~~ → 2026-10-30 처리. `REMOTE_DOWNLOAD`에 다음을 추가했다(시험 28건, 오탐 방지 6건).
    - 인터프리터: node `require('https')`·`import('https://…')`, PowerShell `DownloadString/File`·`Start-BitsTransfer`, `certutil -urlcache`·`bitsadmin`·`aria2c`, `httpx`·`axios`, Ruby `open-uri`·`URI.open`, Java `openStream`
    - 패키지 실행기·설치기가 URL을 받는 경우(`deno/bun run`, `npx`·`pnpm dlx`·`uv/pipx run`, `pip/npm/gem install`)
  - GHES CORS 서버 중계(P2)
  - ~~E2E 보강(query string 토큰, ZIP과 tree 동일성, git 설정 격리)~~ → 2026-10-30 처리(`tests/e2e/`).
    - 토큰: 전체 URL(query string 포함)과 Authorization 외 모든 헤더에 토큰이 없는지 본다.
    - 동일성: 푸시 성공 화면에서 받은 ZIP과 GitHub tree가 경로·내용·권한까지 같은지 비교한다(변이 시험으로 판별력 확인).
    - 격리: `makeGitRepo`와 마켓 서버를 임시 HOME·`GIT_CONFIG_GLOBAL`·`GIT_CONFIG_NOSYSTEM`으로 띄워 개발자 PC의 git 설정(autocrlf, 템플릿 훅, 서명)을 읽지 않는다. 서버가 git에 넘기는 환경 변수 목록 때문에, 서버 경로에서 시스템 설정까지 막지는 못한다. 운영 동작(사내 프록시·CA 설정 사용)은 바꾸지 않았다.
- **실제 GitHub 실기(사람 승인 2026-10-30)**:
  - 방법: `dddmagicbbb/af-push-test`(비공개)를 앱 코드 `pushToGithub` create 모드로 만들고 기본 구성 생성물 54개를 푸시했다.
  - GitHub API로 독립 검증한 결과:
    - 커밋은 1건이다(부모 0).
    - `.sh` 10개만 100755다.
    - `env.local`은 없다(`env.local.example`만 있다).
    - 54개 모두 render 결과와 git blob sha·mode가 일치한다.
  - EXP-02 수용 기준(커밋 1건·실행 권한 유지·env.local 미포함)을 충족한다.
  - 삭제는 토큰에 `delete_repo` 권한이 없어 403이었다. 사람이 직접 삭제한다.
- 실기에서 발견한 것(후속):
  - Octokit 로거를 noop으로 지정했는데도 `@octokit/request`의 deprecation 경고(메서드·URL, 토큰 없음)가 console에 찍힌다. 요청 단위 `request.log`에도 noop을 넘겨야 한다.
  - GitHub가 `POST /user/repos`를 2028-03-10 제거 예정으로 표시한다. API 버전 헤더(`X-GitHub-Api-Version`) 고정과 대체 엔드포인트를 확인해야 한다.
- **CI 복구**: 저장소를 공개로 전환해(사람 결정 2026-10-30) Actions 결제 제약을 해소했다. 전환 전에 전 브랜치 이력의 비밀 값 패턴 0건, env.local 커밋 0건, 자체 runner 미등록을 확인했다. develop 20b155c에서 CI 3종이 통과했다.
- **게이트 통과(사람 승인 2026-10-30)**: develop → main 병합(PR #12, d4b2b29), 태그 `v0.3.0`.
- 남은 정리(사람): 실기용 임시 저장소 `dddmagicbbb/af-push-test` 삭제(토큰에 delete_repo 권한 없음) → 2026-10-30 삭제 확인.
- 다음: PH8(상용화·베타 — LIC-01, DPL-01, 베타 5명·폐쇄망 설치 시험) 착수는 사람 결정.

## PH8 상용화·베타 — 2026-10-30 (개발 완료, G5 사람 확인 대기, `v0.9.0` 예정)
- 계약 선행: design.md 10장·ADR-0008.
  - 리드 작업(T-800): 라이선스 키 도구(`tools/license-keygen.mjs`·`license-issue.mjs`)를 만들고, 운영 서명 키 `af-2026-1`을 생성했다.
  - 공개 키는 core에 넣었고, 비밀 키는 저장소 밖에 둔다(`.gitignore` `*.pem`).
- 완료 작업:
  - dev-1(T-801): `verifyLicense`(Ed25519 `@noble/curves`, zip215 끔, base64url 정규·달력 검증), `tierLimits`, checks `LICENSE_LIMIT`·`LICENSE_INVALID`
  - dev-2(T-811·T-812·T-813): 서버 `/api/license`, npx 앱 `agentforge`(--admin 전용·AF_HOST/AF_PORT·noble 번들·소스맵 제외), Docker(비루트·HEALTHCHECK·ENTRYPOINT 0.0.0.0), 폐쇄망 시험
  - dev-3(T-821): 등급 배지·키 입력(메모리만)·상한 안내·생성 차단, 화면 초기값 2명(Free)
  - 리드(T-890): `docs/deploy.md`·`docs/report-beta.md`
- 시험(develop 0385b31):
  - 단위: core 540 · exporter 52 · server 70 · web 191 · app 36
  - CI 4종(ubuntu·macOS·Dev Container·**airgap-docker**) 통과
  - 폐쇄망 시험은 외부 차단 네트워크에서 다음을 매 커밋 확인한다: web·health, `file://` 마켓, 라이선스(시험 이미지 pro·운영 이미지 free), 외부 연결 차단.
- 검토: 반려 4회, 모두 수정.
  - E2E가 화면 기본 2명과 충돌했다.
  - npx 번들에 `@noble`이 빠져 기동에 실패했다.
  - 리드 계약 결함: 운영 빌드에서 환경 변수만으로 시험 키를 넣어 등급을 우회할 수 있었다. 빌드 시점 define으로만 허용하도록 바꿨고, 실측 7종이 모두 free였다.
  - 배포 기본값 강화: 관리 API는 `--admin`일 때만 켜고, 일반 `HOST` 환경 변수는 쓰지 않는다.
- 운영:
  - 저장소 공개 전환으로 CI가 복구됐다.
  - 권한 규칙상 서브에이전트는 브랜치를 바꿀 수 없어, 리드가 worktree를 새로 만들어 준다.
- G5 남은 조건(사람, `docs/report-beta.md`): ① 베타 5명 실제 프로젝트 적용 ② 외부 차단 VM 설치 시험.
- 사람 할 일:
  - ~~서명 비밀 키(`~/.agentforge/license-signing/af-2026-1.pem`) 백업~~ → 2026-10-30 완료. 외장 저장 장치에 복사했고 SHA-256이 원본과 같음을 확인했다. 매체 암호화와 두 번째 사본은 담당자 몫이다.
  - ~~임시 저장소 `af-push-test` 삭제~~ → 2026-10-30 사람이 삭제. 인증 조회 결과 404를 확인했다.
  - npm 공개 배포·웹 호스팅 결정(PH9)
