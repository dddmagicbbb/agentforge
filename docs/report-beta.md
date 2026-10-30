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
