# batch-hub — AgentForge 개발 환경

요구사항: .agentforge/requirements.md · 설정: .agentforge/forge.config.json

## 루틴
기획 → 분석 → 시스템 설계 → 공통 개발 → [상세 설계 + 개발](병렬) → 개발 검증(병렬) → 통합 검증

## 실행 순서 (WSL Ubuntu 또는 Linux·macOS 터미널)
1. `bash scripts/setup.sh                     # 도구 확인, 실행 권한, env.local, 첫 커밋`
2. `claude                                    # 처음 한 번 직접 로그인`
3. `bash scripts/run-role.sh planner          # 세션에서 /forge-init → PRD 검토·승인`
4. `bash scripts/run-role.sh analyst "docs/prd.md 를 분석해 analysis.md 와 tasks.md 를 작성하세요"`
5. `bash scripts/run-role.sh architect "시스템 설계를 작성하세요"`
6. `git checkout -b develop && bash scripts/run-role.sh common-dev "docs/tasks.md 의 common 작업을 진행하세요"`
7. `claude                                    # 리드 세션에서 /forge-agents → bash scripts/check-forge.sh → 커밋`
8. `bash scripts/create-worktrees.sh && bash scripts/run-agents.sh && tmux attach -t batch-hub`
9. `bash scripts/integrate.sh                 # 전원 통과 후`

단계가 끝날 때마다 사람이 관문을 확인하고 커밋한다. 단계 전환은 사람이 한다.
