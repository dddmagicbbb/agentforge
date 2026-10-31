# bats 공용 도우미: 저장소 루트, 가짜 claude, 격리된 git 신원

REPO="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"

# 가짜 claude: 실행 인자와 표준입력으로 받은 줄을 $FAKE_CLAUDE_LOG 에 남긴다(모의 병렬 실행용)
make_fake_bin() {
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"; mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/claude" <<'SH'
#!/usr/bin/env bash
echo "${AF_AGENT:-?} start $*" >> "${FAKE_CLAUDE_LOG:-/dev/null}"
while IFS= read -r line; do echo "${AF_AGENT:-?} got: $line" >> "${FAKE_CLAUDE_LOG:-/dev/null}"; done
SH
  chmod +x "$FAKE_BIN/claude"
  export FAKE_CLAUDE_LOG="$BATS_TEST_TMPDIR/claude.log"; : > "$FAKE_CLAUDE_LOG"
  export PATH="$FAKE_BIN:$PATH"
}

# 사용자 git 설정과 분리
isolate_git() {
  export GIT_CONFIG_GLOBAL="$BATS_TEST_TMPDIR/gitconfig" GIT_CONFIG_NOSYSTEM=1
  git config --global user.name "af-test"; git config --global user.email "af-test@example.com"
  git config --global init.defaultBranch main
}

# golden 구성의 생성 파일을 임시 폴더로 복사(실행 권한 부여는 setup.sh 가 한다)
copy_golden() {  # copy_golden <구성> <대상>
  mkdir -p "$2"; cp -R "$REPO/tests/golden/$1/files/." "$2/"
  # golden 은 PoC 실행 결과라 ADR-0004 이전 스크립트다. 의도적 차이(intended-diffs.json diffs)로
  # 등록된 생성 파일은 현재 템플릿(= core render 결과)으로 덮어써 제품이 실제로 내보내는 내용을 시험한다.
  local p src
  while IFS= read -r p; do
    case "$p" in
      scripts/*.sh|.claude/hooks/*.sh) src="$REPO/templates/static/${p##*/}" ;;
      .claude/skills/*/SKILL.md) src="${p#.claude/skills/}"; src="$REPO/templates/md/${src%/SKILL.md}.md" ;;
      *) continue ;;
    esac
    if [ -f "$src" ] && [ -f "$2/$p" ]; then cp "$src" "$2/$p"; fi
  done < <(grep -o '"path": *"[^"]*"' "$REPO/tests/golden/intended-diffs.json" | sed 's/.*"\([^"]*\)"$/\1/')
  return 0  # 마지막 경로가 이 구성에 없어도 실패로 끝나지 않게(review-2 권고 2)
}

need_tools() {
  local t; for t in "$@"; do command -v "$t" >/dev/null || skip "$t 없음"; done
}

wait_for() {  # wait_for <초> <grep 패턴> <파일>
  local i; for ((i = 0; i < $1 * 2; i++)); do grep -q -- "$2" "$3" 2>/dev/null && return 0; sleep 0.5; done
  echo "시간 초과: '$2' ($3)"; cat "$3" 2>/dev/null; return 1
}

# bash 4 이상(mapfile)이 아니면 건너뜀 — macOS 기본 bash 3.2 에서는 check-forge.sh 가 동작하지 않음
need_bash4() {
  bash -c 'mapfile -t _a < /dev/null' 2>/dev/null || skip "bash 4 이상(mapfile) 필요"
}

# core·exporter 빌드 산출물이 없으면 건너뜀(ZIP 을 만드는 시험용)
need_build() {
  [ -f "$REPO/packages/core/dist/index.js" ] && [ -f "$REPO/packages/exporter/dist/index.js" ] || skip "pnpm build 먼저"
}

# tmux 서버를 시험 전용 소켓 폴더에 띄우고, pane 셸이 프로필로 PATH 를 덮지 않게 한다
# 반드시 make_fake_bin 뒤에 호출한다(서버가 가짜 claude 가 든 PATH 를 물려받아야 함)
tmux_sandbox() {
  export TMUX_TMPDIR="$BATS_TEST_TMPDIR/tmux"; mkdir -p "$TMUX_TMPDIR"; unset TMUX
  tmux -f /dev/null new-session -d -s keep \; set -g default-command "bash --noprofile --norc"
}

# 시험 소켓의 tmux 서버 종료(teardown 용)
tmux_cleanup() {
  tmux kill-server 2>/dev/null || true
}

# golden g3-claude-only 입력으로 ZIP 을 만들어 풀고 프로젝트 폴더(g3-demo)로 이동한다
unpack_project() {
  cd "$BATS_TEST_TMPDIR" || return 1
  node "$REPO/tools/make-zip.mjs" "$REPO/tests/golden/g3-claude-only/input.json" g3.zip
  unzip -q g3.zip
  cd g3-demo || return 1
}

# 프로젝트 폴더에서 setup → develop 브랜치 → create-worktrees (../g3-demo-dev1, -dev2, 브랜치 feature/dev1·2)
bootstrap_project() {
  run bash scripts/setup.sh
  [ "$status" -eq 0 ]
  git branch develop
  run bash scripts/create-worktrees.sh
  [ "$status" -eq 0 ]
  [ -d ../g3-demo-dev1 ]
  [ -d ../g3-demo-dev2 ]
}

# 패턴에 맞는 줄이 n 개 이상 될 때까지 기다림: wait_count <초> <grep 패턴> <파일> <n>
wait_count() {
  local i; for ((i = 0; i < $1 * 2; i++)); do
    [ "$(grep -c -- "$2" "$3" 2>/dev/null)" -ge "$4" ] && return 0; sleep 0.5
  done
  echo "시간 초과: '$2' 가 $4 줄 미만 ($3)"; cat "$3" 2>/dev/null; return 1
}

# 파일이 생길 때까지 기다림: wait_file <초> <경로>
wait_file() {
  local i; for ((i = 0; i < $1 * 2; i++)); do [ -e "$2" ] && return 0; sleep 0.5; done
  echo "시간 초과: 파일 생성 대기 $2"; return 1
}

# 파일이 사라질 때까지 기다림: wait_gone <초> <경로>
wait_gone() {
  local i; for ((i = 0; i < $1 * 2; i++)); do [ -e "$2" ] || return 0; sleep 0.5; done
  echo "시간 초과: 파일 소비 대기 $2"; return 1
}

# tmux pane 화면에 패턴이 나타날 때까지 기다림: wait_pane <초> <grep 패턴> <tmux 대상>
# 패턴은 ASCII 로 준다(tmux 가 UTF-8 로케일이 아니면 한글이 깨질 수 있음)
wait_pane() {
  local i; for ((i = 0; i < $1 * 2; i++)); do
    tmux capture-pane -p -J -t "$3" 2>/dev/null | grep -q -- "$2" && return 0; sleep 0.5  # -J: 접힌 줄을 합쳐 본다
  done
  echo "시간 초과: pane '$3' 에 '$2' 없음"; tmux capture-pane -p -t "$3" 2>/dev/null; return 1
}

# 패턴이 파일에 없어야 함(`! grep` 은 set -e 에서 실패로 처리되지 않으므로 명시 검사): not_in_file <패턴> <파일>
not_in_file() {
  if grep -q -- "$1" "$2" 2>/dev/null; then echo "있으면 안 되는 줄: '$1' ($2)"; cat "$2"; return 1; fi
  return 0
}

# 풀린 프로젝트의 worktree 에 파일을 만들고 커밋한다: commit_in <폴더> <경로> <내용> [커밋 메시지]
commit_in() {
  mkdir -p "$1/$(dirname "$2")"; printf '%s\n' "$3" > "$1/$2"
  git -C "$1" add -A && git -C "$1" commit -qm "${4:-test: $2}"
}
