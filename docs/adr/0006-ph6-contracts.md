# ADR-0006 PH6 계약: CLAUDE.md 병합, tmux 배치, 모델 점검, Dev Container, 다국어, 보안 후속

- 상태: 승인 (리드, 2026-10-29) — PH6 착수 전, 상세는 design.md 8장
- 관련: PRD DOC-03·RUN-04·PRV-03·VSC-02·I18N-01, report-security S-3·S-4, ADR-0004·0005

## 맥락
PH6 기능은 PoC(`poc.html`)에 기준 구현이 없다. dev-1(core·템플릿), dev-2(시험), dev-3(화면)이 병렬로 작업하려면 스크립트 동작·파일 형식·오류 코드를 먼저 고정해야 한다. 또 PH5 보안 점검에서 PH6 후보로 남긴 S-3·S-4를 처리한다.

## 결정
1. **기본값 불변**: `tmux`·`devcontainer` 미지정, `language: "ko"`이면 생성물은 PH5와 바이트 단위로 같다. golden·스냅샷 6구성은 바뀌지 않는다.
   - 예외: 8.3 모델 점검과 8.6 보안 후속은 모든 구성에 들어가므로, 의도적 차이로 등록한다.
2. **CLAUDE.md 병합(DOC-03)**: old를 뼈대로 하고, 생성 구간 3개(AGENTS·DEVS·SKILLS)만 교체한다. PROJECT 구간은 보존하고, 빠진 구간은 끝에 붙인다. 마커 짝 오류는 `CLAUDE_MD_MARKERS`.
3. **tmux 배치(RUN-04)**:
   - `run-agents.sh` 하나가 config의 배치(pair·grid·role)를 읽는다. 모든 배치에서 pane 기록 형식이 같아 `wait-and-review.sh`는 바꾸지 않는다.
   - 접두키·마우스는 세션 범위로만 설정한다.
4. **모델 점검(PRV-03)**:
   - `claude -p --output-format json`의 `result`·`num_turns`·`is_error`로 응답과 도구 호출을 판정한다. 실제 토큰을 쓰므로 사용자가 직접 실행한다.
   - 시험은 가짜 claude가 JSON을 내는 방식으로 한다.
5. **Dev Container(VSC-02)**:
   - 표준 `javascript-node:22` 이미지에 `postCreateCommand`로 tmux·jq·claude를 설치한다.
   - 이미지 다운로드는 사용자 환경 행위이고, 앱은 여전히 외부를 호출하지 않는다.
6. **다국어(I18N-01)**:
   - 화면은 en 리소스와 키·변수 동등 CI 검사를 둔다.
   - 생성물은 `templates/md-en/`으로 영어판을 둔다.
   - 정적 스크립트 출력 문구의 영어화는 범위 밖이다(P2 후보). 9종 스크립트의 문구를 바꾸면 bats 문구 검사 전체가 흔들리므로, 별도 단계에서 메시지 카탈로그로 분리하는 편이 낫다.
7. **보안 후속**:
   - S-3: 생성 settings.json에 `defaultMode: "default"`를 넣어 pane을 기본 권한 모드로 시작한다.
   - S-4: `integrate.sh`가 feature 브랜치에 검토 파일이 커밋되어 있는지 확인한 뒤에만 병합한다.

## 결과
- 개발자별 계약 시험:
  - dev-1: core 단위·fast-check·스냅샷
  - dev-2: bats·CI·E2E
  - dev-3: web 단위
- dev-2의 bats는 이 문서와 design.md 8장의 동작 계약을 기준으로 먼저 쓴다. dev-1의 템플릿이 develop에 들어오기 전에는 실패하는 상태가 정상이다(TDD).
