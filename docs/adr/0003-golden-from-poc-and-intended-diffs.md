# ADR-0003 golden 기준 = PoC 실행 결과, 의도적 차이는 목록으로 관리

- 상태: 승인 (G1, 2026-10-28)
- 날짜: 2026-10-28
- 관련: PRD 10.2 PH3(golden 일치), design.md 6장(D1~D8)

## 맥락
PoC는 "동작 기준 구현"이지만 보안·호환 결함(D5 미인용, D6 URL source, D7 GNU 전용 명령 등)이 있다. golden을 PoC와 무조건 같게 하면 결함을 굳히고, 무시하면 기준이 흐려진다.

## 결정
1. golden은 `tools/poc-golden.mjs`가 `docs/reference/poc.html`의 `const STATIC`과 `/*GEN-START*/ … /*GEN-END*/` 구간을 Node `vm`에서 실행해 만든다. 입력은 `tests/golden/<구성>/input.json`(PoC `S` 형식).
2. core 출력과 golden 비교는 `tests/golden/intended-diffs.ts`에 등록한 차이만 허용한다. 항목마다 결함 ID(D5 등), 파일, 변환 함수(예: 모델 ID에 `shQuote` 적용)를 적는다.
3. 차이 목록 추가·삭제는 리드 승인 + 이 ADR의 "차이 목록" 갱신으로만 한다.
4. 정적 스크립트(templates/static) 수정(D2·D7)은 별도 ADR을 쓰고 bash -n·shellcheck·bats·모의 실행을 다시 통과해야 한다.

## 차이 목록 (초기)
| 결함 | 파일 | 변환 |
| --- | --- | --- |
| D5 | scripts/agent-env.sh | case 줄의 모델 인자를 `shQuote` |
| D6 | .agentforge/env.local.example | `OLLAMA_URL`·`VLLM_URL` 값을 `shQuote` |

## 결과
- PoC를 고쳐야 할 결함이 생기면 PoC 자체는 수정하지 않는다(참조 문서 고정). 차이 목록이 PoC와 제품의 경계를 기록한다.
