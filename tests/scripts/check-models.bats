#!/usr/bin/env bats
# T-611 / PRV-03 (design.md 8.3): scripts/check-models.sh 판정·종료 코드·키 미출력
# 가짜 claude 가 에이전트별로 미리 정한 출력·종료 코드·지연을 내고, 받은 인자를 기록한다.
# 문구 전체가 아니라 판정 기호(✓ ! ✗)·에이전트 이름·요약 숫자·종료 코드 위주로 단언한다.

load helpers

SECRET="sk-SECRET-VALUE-9f3a"

setup() {
  need_tools jq
  W="$BATS_TEST_TMPDIR/p"; copy_golden ui-off-dev2-litellm "$W"; cd "$W" || exit 1
  # 점검 스크립트는 정적 템플릿(항상 생성)이므로 현재 템플릿을 그대로 둔다
  cp "$REPO/templates/static/check-models.sh" scripts/check-models.sh
  # litellm 경유 에이전트가 agent-env 를 통과하도록 키를 넣는다(값은 시험 전용)
  printf 'LITELLM_MASTER_KEY=%s\nOLLAMA_URL=http://localhost:11434\n' "$SECRET" > .agentforge/env.local
  PROJECT="$(jq -r .project .agentforge/forge.config.json)"
  FAKE_DIR="$BATS_TEST_TMPDIR/fake"; mkdir -p "$FAKE_DIR"
  export FAKE_DIR FAKE_ARGS_LOG="$BATS_TEST_TMPDIR/args.log"; : > "$FAKE_ARGS_LOG"
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"; mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/claude" <<'SH'
#!/usr/bin/env bash
a=""; prev=""
for x in "$@"; do [ "$prev" = "--agent" ] && a="$x"; prev="$x"; done
echo "$a args: $*" >> "$FAKE_ARGS_LOG"
# 표준입력이 /dev/null(EOF) 인지 확인: EOF 면 read 가 1 로 즉시 끝난다
IFS= read -r -t 2 _ ; echo "$a stdin-rc=$?" >> "$FAKE_ARGS_LOG"
[ -f "$FAKE_DIR/$a.sleep" ] && sleep "$(cat "$FAKE_DIR/$a.sleep")"
[ -f "$FAKE_DIR/$a.out" ] && cat "$FAKE_DIR/$a.out"
exit "$(cat "$FAKE_DIR/$a.rc" 2>/dev/null || echo 0)"
SH
  chmod +x "$FAKE_BIN/claude"; export PATH="$FAKE_BIN:$PATH"
}

# reply <에이전트> <result> <num_turns> [is_error]
reply() {
  jq -nc --arg r "$2" --argjson t "$3" --argjson e "${4:-false}" \
    '{type:"result", is_error:$e, result:$r, num_turns:$t}' > "$FAKE_DIR/$1.out"
}

check() { run bash scripts/check-models.sh "$@"; }

# ---------------------------------------------------------------- 판정

@test "8.3 통과: result 에 project 값이 있고 num_turns>=2 → exit 0, 요약 통과 1" {
  reply dev-1 "$PROJECT" 3
  check dev-1
  [ "$status" -eq 0 ]
  [[ "$output" == *"✓ dev-1"* ]]
  [[ "$output" == *"gemini-2.5-pro"* ]]
  [[ "$output" == *"통과 1 · 경고 0 · 실패 0"* ]]
}

@test "8.3 경고: result 에 project 값이 없음 → exit 0(경고만), 요약 경고 1" {
  reply review-1 "모르겠습니다" 3
  check review-1
  [ "$status" -eq 0 ]
  [[ "$output" == *"! review-1"* ]]
  [[ "$output" == *"통과 0 · 경고 1 · 실패 0"* ]]
}

@test "8.3 경고: 값은 맞지만 num_turns<2(도구 호출 미확인) → exit 0" {
  reply review-1 "$PROJECT" 1
  check review-1
  [ "$status" -eq 0 ]
  [[ "$output" == *"! review-1"* ]]
  [[ "$output" == *"통과 0 · 경고 1 · 실패 0"* ]]
}

@test "8.3 실패: is_error true → exit 1" {
  reply review-1 "$PROJECT" 3 true
  check review-1
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ review-1"* ]]
  [[ "$output" == *"통과 0 · 경고 0 · 실패 1"* ]]
}

@test "8.3 실패: claude 가 비정상 종료(exit 3) → exit 1" {
  reply review-1 "$PROJECT" 3
  echo 3 > "$FAKE_DIR/review-1.rc"
  check review-1
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ review-1"* ]]
}

@test "8.3 실패: 응답이 JSON 이 아님 → exit 1" {
  printf '%s\n' 'this is not json {' > "$FAKE_DIR/review-1.out"
  check review-1
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ review-1"* ]]
}

@test "8.3 실패: agent-env 실패(litellm 키 누락) → claude 를 호출하지 않고 exit 1" {
  : > .agentforge/env.local
  check planner
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ planner"* ]]
  not_in_file "planner args:" "$FAKE_ARGS_LOG"
}

@test "8.3 실패: AF_CHECK_TIMEOUT 초과 → exit 1 (timeout 명령이 있을 때)" {
  need_tools timeout
  reply review-1 "$PROJECT" 3
  echo 20 > "$FAKE_DIR/review-1.sleep"
  start=$SECONDS
  AF_CHECK_TIMEOUT=2 check review-1
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ review-1"* ]]
  [ $((SECONDS - start)) -lt 15 ]
}

# ---------------------------------------------------------------- 대상·요약·종료 코드

@test "8.3 인자로 지정한 에이전트만 점검한다" {
  reply dev-1 "$PROJECT" 3; reply review-1 "$PROJECT" 3
  check dev-1 review-1
  [ "$status" -eq 0 ]
  grep -q "^dev-1 args:" "$FAKE_ARGS_LOG"
  grep -q "^review-1 args:" "$FAKE_ARGS_LOG"
  [ "$(grep -c ' args:' "$FAKE_ARGS_LOG")" -eq 2 ]
  [[ "$output" == *"통과 2 · 경고 0 · 실패 0"* ]]
}

@test "8.3 인자가 없으면 config 의 agents 키 전부를 점검한다" {
  local a; for a in $(jq -r '.agents | keys[]' .agentforge/forge.config.json); do reply "$a" "$PROJECT" 3; done
  n="$(jq '.agents | length' .agentforge/forge.config.json)"
  check
  [ "$status" -eq 0 ]
  [ "$(grep -c ' args:' "$FAKE_ARGS_LOG")" -eq "$n" ]
  [[ "$output" == *"통과 $n · 경고 0 · 실패 0"* ]]
}

@test "8.3 통과·경고·실패가 섞이면 요약 숫자가 각각 맞고 실패가 있어 exit 1" {
  reply dev-1 "$PROJECT" 3
  reply review-1 "무관한 답" 3
  reply dev-2 "$PROJECT" 3 true
  check dev-1 review-1 dev-2
  [ "$status" -eq 1 ]
  [[ "$output" == *"✓ dev-1"* ]]
  [[ "$output" == *"! review-1"* ]]
  [[ "$output" == *"✗ dev-2"* ]]
  [[ "$output" == *"통과 1 · 경고 1 · 실패 1"* ]]
}

# ---------------------------------------------------------------- 호출 형태·비밀

@test "8.3 claude 호출: --agent <a> --output-format json --max-turns 3, 표준입력은 /dev/null" {
  reply dev-1 "$PROJECT" 3
  check dev-1
  [ "$status" -eq 0 ]
  line="$(grep '^dev-1 args:' "$FAKE_ARGS_LOG")"
  [[ "$line" == *"--agent dev-1"* ]]
  [[ "$line" == *"--output-format json"* ]]
  [[ "$line" == *"--max-turns 3"* ]]
  [[ "$line" == *"-p "* ]]
  # 표준입력이 EOF(read 종료 코드 1)여야 한다. 대기(>128)면 /dev/null 연결이 빠진 것
  grep -qx "dev-1 stdin-rc=1" "$FAKE_ARGS_LOG"
}

@test "8.3 키 값과 응답 원문은 어떤 판정에서도 출력하지 않는다" {
  # 각 응답 본문에 키 값과 식별 가능한 원문을 심어 두고 출력에 없는지 확인
  reply dev-1 "RAWBODY $SECRET" 3
  reply review-1 "RAWBODY $SECRET $PROJECT" 3 true
  printf 'RAWBODY %s not json\n' "$SECRET" > "$FAKE_DIR/dev-2.out"
  check dev-1 review-1 dev-2
  [ "$status" -eq 1 ]
  [[ "$output" != *"$SECRET"* ]]
  [[ "$output" != *"RAWBODY"* ]]
}
