# 설치·배포 안내 (DPL-01, PH8)

AgentForge는 세 가지 방식으로 실행할 수 있다. 어느 방식이든 앱은 AI를 호출하지 않는다. 마켓 색인 외에는 외부 접속도 하지 않는다.

| 방식 | 대상 | 외부 접속 |
| --- | --- | --- |
| npx(로컬) | 개인 개발자 | 설치할 때만(npm). 실행 중에는 없음 |
| Docker(설치형) | 폐쇄망·사내 서버 | 없음. 이미지는 반입한다 |
| 웹 정적 호스팅 | 팀 공용 화면 | 없음(마켓·라이선스 서버 기능은 빠짐) |

## 1. npx (로컬)
```bash
npx agentforge            # http://127.0.0.1:3456
npx agentforge --port 4000 --license-file ./agentforge.license
```
| 옵션 | 기본값 | 환경 변수 | 설명 |
| --- | --- | --- | --- |
| `--port` | 3456 | `AF_PORT` | 접속 포트 |
| `--host` | 127.0.0.1 | `AF_HOST` | 바인드 주소. 다른 PC에서 접속해야 할 때만 바꾼다 |
| `--data` | `~/.agentforge/data` | `AF_MARKET_DATA` | 마켓 소스·색인 저장 폴더 |
| `--license-file` | 없음 | `AF_LICENSE`(키 문자열) | 라이선스 키 |
| `--admin` | 꺼짐 | 없음 | 마켓 소스 등록·삭제·갱신 API를 켠다. 인자로만 켤 수 있다 |

- npm 공개 배포 여부와 패키지 이름 확정(`agentforge`)은 출시 준비(PH9)에서 결정한다. 그 전에는 저장소에서 빌드해 실행한다.
  ```bash
  # v0.9.0 전까지 라이선스·npx 진입점(packages/app)은 develop 에만 있다(main 은 v0.3.0)
  git clone -b develop https://github.com/dddmagicbbb/agentforge && cd agentforge
  corepack enable pnpm          # pnpm 이 없을 때. 권한 오류면 npm i -g pnpm@10
  pnpm install --frozen-lockfile && pnpm build
  node packages/app/dist/cli.js --license-file ~/agentforge.license
  ```

## 2. Docker (설치형·폐쇄망)
### 빌드와 반입
```bash
# 인터넷이 되는 PC에서
docker build -t agentforge:0.9.0 .
docker save agentforge:0.9.0 -o agentforge-0.9.0.tar
# 폐쇄망 서버로 파일 반입 후
docker load -i agentforge-0.9.0.tar
```

### 실행
```bash
docker run -d --name agentforge \
  -p 127.0.0.1:3456:3456 \
  -v agentforge-data:/data \
  -e AF_MARKET_HOSTS=agentforge.internal.example \
  agentforge:0.9.0
```
- 컨테이너는 비루트 사용자(`af`)로 실행된다. 컨테이너 안에서만 0.0.0.0에 바인드하고, **외부 노출 범위는 `-p`로 정한다.** 기본 권장은 `127.0.0.1:` 바인드다. 사내망에 열려면 리버스 프록시를 앞에 둔다.
- `AF_MARKET_HOSTS`: 브라우저가 접속하는 호스트 이름(쉼표 목록)이다. 목록에 없는 Host 헤더는 403 `HOST_DENIED`로 거부한다(DNS rebinding 방지). localhost·127.0.0.1은 기본 허용이다.
- 마켓 관리 API는 기본으로 꺼져 있다. 운영자만 쓰는 인스턴스에서 필요할 때만 `docker run … agentforge:0.9.0 --admin`으로 켠다. **관리 API를 켠 컨테이너는 신뢰할 수 있는 망에만 노출한다**(소스 등록은 서버가 주소로 접속하는 기능이다).
- 상태 확인: `HEALTHCHECK`가 `/api/market/health`를 본다(`docker ps`의 STATUS).

### 폐쇄망에서 마켓 쓰기
- 외부 저장소(github.com)는 쓸 수 없다. 사내 Git(`https://`, 토큰은 `AF_MARKET_TOKEN_*` 환경 변수 이름으로 참조)이나, 서버에 반입한 저장소를 소스로 등록한다.
- 반입 저장소는 볼륨으로 넣고 `file://` 소스로 등록한다. 이때 `AF_ALLOW_FILE_SOURCES=1`과 `--admin`이 필요하다.

### 검증된 시험
- CI의 `airgap-docker` job(`tests/scripts/airgap-check.sh`)이 매 커밋마다 확인한다. 순서는 이미지 빌드 → 외부 차단 네트워크(`--internal`) 안에서 화면·health 확인 → `file://` 마켓 색인 → 외부 연결 실패 확인이다.

## 3. 웹 정적 호스팅
```bash
pnpm build      # packages/web/dist 생성
```
- `packages/web/dist`를 정적 호스팅(사내 웹 서버, 오브젝트 스토리지 등)에 올린다. 외부 CDN을 쓰지 않으므로 폐쇄망 웹 서버에도 그대로 올릴 수 있다.
- 서버가 없으므로 마켓은 비활성 안내만 보인다. 라이선스는 화면의 "라이선스 키 입력"으로 그 세션에서만 적용한다(저장하지 않음).
- 실제 호스팅 선택(도메인, 인증서)은 출시 준비(PH9)에서 결정한다.

## 4. 라이선스 적용 (LIC-01)
| 등급 | 개발자 수 상한 |
| --- | --- |
| 라이선스 없음·Free | 2 |
| Pro | 6 |
| Team | 6(조직 라이선스, seats 표시) |

- 키 형식: `AF1.<payload>.<서명>`. 오프라인 Ed25519 서명 검증이라 라이선스 서버 접속이 필요 없다.
- 적용 방법:
  - npx: `--license-file <파일>` 또는 환경 변수 `AF_LICENSE`
  - Docker: `-e AF_LICENSE=<키>` 또는 볼륨의 `/data/license.key`
  - 웹 단독: 화면 상단 등급 배지 옆 "라이선스 키 입력"(새로 고침하면 Free)
- 서버가 라이선스를 판정하는 설치형(npx·Docker)에서는 화면의 키 입력 버튼이 숨겨진다. 라이선스는 서버 쪽에 넣는다.
- 만료일은 서버 UTC 날짜 기준이다(웹 단독일 때는 브라우저 날짜).
- 한계: 공개 저장소의 오프라인 검증이므로 코드를 고치면 우회할 수 있다. 라이선스는 정직한 사용자를 위한 장치다(ADR-0008).

## 5. 라이선스 발급 (운영자)
```bash
node tools/license-issue.mjs --kid af-2026-1 --tier pro --licensee "회사명" --seats 5 --expires 2027-12-31
```
- 서명용 비밀 키는 발급 담당자 PC의 `~/.agentforge/license-signing/af-2026-1.pem`에만 있다. 저장소에 넣지 않으며 별도 백업 대상이다.
- 키를 교체할 때는 `tools/license-keygen.mjs <새 kid>`로 키 쌍을 만들고, 공개 키를 core `LICENSE_PUBLIC_KEYS`에 **추가**한 버전을 배포한다. 기존 kid는 남겨 이미 발급한 키가 계속 동작하게 한다.
- **릴리스 주의**: 운영 npx 패키지와 운영 이미지는 반드시 기본 빌드(`AF_TEST_BUILD` 미설정 또는 0)로 만든다. `AF_TEST_BUILD=1` 빌드는 시험 전용이다.
