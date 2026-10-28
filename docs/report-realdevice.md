# 실기 점검표 (PH5 T-501·T-502)

> G4 조건: 12칸 통과 + 실제 Claude Code 주기 완주 + 보안 조치 완료(`docs/report-security.md`).

## 1. 구성 3종 (`tests/realdevice/*.json`)
| 구성 | 입력 | 내용 |
| --- | --- | --- |
| A Claude 단일 | `claude-only.json` (`rd-claude`) | UI 켬, 개발자 3명, 전 에이전트 Claude |
| B 제공자 혼용 | `mixed.json` (`rd-mixed`) | vLLM·OpenRouter + LiteLLM 경유(Gemini dev-2, OpenAI planner) |
| C 개발자 1명·UI 끔 | `dev1-ui-off.json` (`rd-solo`) | ux-designer·dev-2 이상 없음 |

## 2. 자동 점검 (`tests/scripts/realdevice.bats`)
칸마다 다음을 끊김 없이 확인한다.
1. ZIP 생성, 실행 권한(.sh만 755)
2. `setup.sh`: env.local이 600 권한이고 커밋에 들어가지 않음
3. 더미 PRD·tasks로 `check-forge.sh` 통과
4. 전 에이전트 `agent-env.sh` 성공
5. `create-worktrees.sh`로 N개 worktree 생성
6. `run-agents.sh`(가짜 claude)로 dev·review 전원 기동
7. `design-1.done` 신호가 review-1 pane에 도착

| 환경 \ 구성 | A | B | C | 근거 |
| --- | --- | --- | --- | --- |
| Ubuntu (GitHub ubuntu-latest) | ✓ | ✓ | ✓ | CI run 40754097160 `build-test (ubuntu-latest)` |
| macOS (GitHub macos-latest, brew bash 5) | ✓ | ✓ | ✓ | CI run 40754097160 `build-test (macos-latest)` |
| Dev Container (`devcontainers/javascript-node:22`) | ✓ | ✓ | ✓ | CI run 40754097160 `realdevice-devcontainer` |
| WSL Ubuntu | ✓ | ✓ | ✓ | 사람 실행 2026-10-29: `realdevice.bats` 3/3, `pnpm test:scripts` 51/51(bash -n·shellcheck 0 포함) |

## 3. 사람 점검 (T-502)
### 3.1 WSL 칸
```bash
# WSL Ubuntu, 저장소 루트
sudo apt install -y jq shellcheck bats tmux unzip
pnpm install && pnpm build
bats tests/scripts/realdevice.bats      # 3건 ok 이면 WSL 3칸 ✓
pnpm test:scripts                       # 전체 bash -n·shellcheck·bats
```

### 3.2 실제 Claude Code 주기 (구성 A 또는 C 권장)
| ID | 단계 | 확인 | 결과 |
| --- | --- | --- | --- |
| R-1 | 앱에서 ZIP 생성 → 풀기 → `bash scripts/setup.sh` | "준비 완료" 출력, `.git` 첫 커밋 | ☐ |
| R-2 | `claude` 로그인 → `bash scripts/run-role.sh planner` → `/forge-init` | 질문 후 `docs/prd.md` 작성, 기능 ID 형식 `F-001` | ☐ |
| R-3 | analyst → `docs/tasks.md`, `/forge-agents`(개발자 정보 비움 구성일 때) | dev-N·review-N·paths·전용 스킬 생성, 미치환 `{{` 없음 | ☐ |
| R-4 | `bash scripts/check-forge.sh` | 7항목 통과 | ☐ |
| R-5 | `create-worktrees.sh` → `run-agents.sh` → 설계 → 검토 → 구현 → 검토 → `integrate.sh` | 신호 중계 1주기 완주, integrator 실행 | ☐ |
| R-6 | 보안 S-3: dev pane에서 `git commit -m x > ../out.txt`, `touch a && echo x > ../b` 요청 | 승인 프롬프트가 뜨거나 거부됨(자동 허용이면 S-3 갱신) | ☐ |
| R-7 | 보안 S-2: dev pane에서 범위 밖 `.ipynb` 수정 요청 | guard가 차단(exit 2 문구) | ☐ |
| R-8 | PRD 9장 미결: frontmatter `model` vs `ANTHROPIC_MODEL` 우선순위 | 비 Claude 에이전트(`model: inherit`)가 agent-env 모델로 실행됨을 `/status` 등으로 확인 | ☐ |

결과는 이 표에 ✓/✗와 메모로 남긴다. ✗는 `docs/report.md` PH5 절에 원인과 조치를 적는다.
