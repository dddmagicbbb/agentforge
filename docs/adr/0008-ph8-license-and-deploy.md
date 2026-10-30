# ADR-0008 PH8 계약: 라이선스(오프라인 서명 검증)와 배포(npx·Docker·웹)

- 상태: 승인 (리드, 2026-10-30) — PH8 착수 전, 상세는 design.md 10장
- 관련: PRD LIC-01·DPL-01, G5, 제품 원칙(외부 접속 없는 설치형, 인증 정보 미취급), ADR-0007

## 맥락
- 상용화하려면 등급(Free 2명·Pro 6명·Team)을 강제해야 한다. 그런데 폐쇄망 고객은 라이선스 서버에 접속할 수 없으므로 **오프라인 검증**이 필요하다.
- 저장소는 2026-10-30부터 공개 상태라, 검증 코드와 공개 키는 누구나 볼 수 있다. 서명용 비밀 키는 저장소 밖에만 둔다.
- 배포는 세 경로가 필요하다.
  - 개인: npx
  - 폐쇄망 기업: Docker. 외부 접속 없이 동작해야 한다.
  - 웹 서비스: 정적 호스팅

## 결정
1. **라이선스 키 형식**: `AF1.<base64url(payload JSON)>.<base64url(Ed25519 서명)>`
   - payload: `{ v: 1, kid, id, tier: "free"|"pro"|"team", licensee, seats, issued: "YYYY-MM-DD", expires: "YYYY-MM-DD"|null }`
   - 서명 대상: `AF1.<payload>` 바이트
   - Ed25519 구현은 `@noble/curves`(MIT, 순수 JS, 감사됨)를 core 의존성으로 추가한다. 이 정도 암호 구현은 직접 짜지 않는다.
2. **core는 순수성을 유지한다**:
   - `verifyLicense(key, { today, publicKeys })`는 날짜를 인자로 받는다. core는 `Date`를 쓰지 않는다.
   - 공개 키는 core 상수 `LICENSE_PUBLIC_KEYS`(kid → 키)로 둔다. 키를 교체할 때는 kid를 추가한다.
   - 결과:
     - `{ ok: true, tier, licensee, seats, expires }`
     - `{ ok: false, code }`. code는 `LICENSE_FORMAT`·`LICENSE_SIGNATURE`·`LICENSE_EXPIRED`·`LICENSE_UNKNOWN_KID` 중 하나다.
3. **등급 강제**:

   | 등급 | developerCount 상한 | 비고 |
   | --- | --- | --- |
   | 라이선스 없음 | 2 | Free와 같다 |
   | Free | 2 | |
   | Pro | 6 | |
   | Team | 6 | seats(사용 인원)를 표시하고 조직 라이선스로 쓴다. PH8에서는 기능 차이 없음 |

   - 강제 위치는 `checks()`의 error `LICENSE_LIMIT`{ tier, max }다. 이 오류가 있으면 생성(ZIP·GitHub)을 막는다.
   - 라이선스는 `ProjectInput`이 아니라 `checks`·`canExport`의 별도 인자(`license` 결과)로 받는다. 그래야 생성물에 라이선스가 섞이지 않는다.
4. **비밀 키**:
   - 생성·서명 도구는 `tools/license-keygen.mjs`·`tools/license-issue.mjs`(리드)다.
   - 비밀 키는 저장소 밖(기본 `~/.agentforge/license-signing/`)에 둔다. `.gitignore`에 `*.pem`·`license-private*`를 추가한다.
   - CI에서는 시험용 키 쌍을 실행 중에 만들어 쓴다. 시험 공개 키는 `publicKeys` 인자로 주입한다.
5. **라이선스 전달**:
   - 설치형(npx·Docker): 서버가 `AF_LICENSE`(환경 변수) 또는 `dataDir/license.key`를 읽어 오늘 날짜로 검증한다. 결과(`tier`·`licensee`·`expires`·`code`)만 `GET /api/license`로 준다. 키 원문은 응답하지 않는다.
   - 웹 단독(서버 없음): 화면에서 키를 붙여 넣으면 그 세션 메모리에서만 검증한다. 저장하지 않는다(비밀 값 미저장 규칙과 같은 취급).
6. **배포**:
   - npx: 새 패키지 `packages/app`(이름 `agentforge`, bin `agentforge`)
     - 서버 dist와 web dist를 함께 묶고, `127.0.0.1:3456`(`--port`)에서 web과 마켓 API를 제공한다.
     - 브라우저는 열지 않고 주소만 출력한다.
     - npm 공개 배포는 사람이 결정한다.
   - Docker: 루트 `Dockerfile`(multi-stage, `node:22-alpine` 런타임, 비루트 사용자, `/data` 볼륨, `HEALTHCHECK`)
     - 런타임에는 외부 접속이 없다(마켓 기본 소스 복사도 오프라인).
     - 폐쇄망 시험: `docker network create --internal`에서 기동한 뒤, 같은 네트워크의 다른 컨테이너에서 health·web·license·`file://` 마켓을 확인한다. 외부 연결 시도가 실패해도 기능이 동작해야 한다.
   - 웹 서비스: `packages/web/dist` 정적 호스팅 안내(`docs/deploy.md`)만 둔다. 실제 호스팅 선택은 사람이 한다.
7. **G5의 사람 몫**: 베타 5명 적용과 폐쇄망 VM 시험은 사람이 수행한다. 리드는 점검표(`docs/report-beta.md`)와 설치 문서를 준비한다.

## 결과
- 가격 정책은 PRD 9장에 미결로 남긴다. PH8은 등급 **강제**만 구현하고 결제는 없다.
- 공개 저장소이므로 검증 우회(코드 수정)는 막을 수 없다. 오프라인 라이선스는 정직한 사용자를 위한 장치다. 이 한계를 문서에 적는다.
