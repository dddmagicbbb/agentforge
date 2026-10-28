#!/usr/bin/env bash
# .claude/hooks/guard-paths.sh
# PreToolUse(Edit|Write): 에이전트별 담당 범위 밖 파일 수정을 막는다.
# AF_AGENT 가 없으면(리드·순차 단계 세션) 검사하지 않는다.
set -u
input="$(cat)"
[ -z "${AF_AGENT:-}" ] && exit 0

file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
[ -z "$file" ] && exit 0

root="$(git -C "${cwd:-.}" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "저장소를 찾지 못해 수정을 막았습니다: $file" >&2; exit 2; }
case "$file" in /*) ;; *) file="${cwd:-.}/$file";; esac
file="$(realpath -m "$file")"   # ../ 우회 차단
rel="${file#"$root"/}"

list="$root/.claude/devs/$AF_AGENT.paths"
[ -f "$list" ] || { echo "담당 범위 파일이 없습니다: $list" >&2; exit 2; }

while IFS= read -r p || [ -n "$p" ]; do
  p="${p%%#*}"; p="${p//[[:space:]]/}"
  [ -z "$p" ] && continue
  case "$rel" in "$p"*) exit 0;; esac
done < "$list"

echo "담당 범위 밖 파일입니다: $rel ($AF_AGENT). 수정하지 말고 report에 필요한 변경을 적은 뒤 멈추세요." >&2
exit 2
