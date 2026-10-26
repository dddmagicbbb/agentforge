#!/usr/bin/env bash
# Claude Code 작업 시작 전(세션 시작·프롬프트 제출) 원격 변경을 pull 한다.
# 실패해도 작업을 막지 않고 경고만 출력한다.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1 || exit 0   # upstream 없는 브랜치는 건너뜀
if ! out=$(GIT_TERMINAL_PROMPT=0 git pull --rebase --autostash 2>&1); then
  echo "[git-pull] pull 실패 — 충돌·네트워크 상태를 먼저 확인하세요: $out" >&2
  exit 0
fi
case "$out" in *"up to date"*|*"최신"*) ;; *) echo "[git-pull] $out" ;; esac
exit 0
