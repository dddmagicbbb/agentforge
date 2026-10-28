#!/usr/bin/env bats
# T-413 / GEN-03: scripts/check-forge.sh 6사례
# golden g3-claude-only 파일 + 더미 prd/tasks 로 통과 사례를 만들고, 사례마다 한 가지씩 망가뜨려 ✗ 문구를 확인한다.
# PoC 결함 D1: 6번 항목은 `F-[0-9]{3}` 형식의 기능 ID 만 인식한다(더미 PRD 도 이 형식).

load helpers

setup() {
  need_tools git jq; need_bash4
  isolate_git
  W="$BATS_TEST_TMPDIR/proj"; copy_golden g3-claude-only "$W"
  mkdir -p "$W/docs"
  printf '%s\n' '# PRD' '- F-001 주문 등록' '- F-002 주문 조회' > "$W/docs/prd.md"
  printf '%s\n' '# 작업' '| T-101 | F-001 | dev-1 |' '| T-201 | F-002 | dev-2 |' > "$W/docs/tasks.md"
  chmod +x "$W/.claude/hooks/guard-paths.sh"   # 압축 해제/setup.sh 가 하는 일을 대신함
  git -C "$W" init -q                          # check-forge 는 git rev-parse 로 루트를 찾는다
  cd "$W" || exit 1
}

@test "① 통과: golden 파일 + 모든 기능 ID 배정 → exit 0, ✗ 없음" {
  run bash scripts/check-forge.sh
  [ "$status" -eq 0 ]
  [[ "$output" == *"검증 통과"* ]]
  [[ "$output" != *"✗"* ]]
}

@test "② 개발자 사이 담당 범위 겹침 → exit 1, 범위 겹침" {
  echo "src/alpha/sub/" >> .claude/devs/dev-2.paths
  run bash scripts/check-forge.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ 범위 겹침: dev-1(src/alpha/) / dev-2(src/alpha/sub/)"* ]]
  [[ "$output" == *"검증 실패"* ]]
}

@test "③ 에이전트가 참조한 스킬 없음 → exit 1, 스킬 이름 표시" {
  rm -rf .claude/skills/dev1-alpha
  run bash scripts/check-forge.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ dev-1 가 참조한 스킬 dev1-alpha 없음"* ]]
  [[ "$output" == *"✗ review-1 가 참조한 스킬 dev1-alpha 없음"* ]]   # 짝 검증자도 같은 스킬을 참조
}

@test "④ .claude/devs/dev-N.paths 없음 → exit 1" {
  rm .claude/devs/dev-2.paths
  run bash scripts/check-forge.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ .claude/devs/dev-2.paths 없음"* ]]
}

@test "⑤ PRD 기능 ID 가 tasks 에 배정되지 않음 → exit 1, 미배정 ID 표시" {
  echo '- F-003 정산 리포트' >> docs/prd.md
  run bash scripts/check-forge.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ F-003 가 docs/tasks.md 에 배정되지 않음"* ]]
  # 배정된 ID 는 오류로 나오지 않는다
  [[ "$output" != *"✗ F-001"* && "$output" != *"✗ F-002"* ]]
}

@test "⑥ docs/prd.md·tasks.md 없음 → exit 1, 기획·분석 단계 안내" {
  rm docs/prd.md docs/tasks.md
  run bash scripts/check-forge.sh
  [ "$status" -eq 1 ]
  [[ "$output" == *"✗ docs/prd.md 또는 docs/tasks.md 가 없습니다"* ]]
}
