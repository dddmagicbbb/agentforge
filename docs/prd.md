# AgentForge PRD (개발용 요약판 v2)

> 이 문서는 AgentForge 자체를 개발하기 위한 요구사항이다. 기능 ID는 tasks.md·커밋·리뷰에서 그대로 쓴다.
> 우선순위: P0 = MVP(G4) 필수 / P1 = 정식 출시(G6) 필수 / P2 = 출시 이후
> v2 변경: "AI 미호출·빈 양식" → "구조는 템플릿, 내용은 사용자 Claude Code의 생성 스킬, 판정은 스크립트". 개발 루틴 8단계, 개발자별 에이전트·스킬 분리.

## 1. 개요
| 항목 | 내용 |
| --- | --- |
| 제품 | Claude Code 멀티 에이전트 병렬 개발 환경 생성기 |
| 원칙 | 앱은 AI 미호출(생성 스킬 동봉) · 구조는 템플릿 · 판정은 스크립트 · 사용자 PC 명령 미실행 · 인증 정보 미취급 |
| 대상 | 개인 개발자, SI/SM 개발팀 리드, 폐쇄망 기업 |
| 동작 기준 | docs/reference/poc.html (화면 흐름과 생성 로직, 생성 스크립트 원본) |

## 2. 목표
- 처음 쓰는 사용자가 10분 안에 환경을 받고, 같은 날 `/forge-init`으로 PRD 작성을 시작한다.
- 생성된 셸 스크립트는 지원 환경(macOS, Linux, WSL, Dev Container)에서 수정 없이 동작한다.
- 연결한 LLM 성능이 낮아도 병렬 실행 구조(에이전트 정의·범위·스크립트)는 깨지지 않는다.

## 3. 생성되는 개발 루틴 (사용자 프로젝트)
기획 → 분석 → (UI/UX 설계: 선택) → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증

| # | 단계 | 에이전트 | 산출물 | 관문 |
| --- | --- | --- | --- | --- |
| 1 | 기획 | planner | docs/prd.md (`/forge-init`) | 사람 승인 |
| 2 | 분석 | analyst | analysis.md, tasks.md | 기능 ID 전부 배정, 폴더 겹침 0 |
| 3 | UI/UX 설계(선택) | ux-designer | docs/design/ui/ (화면별 필요 데이터 포함) | 화면 ↔ 기능 대응 |
| 4 | 시스템 설계 | architect | system.md, API 계약, ADR | 계약 고정, 화면 데이터 ↔ API 대응표 |
| 5 | 공통 개발 | common-dev | 공통 모듈, develop | 빌드·테스트 통과 |
| 6 | 상세 설계 + 개발 | dev-1…N | detail/dev-N.md → 코드 | 설계 검토 통과 후 구현 |
| 7 | 개발 검증 | review-1…N | review/dev-N.md | review-N.pass |
| 8 | 통합 검증 | integrator | integration.md | 전체 테스트 + 사람 승인 |

## 4. 사용자 흐름
**앱 화면 6단계**: 1 요구사항 → 2 루틴·에이전트 → 3 개발자 → 4 스킬 → 5 연결·실행 → 6 생성(ZIP / GitHub)

**받은 뒤(사용자 PC)**: `setup.sh` → `claude` 직접 로그인·env.local 키 입력 → planner에서 `/forge-init` → 분석·UI/UX·시스템 설계·공통 개발 → 리드 세션 `/forge-agents` → `check-forge.sh` → `create-worktrees.sh` → `run-agents.sh` → `integrate.sh`

## 5. 기능 목록
| ID | 기능 | 우선 | 완료 기준 |
| --- | --- | --- | --- |
| REQ-01 | 요구사항 자유 문장 입력 → `.agentforge/requirements.md` | P0 | 원문 그대로 저장, 30자 미만 경고 |
| REQ-02 | 프로젝트 이름, 답변 언어(ko/en), 설치·테스트·E2E 명령, 반려 한도 → `forge.config.json` | P0 | 스키마 검증, 이름 규칙 위반 시 진행 불가 |
| RTN-01 | 8단계 루틴, UI/UX 설계 사용 토글 | P0 | 끄면 ux-designer·docs/design/ui·README 단계·CLAUDE.md 루틴에서 제외 |
| RTN-02 | 순차 단계 에이전트 6종(planner, analyst, ux-designer, architect, common-dev, integrator) 정의와 제공자·모델 | P0 | .claude/agents/*.md 생성, 단계별 산출물·관문 화면 표시 |
| DEV-01 | 개발자 수 1~6(등급 상한) | P0 | 모든 생성물이 N에 맞게 바뀜 |
| DEV-02 | 개발자별 dev-N·review-N 에이전트, 도메인·담당 폴더(선택), 개발·검증 모델 | P0 | 비우면 생성하지 않고 `/forge-agents`에 위임, 폴더 겹침 시 진행 불가 |
| DEV-03 | 담당 범위 강제: `.claude/devs/*.paths` + `guard-paths.sh`(PreToolUse) + settings.json permissions | P0 | 범위 밖 Edit·Write exit 2, `../` 우회 차단 |
| GEN-01 | 생성 스킬 `/forge-init`(요구사항 → PRD·CLAUDE.md PROJECT 구간) | P0 | `disable-model-invocation`, 질문 후 작성 절차 포함 |
| GEN-02 | 생성 스킬 `/forge-agents` + 템플릿(dev, review, dev-skill, prd) | P0 | tasks.md 기준 생성·보완, check-forge 재시도 3회 |
| GEN-03 | 구성 검사 `check-forge.sh`(CLAUDE.md 길이, 에이전트·범위·스킬 참조, 폴더 겹침, 스킬 name, hook 권한, 기능 ID 배정) | P0 | 6항목 통과/실패 출력, 실패 시 exit 1 |
| DOC-01 | CLAUDE.md 고정 규칙 + 마커 4구간(PROJECT, AGENTS, DEVS, SKILLS) | P0 | 스냅샷 일치, 200줄 이하 |
| DOC-02 | PRD 양식 템플릿(7장, UI 여부 반영) | P0 | 장 순서 고정 |
| DOC-03 | 재생성 시 마커 구간만 교체하는 병합 | P1 | 마커 밖 사용자 수정 보존 테스트 |
| SKL-01 | 내장 스킬: 공통(conventions, tdd: 선택), 역할(detail-design, code-review: 필수) | P0 | SKILL.md 형식 검증 통과 |
| SKL-02 | 개발자 전용 스킬 `devN-도메인` 자리 생성, 에이전트 `skills:` 반영 | P0 | dev-N·review-N에만 배정 |
| PRV-01 | 제공자 6종: Claude(로그인), OpenRouter·Ollama·사내 vLLM(직접), OpenAI·Gemini(LiteLLM) → `agent-env.sh` 에이전트 이름별 분기 | P0 | 비 Claude는 별칭 3종을 같은 모델로 매핑 |
| PRV-02 | LiteLLM 설정·실행 스크립트(쓰는 경우만) | P0 | litellm.yaml, start-gateway.sh |
| PRV-03 | 모델 점검 스크립트(응답·도구 호출) | P1 | check-models.sh 통과/경고/실패 |
| PRV-04 | 화면 경고: 모델 ID 누락, 검증 모델 약함, OpenRouter 무료 한도, vLLM 도구 파서, 게이트웨이 필요 | P0 | 조건별 표시, 오류 항목 있으면 내보내기 차단 |
| RUN-01 | `run-role.sh`(순차 단계), `create-worktrees.sh`(develop 기준, 설치 명령) | P0 | 재실행 안전 |
| RUN-02 | `run-agents.sh`(쌍별 창, pane id 기록) + `wait-and-review.sh`(설계·코드 이중 검토, 범위 검사, 반려 한도) | P0 | 신호 → 해당 pane 메시지 중계 |
| RUN-03 | `integrate.sh`(통과 확인 → 병합 → 테스트·E2E 로그 → integrator) | P0 | 충돌 시 abort, pre-integration 태그 |
| RUN-04 | tmux 배치 추가(한 창 바둑판, 역할별 창), 접두키·마우스·로그 | P1 | 3종 모두 실기 동작 |
| VSC-01 | `.vscode/tasks.json`(준비, worktree, 병렬 실행, 붙기, 검사, 통합) | P0 | 작업 메뉴에서 실행 |
| VSC-02 | Dev Container(선택) | P1 | 컨테이너에서 tmux·claude 동작 |
| MKT-01 | 마켓플레이스 소스 등록(공식·커뮤니티·사내 Git·임의 저장소), 색인·검색 | P1 | 색인·검색 동작 |
| MKT-02 | 미리보기·위험 검사·확인 후 가져오기, 적용 대상(전원/dev/review), sources.lock | P1 | 위험 항목은 확인 없이 포함 불가 |
| EXP-01 | ZIP 다운로드(setup.sh, README, env.local.example, 실행 권한 755) | P0 | 다른 PC에서 setup 후 check-forge까지 동작 |
| EXP-02 | GitHub·GHES 저장소 생성/기존 저장소 PR | P1 | 커밋 1건, 실행 권한 유지, env.local 미포함 |
| EXP-03 | GitLab 푸시 | P2 | — |
| I18N-01 | 한국어·영어 UI, 생성물 언어 | P1 | 누락 키 CI 검사 |
| LIC-01 | 등급(Free 2명·Pro 6명·Team), 서명 키 오프라인 검증 | P1 | 등급별 제한 동작 |
| DPL-01 | 배포: 로컬(npx), 설치형(Docker, 외부 접속 없음), 웹 서비스 | P1 | 폐쇄망 설치 시험 통과 |
| BYOK-01 | 앱 안에서 사용자 API 키로 PRD 초안 생성(선택) | P2 | 키 미저장, 구독 로그인(OAuth) 사용 금지 |

## 6. 생성물과 작성 주체
| 생성물 | 작성 주체 | 비고 |
| --- | --- | --- |
| 폴더 구조, scripts/*.sh, hooks, settings.json, tasks.json, forge.config.json, 템플릿 | AgentForge(템플릿) | 같은 입력 → 같은 출력 |
| CLAUDE.md 고정 규칙·AGENTS 구간 | AgentForge | PROJECT 구간은 `/forge-init` |
| docs/prd.md, CLAUDE.md PROJECT 구간 | 사용자 Claude Code(`/forge-init`) | |
| analysis.md, tasks.md, design/ | 순차 단계 에이전트 | |
| dev-N·review-N 정의, 전용 스킬 본문, *.paths | AgentForge(입력 시) 또는 `/forge-agents` | `/forge-agents`가 tasks.md 기준으로 보완 |
| 통과/실패 판정 | check-forge.sh, wait-and-review.sh | AI 판단에 맡기지 않음 |

## 7. 비기능 요구사항
| 항목 | 내용 |
| --- | --- |
| 폐쇄망 | 설치형은 외부 접속 없이 동작(마켓 색인은 사내 Git 또는 수동 업로드). 생성 환경은 사내 vLLM·Ollama만으로 실행 가능 |
| 보안 | 비밀 값 미수집·미저장, 셸 인자 이스케이프, 가져온 스킬 위험 검사, env.local 읽기 거부(permissions) |
| 성능 | 설정 변경 후 미리보기 갱신 100ms 이내, ZIP 생성 2초 이내 |
| 호환 | 생성물: bash 4+, tmux 3.2+, git 2.30+, jq 1.6+, Claude Code 현재 버전 |
| 정책 | 구독 OAuth를 앱에서 쓰지 않음(2026-02-19 Anthropic 정책). 출시 전 원문 재확인 |

## 8. 범위 제외
- 앱에서의 명령 실행·원격 SSH 실행, 실행 중 대시보드
- Agent Teams 모드(팀원 skills 미적용·리드 접속 설정 상속·재개 불가로 개발자별 분리가 안 됨)

## 9. 미결 사항
- [ ] 제품명 확정(상표 검색), "for Claude Code" 표기 가능 여부
- [ ] 가격 정책(구독/영구)
- [ ] Gemini·OpenAI 기본 추천 모델 ID(카탈로그로 관리)
- [x] `claude --agent` 실행 시 frontmatter `model`과 `ANTHROPIC_MODEL` 우선순위 실기 확인 → frontmatter 우선, `inherit` 일 때만 `ANTHROPIC_MODEL`(PH5 R-8)

## 10. 개발 단계

> **현재 단계: PH8**
> 에이전트는 현재 단계에 포함된 기능 ID만 구현한다. 다음 단계 기능이 필요해 보이면 구현하지 말고 report에 적는다.
> 단계 전환은 사람(PM)이 게이트를 확인한 뒤 위 "현재 단계" 값을 바꾸고 태그를 남겨서 한다.

### 10.1 단계 요약
| 단계 | 이름 | 수행 방식 | 기간(추정) | 포함 기능 ID | 게이트 · 태그 |
| --- | --- | --- | --- | --- | --- |
| PH0 | 준비 | 사람 | 1일 | — (PoC로 자기 개발 환경 생성, 규칙 연결, 저장소) | check-forge 통과 · — |
| PH1 | 설계 | 리드 단일 세션(Plan) | 2일 | 전체 P0의 설계 | G1 설계 승인 · `g1-design` |
| PH2 | 골격·공통 | 리드 단일 세션 | 2~3일 | 스키마(전 기능), CI, 테스트 틀, 템플릿 원본 이관 | G2 스키마 동결 · `g2-schema-freeze` |
| PH3 | 세로 한 줄 | 리드 단일 세션 | 3~4일 | REQ-01·02, RTN-01·02, DOC-01·02, PRV-01, RUN-01·02, EXP-01(기본) | G3 ZIP→setup→run-agents 중계 · `g3-vertical-slice` |
| PH4 | MVP 병렬 개발 | 개발 3 + 검증 3 | 2~3주 | DEV-01~03, GEN-01~03, SKL-01·02, PRV-02·04, RUN-03, VSC-01, EXP-01(완성), 화면 6단계 | 기능 ID별 검증 통과 · — |
| PH5 | 통합·실기 검증 | 리드 + 사람 | 4~5일 | (신규 기능 없음) 실기 점검, 보안 점검, dogfooding | G4 MVP 완료 · `v0.1.0` |
| PH6 | 확장 1 — 편집·다국어·배치 | 개발 3 + 검증 3 | 1~1.5주 | DOC-03, PRV-03, RUN-04, VSC-02, I18N-01 | 기능 ID별 검증 통과 · `v0.2.0` |
| PH7 | 확장 2 — 마켓·GitHub | 개발 3 + 검증 3 | 1~1.5주 | MKT-01·02, EXP-02 | 기능 ID별 검증 통과 · `v0.3.0` |
| PH8 | 상용화·베타 | 개발 2~3 + 사람 | 1~2주 | LIC-01, DPL-01, 베타 5명·폐쇄망 설치 시험 | G5 베타 통과 · `v0.9.0` |
| PH9 | 출시 준비 | 리드 + 사람 | 1~2주 | (신규 기능 없음) 상표·약관·문서·배포 파이프라인, 실기·보안 재점검 | G6 출시 판정 · `v1.0.0` |
| 이후 | 2차 | — | — | EXP-03, BYOK-01 등 P2 | — |

합계: MVP(PH0~PH5) 약 5~6주, 정식 출시(PH9) 약 9~11주. 사람 1명 + Claude Code 기준, 하루 사람 투입 1~2시간.
산정 근거: v1 계획과 같은 범위에 GEN-01~03·DEV-03·RUN-03이 추가됐지만, 생성 스크립트 9종은 PoC에서 bash -n·shellcheck·모의 실행을 통과한 원본을 템플릿으로 옮기므로 PH3·PH4 증가분을 각 1일 이내로 봤다. 실기 점검 항목이 늘어 PH5만 1일 늘렸다.

### 10.2 단계별 상세

**PH0 준비**
- 산출물: PoC(docs/reference/poc.html)로 생성한 자기 개발 환경, CLAUDE.md 끝에 `@docs/project-rules.md`, 비공개 저장소
- 완료 조건: `/agents`에 에이전트 표시, `bash scripts/check-forge.sh` 통과, 제품 원칙 응답 확인

**PH1 설계**
- 입력: 이 문서, `docs/project-rules.md`, `docs/reference/poc.html`
- 산출물: `docs/design.md`(스키마·불변식·core API·렌더러 대응표·템플릿 목록), `docs/tasks.md`(PH3·PH4 작업, 담당·선행·완료 기준), `docs/adr/0001~0003`
- G1: 스키마가 PoC 입력 항목을 모두 담음 / core에 I/O 없음 / 담당 폴더 비중복 / P0 기능 ID 전부 배정

**PH2 골격·공통**
- 산출물: pnpm 모노레포, zod 스키마와 불변식 테스트, core API 시그니처, PoC의 정적 스크립트·마크다운 원본을 `templates/`로 이관, `test:scripts`, CI
- G2: build·typecheck·test·CI 통과. 이후 스키마 변경은 리드 승인 절차로만

**PH3 세로 한 줄**
- 산출물: PoC 기준 출력(`tests/golden`: 기본 구성, UI 끔·개발자 2명·LiteLLM 구성), core 렌더러, `toZip`, 최소 화면(1단계 + 미리보기 + ZIP)
- G3: golden 일치, bash -n·shellcheck·bats 통과, 받은 ZIP으로 `setup.sh` → `create-worktrees.sh` → `run-agents.sh` → 신호 파일 1건이 review pane에 전달됨(가짜 claude로 확인)

**PH4 MVP 병렬 개발**
- 담당: dev1 core·templates(렌더러, 생성 스킬, 검사 스크립트) / dev2 exporter·bats·E2E(guard·check-forge·중계 시험) / dev3 web 6단계 화면
- 완료 조건: 각 작업이 개발별 검증 통과 후 develop 병합, 매일 통합 테스트 통과

**PH5 통합·실기 검증**
- 실기 점검: 환경 4종(macOS, Ubuntu, WSL, Dev Container) × 구성 3종(Claude 단일 / 제공자 혼용(vLLM·OpenRouter·LiteLLM) / 개발자 1명·UI 끔)
- 실제 Claude Code로 `/forge-init` → `/forge-agents` → `check-forge.sh` → 병렬 실행 1주기 완주
- 보안 점검: 셸 인자 이스케이프, 비밀 값 미저장, 외부 CDN 미사용, hook 우회(`../`, Bash 리다이렉션) → `docs/report-security.md`
- dogfooding: 완성된 앱으로 자기 개발 환경을 다시 생성해 교체
- G4: 점검표 12칸 통과, 보안 조치 완료

**PH6 확장 1 — 편집·다국어·배치**
- DOC-03 마커 구간 병합, PRV-03 모델 점검, RUN-04 tmux 배치 2종 추가, VSC-02 Dev Container, I18N-01 영어 UI·생성물

**PH7 확장 2 — 마켓·GitHub**
- MKT-01 소스 등록·색인·검색, MKT-02 미리보기·위험 검사·가져오기·sources.lock, EXP-02 GitHub·GHES 저장소 생성/PR
- 완료 조건: 위험 항목이 확인 없이 포함되지 않음, 푸시 결과의 실행 권한(100755) 유지

**PH8 상용화·베타**
- LIC-01 등급·서명 키, DPL-01 npx·Docker 설치형·웹 서비스
- G5: 베타 5명이 실제 프로젝트에 적용, 폐쇄망(외부 차단 VM) 설치 시험 통과

**PH9 출시 준비**
- 제품명·상표 확인, 가격, 약관·개인정보 처리방침(한·영), 오픈소스 고지, 사용자 문서, 배포 파이프라인
- G6: PH5 점검 재실시 통과, 미결 사항(9장) 해소

### 10.3 단계 운영 규칙
- 한 단계 안에서는 그 단계의 기능 ID만 tasks.md에 올린다. 다음 단계 작업은 단계 전환 후 분할한다.
- 단계를 넘어갈 때마다: 게이트 확인 → "현재 단계" 갱신 → 태그 → `docs/report.md`에 단계 결과 요약.
- 앞 단계로 돌아가야 하는 결함(스키마·생성 규칙 오류)은 ADR로 기록하고 리드가 처리한 뒤 다시 진행한다.
