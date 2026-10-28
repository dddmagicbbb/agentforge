# dev-1 상세 설계 (core)

> 1라운드(T-301~T-308) 설계는 develop 이력(PH3 커밋)에 있다. 이 문서는 2라운드 범위를 다룬다.

## 2라운드: T-402, T-406 + core 공개 export 보강

### 1. 담당 작업·기능 ID
| 작업 | 기능 ID | 내용 |
|---|---|---|
| T-402 | SKL-01, SKL-02 | 생성 SKILL.md 형식·배정 시험, 토글 4조합 정합 |
| T-406 | RUN-03, VSC-01 | integrate.sh·tasks.json 렌더 시험, 대표 구성 6종 스냅샷 |
| (보강) | - | web 사본 제거용 공개 export |

### 2. 파일 목록 (모두 `packages/core/` 안, `templates/**` 불변, `schema/` 불변)
| 경로 | 책임 |
|---|---|
| `packages/core/src/index.ts` | `PROVIDERS`·`provider`·`ProviderDef`, `SEQ`·`FINAL`·`SeqStep`, `CORE_SKILLS`·`CoreSkill`, `devSkill`, `label`, `fmModel`, `IMPORT_TARGET_LABEL`, `seqI18nKey` export |
| `packages/core/src/render/context.ts` | `seqI18nKey()` 추가 |
| `packages/core/test/fixtures.ts` | 시험용 구성 빌더(공용) |
| `packages/core/test/skills.test.ts` | T-402 시험 |
| `packages/core/test/run-vscode.test.ts` | T-406 integrate.sh·tasks.json 시험 |
| `packages/core/test/snapshots.test.ts` + `__snapshots__/` | T-406 대표 구성 6종 스냅샷 |

### 3. 주요 함수
- `seqI18nKey(id: SeqAgentIdT, field: "out" | "gate"): string` -> `seq.<id>.<out|gate>`.
  화면의 단계별 산출물·관문 문장은 core에 두지 않는다(project-rules: 문장은 web). core는 키 규칙만 제공하고 web의 i18n 사전이 문장을 가진다.
  `SeqStep.step`(한국어 단계명)은 생성물(CLAUDE.md 표)에 들어가는 값이므로 core에 남는다.
- 그 외는 기존 심볼의 재export. 동작 변경 없음. 신규 오류 처리 없음.

### 4. 사용하는 계약
외부 API 없음. 공개 API(design.md 3장)에 export만 추가하고 기존 시그니처는 바꾸지 않는다.

### 5. 화면 상태
해당 없음(core).

### 6. 테스트 목록
| 기능 ID | 수용 기준 | 테스트 이름 |
|---|---|---|
| SKL-01 | 모든 SKILL.md가 `---` 블록, name=폴더명, description 비지 않음 | `SKILL.md frontmatter 형식` |
| SKL-01 | forge-init·forge-agents만 disable-model-invocation: true | `생성 스킬 2종은 모델 호출 비활성` |
| SKL-01 | conventions·tdd 4조합에서 파일 유무와 dev/review/common-dev skills 목록 정합 | `토글 조합 x skills 목록` |
| SKL-01 | 고정 스킬 4종은 항상 생성 | `고정 스킬 4종` |
| SKL-02 | `devN-<domain>`은 dev-N·review-N에만 배정 | `devN 스킬 배정 범위` |
| SKL-02 | imported target all/dev/review 배정 | `imported target 배정` |
| 보강 | 공개 export 노출, seqI18nKey 규칙 | `공개 export` |
| RUN-03 | integrate.sh 755, 정적 원문과 동일 | `integrate.sh 렌더` |
| VSC-01 | tasks.json 유효 JSON, 6작업, 입력과 무관 | `tasks.json 렌더` |
| T-406 | 6종 구성 스냅샷(파일 목록·권한·sha256) | `구성 스냅샷` |

### 7. 계약·공통 모듈에 필요한 변경
없음. `schema/`·`templates/**` 변경 없음.
