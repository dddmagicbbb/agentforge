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
