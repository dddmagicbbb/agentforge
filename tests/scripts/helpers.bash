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
}

need_tools() {
  local t; for t in "$@"; do command -v "$t" >/dev/null || skip "$t 없음"; done
}

# PoC 결함 D7: setup.sh 의 sed -i 는 GNU 전용(macOS 실패). T-404 에서 ADR 후 수정
skip_on_bsd_sed() {
  sed --version >/dev/null 2>&1 || skip "D7: BSD sed 에서 setup.sh 실패(T-404 에서 수정 예정)"
}

wait_for() {  # wait_for <초> <grep 패턴> <파일>
  local i; for ((i = 0; i < $1 * 2; i++)); do grep -q -- "$2" "$3" 2>/dev/null && return 0; sleep 0.5; done
  echo "시간 초과: '$2' ($3)"; cat "$3" 2>/dev/null; return 1
}
