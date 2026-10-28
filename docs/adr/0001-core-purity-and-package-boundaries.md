# ADR-0001 core 순수성과 패키지 경계

- 상태: 제안 (G1 승인 대상)
- 날짜: 2026-10-28
- 관련: project-rules "아키텍처 규칙", PRD 7장 성능(미리보기 100ms)

## 맥락
렌더 결과는 브라우저 미리보기, ZIP, GitHub 푸시, golden 테스트에서 똑같아야 한다. 템플릿 원본(`templates/`)은 파일이지만 core는 I/O를 할 수 없다.

## 결정
1. 의존 방향: `web`, `exporter`, `server` → `core`. core는 다른 패키지를 import하지 않는다.
2. core는 fs·네트워크·`Date`·`Math.random`·환경 변수를 쓰지 않는다. lint 규칙(`no-restricted-imports`, `no-restricted-globals`)으로 강제한다.
3. 템플릿은 빌드 시 `templates/**`를 읽어 `packages/core/src/templates.generated.ts`(`Record<string, string>`)로 만든다. 생성 파일은 커밋하지 않고 `prebuild`·`pretest`에서 만든다.
4. exporter는 `RenderedFile[]`의 `content`와 `mode`를 바꾸지 않는다. ZIP과 GitHub 결과의 동일성은 테스트로 확인한다.

## 대안
| 대안 | 장점 | 단점 |
| --- | --- | --- |
| **빌드 시 codegen (채택)** | core 순수 유지, 번들러와 무관, Node·브라우저 동일 | 생성 단계 1개 추가 |
| Vite `?raw` import | 설정 간단 | core가 Vite에 묶이고 Node 테스트에서 별도 처리 필요 |
| 템플릿 로더 주입 `render(p, loader)` | 유연 | 호출부마다 로더 필요, 결정성 보장 책임 분산 |

## 결과
- `pnpm --filter @agentforge/core test`가 codegen을 선행한다(PH2 C-02).
- 템플릿 변경 시 golden·스냅샷이 함께 바뀌므로 리뷰에서 바로 보인다.
