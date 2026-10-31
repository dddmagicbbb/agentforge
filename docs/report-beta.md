# 베타·폐쇄망 점검표 (PH8 G5)

> G5 조건(PRD 10.2):
> - 베타 사용자 5명이 실제 프로젝트에 적용
> - 폐쇄망(외부 차단 VM)에서 설치 시험 통과
>
> 이 표는 사람이 채운다. 리드는 결과를 `docs/report.md` PH8 절에 요약한다.

## 1. 베타 사용자 (5명)
| # | 사용자(역할) | 설치 방식 | 프로젝트 성격 | 구성(개발자 수·제공자) | 결과 | 주요 의견 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | | npx / Docker / 웹 | | | ☐ | |
| 2 | | | | | ☐ | |
| 3 | | | | | ☐ | |
| 4 | | | | | ☐ | |
| 5 | | | | | ☐ | |

사용자마다 확인할 것("결과" ✓ 조건):
- [ ] 6단계까지 진행해 ZIP(또는 GitHub)으로 받음
- [ ] `bash scripts/setup.sh` → `/forge-init`(PRD 작성) → analyst(tasks.md) → `check-forge.sh` 통과
- [ ] `run-agents.sh`로 병렬 실행 1주기 완주(설계 → 검토 → 구현 → 검토 → `integrate.sh`)
- [ ] 막힌 곳·헷갈린 문구 기록(화면 문구는 ko·en 중 사용한 언어)
- [ ] 라이선스 적용 확인(해당자: Pro 키로 개발자 3명 이상)

## 2. 폐쇄망 VM 설치 시험
CI의 `airgap-docker`는 Docker 내부 네트워크로 흉내 낸 것이다. 실제 사내 환경에 가까운 VM에서 한 번 확인한다.

| 단계 | 방법 | 결과 |
| --- | --- | --- |
| VM 준비 | 외부 인터넷이 차단된 VM(아웃바운드 차단 방화벽). Docker 설치 | ☐ |
| 반입 | 인터넷 PC에서 `docker save` → 파일 반입 → `docker load`(docs/deploy.md 2장) | ☐ |
| 기동 | `docker run … -p 127.0.0.1:3456:3456 -v agentforge-data:/data` → `docker ps` healthy | ☐ |
| 화면 | VM 브라우저로 `http://127.0.0.1:3456` 접속. 폰트·화면이 깨지지 않음(외부 CDN 없음) | ☐ |
| 생성 | 6단계까지 진행해 ZIP 다운로드 → VM 안에서 `setup.sh`·`check-forge.sh` 통과 | ☐ |
| 라이선스 | `-e AF_LICENSE=<Pro 키>`로 재기동 → 화면 배지 Pro, 개발자 3명 이상 ZIP 가능 | ☐ |
| 마켓 | 반입한 스킬 저장소를 볼륨으로 넣고 `--admin`·`AF_ALLOW_FILE_SOURCES=1`로 `file://` 소스 등록 → 색인·검색·가져오기 | ☐ |
| 생성 환경 | 사내 vLLM 또는 Ollama 주소로 구성 → `check-models.sh` 통과/경고 판정 | ☐ |
| 외부 접속 없음 | 실행 중 방화벽 로그에 외부 연결 시도가 없음 | ☐ |

## 3. 판정
- G5 통과 조건: 1장 5명 모두 ✓(또는 사유가 기록된 부분 통과를 사람이 승인), 2장 전 단계 ✓
- 나온 결함은 이슈로 기록하고 PH9 전에 처리한다.

## 4. 발급한 베타 라이선스 (2026-10-30)
- Pro 5개, licensee `AgentForge Beta 1~5`, seats 1, 만료 2027-01-31, kid `af-2026-1`. 5개 모두 core `verifyLicense`로 확인했다.
- 키 원문은 저장소에 넣지 않는다. 발급 담당자 PC의 `~/.agentforge/beta-licenses.txt`(현재 사용자만 읽기)에서 사용자에게 개별 전달한다.
- 적용: npx는 `--license-file`, Docker는 `-e AF_LICENSE=`(docs/deploy.md 4장).

## 5. 리드 사전 시험 (2026-10-30)
> 사람 시험 전에 결함을 거르는 용도다. **G5 조건(베타 5명·실제 VM)을 대신하지 않는다.**

### 5.1 베타 사전 시험 (WSL Ubuntu, 베타 1번 키)
- 경로: GitHub clone → 설치·빌드 → `--license-file` 기동 → 화면 6단계(실제 브라우저) → ZIP → setup → `/forge-init` → analyst → architect → common-dev → `check-forge.sh` → `run-agents.sh`(3명, Claude sonnet) → `integrate.sh`
- 프로젝트: `beta-memo`(TypeScript 메모 CLI, 개발자 3명 model·store·cli). Pro 키로 개발자 3명 구성이 허용됐다.
- 결과: 전원 통과. 통합 후 develop에서 테스트 171건이 통과했고, 실제 실행도 PRD와 일치했다(추가·목록·태그 AND·상세·삭제, 종료 코드 1/2, id 재사용 없음, 원자적 쓰기).
- 사람 개입(시험자가 사용자 대신 한 것):
  - 신뢰 대화상자 수락(프로젝트·worktree 4곳)
  - 대화형 승인 35건. 감독 스크립트로 처리했고 거부는 0건이다.
  - 리드 병합 2회(B-5)

### 5.2 폐쇄망 사전 시험 (Docker Desktop, 운영 기본 빌드, 베타 2번 키)
| 단계 | 결과 |
| --- | --- |
| 반입 | `docker save`(69MB) → 이미지 삭제 → `docker load` ✓ |
| 기동 | `--internal` 네트워크, 비루트(`af`), healthy ✓. 외부 HTTPS·DNS 모두 실패(차단) ✓ |
| 화면 | 브라우저 요청 22건 모두 로컬, 외부 0건. 웹 폰트 없음(시스템 글꼴) ✓ |
| 라이선스 | 운영 이미지 + 실제 베타 키 → Pro·licensee 표시 ✓ |
| 마켓 | 화면에서 `file://` 소스 등록 → 갱신 → 검색 → 위험 표시 → 확인 전 ZIP 차단 → 확인 후 ZIP ✓. `sources.lock`의 출처·커밋·플래그 ✓, 가져온 스크립트 644 ✓ |
| 생성 | `--network none` 컨테이너(도구 사전 설치)에서 `setup.sh`·`check-forge.sh` 통과 ✓ |
| 생성 환경 | **미실시.** `check-models.sh`는 실제 모델 호출이 필요하다 → 사람 VM 시험에서 사내 vLLM·Ollama로 확인 |
| 외부 접속 없음 | 컨테이너 차단 확인 ✓. 실제 방화벽 로그 확인은 사람 VM 시험 몫 |

### 5.3 발견 사항
| ID | 심각도 | 내용 | 조치 |
| --- | --- | --- | --- |
| B-1 | 높음 | 기본 브랜치 main은 v0.3.0이라, 안내대로 clone하면 라이선스·npx 진입점이 없다 | `deploy.md` 1장에 `-b develop` 명시(v0.9.0 병합 후 해소) |
| B-2 | 중간 | pnpm 설치 안내가 없다. `corepack pnpm`만으로는 빌드 스크립트 안의 `pnpm` 호출이 실패한다 | `deploy.md` 1장에 `corepack enable pnpm` 추가 |
| B-6 | **높음** | 기본 권한 모드에서 신호 파일 생성 `touch "$AF_SIGNALS/…"` 12건이 **전부** 승인을 요구했다. 변수가 든 명령은 허용 목록과 무관하게 확인 창이 뜬다. 병렬 흐름의 핵심 동작마다 사람이 pane 6개를 지켜봐야 한다. 승인 35건 중 변수 18·`cd` 복합 24·heredoc 쓰기 14건(중복 포함) | **ADR-0009 처리(T-891)**: `scripts/signal.sh`(자기 번호·역할 신호만)를 허용 목록에 넣고 `touch` 허용 제거. 명령 실행 지침 추가 |
| B-5 | 높음 | 개발자 간 코드 의존(dev-3 → dev-1)을 병렬 단계 안에서 풀 절차가 없다. dev-3는 테스트가 실패해 멈췄다. 리드가 feature/dev1을 dev3에 병합하자 범위 검사가 dev-1 파일 15개를 **범위 밖**으로 오판했다. 리드가 통과한 dev-1을 develop에 먼저 병합해 풀었다 | **ADR-0009 처리(T-891)**: `dev-N.wait-M` 신호 → 감시 창 안내 → 사람이 `scripts/sync-dev.sh M N` 실행. analyst 지침에 의존 처리 추가 |
| B-9 | 중간 | 검토자가 리뷰 파일을 Write 대신 Bash heredoc(`cat > docs/review/… <<EOF`)으로 쓴다. Edit·Write용 guard hook을 거치지 않는다(S-3 Bash 범위 검사 후속 과제의 실사례) | ADR-0009 지침으로 줄임. 강제는 S-3 후속 과제 |
| B-7 | 낮음 | 폐쇄망에서 기본 소스 `anthropic-skills`(GitHub)가 매번 "가져오지 못했습니다"만 표시하고 사유가 없다 | 사유 코드 표시, 또는 `deploy.md`에 "폐쇄망은 기본 소스 삭제" 안내 |
| B-8 | 낮음 | `noexec` 마운트(보안을 강화한 서버의 `/tmp` 등)에 풀면 `check-forge.sh`가 "실행 권한 없음(chmod +x)"으로 원인을 잘못 짚는다 | 안내 문구에 noexec 가능성 추가 |
| B-3 | 낮음 | `/favicon.ico` 404(콘솔 오류 1건) | 아이콘 추가 |
| B-4 | 참고 | `claude -p` 비대화식 실행은 신뢰 대화상자를 건너뛰어 allow 목록이 무시된다. README의 "처음 한 번 `claude`" 절차를 따르면 생기지 않는다 | 조치 없음 |
| B-10 | 중간 | `integrate.sh`는 병합 후 설치 명령 없이 테스트를 돈다. 메인 폴더에 의존성이 없거나 개발자가 worktree에서 의존성을 추가하면 통합 테스트가 `tsc: not found` 같은 이유로 실패한다(재실행에서 메인 폴더를 새로 clone해 확인) | **ADR-0009 보강 처리(T-892)**: 병합 뒤 `commands.install` 실행, 실패는 결과 "실패"로 보고 |

### 5.4 재실행 (ADR-0009 반영, 2026-10-31)
- 방법: 1차와 같은 입력으로 새로 생성한 파일(`signal.sh`·`sync-dev.sh`·지침)을 1차의 공통 개발 직후 상태(`6236ab1`)에 덮어쓰고, 병렬 단계부터 다시 실행했다(3명, Claude sonnet).
- 결과

| 항목 | 1차 | 재실행 |
| --- | --- | --- |
| 승인 창 | 35건 | **1건** (`node --test … \| grep` 파이프 1건) |
| 신호 생성 승인 | 12/12건 | 0건 (`signal.sh` 허용 목록) |
| `cd` 복합·heredoc 쓰기 승인 | 24·14건 | 0·0건 |
| 개발자 간 의존 | 수동 병합 2회, 범위 오판 15파일 | dev-3이 `dev-3.wait-1`·`wait-2` 신호 → 감시 창 안내 → `sync-dev.sh 1 3`·`2 3` → 범위 오판 없이 통과 |
| 결과 | 전원 통과 | 전원 통과(반려 0), `integrate.sh`가 dev-1·2를 "Already up to date"로 지나감 |

- 통합 테스트: B-10 때문에 처음에는 실패했다. 설치 후 통합본에서 테스트 147건이 통과했고 CLI 동작도 확인했다.
