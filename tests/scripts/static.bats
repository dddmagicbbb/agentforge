#!/usr/bin/env bats
# 정적 원본 기본 검사. 사례별 테스트(guard·check-forge·중계)는 T-412~T-414 에서 추가한다.

setup() { cd "$BATS_TEST_DIRNAME/../.." || exit 1; }

@test "templates/ 정적 원본이 PoC(poc.html)와 바이트 단위로 같다" {
  run node tools/extract-poc-static.mjs --check
  [ "$status" -eq 0 ]
}

@test "모든 정적 스크립트는 bash shebang 으로 시작하고 LF 다" {
  for f in templates/static/*.sh; do
    head -n1 "$f" | grep -qx '#!/usr/bin/env bash'
    ! grep -q $'\r' "$f"
  done
}

@test "guard-paths.sh: AF_AGENT 가 없으면(리드 세션) 검사 없이 통과" {
  run env -u AF_AGENT bash templates/static/guard-paths.sh <<< '{"tool_input":{"file_path":"x"}}'
  [ "$status" -eq 0 ]
}
