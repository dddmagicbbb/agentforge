#!/usr/bin/env bash
# .claude/hooks/guard-paths.sh
# PreToolUse(Edit|Write): 에이전트별 담당 범위 밖 파일 수정을 막는다.
# AF_AGENT 가 없으면(리드·순차 단계 세션) 검사하지 않는다.
set -u
input="$(cat)"
[ -z "${AF_AGENT:-}" ] && exit 0

# jq 가 없으면 범위를 검사할 수 없으므로 통과시키지 않고 차단한다(fail-closed).
command -v jq >/dev/null 2>&1 || {
  echo "jq 가 없어 담당 범위를 검사할 수 없습니다. 설치 후 다시 실행하세요." >&2; exit 2; }

file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')"
[ -z "$file" ] && exit 0

# 어휘적 경로 정규화(파일이 없어도 동작, GNU 전용 도구 불필요): . 와 빈 세그먼트 제거, .. 는 앞 세그먼트 제거
normalize() {
  local IFS=/ seg out=""
  for seg in $1; do
    case "$seg" in
      ""|.) ;;
      ..) out="${out%/*}" ;;
      *) out="$out/$seg" ;;
    esac
  done
  printf '%s' "${out:-/}"
}

root="$(git -C "${cwd:-.}" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "저장소를 찾지 못해 수정을 막았습니다: $file" >&2; exit 2; }
case "$file" in /*) ;; *) file="${cwd:-.}/$file";; esac
file="$(normalize "$file")"   # ../ 우회 차단
root="$(normalize "$root")"
inside=0
case "$file" in
  "$root"/*) rel="${file#"$root"/}"; inside=1;;
  *) rel="$file";;   # 저장소 밖: 항상 차단
esac

list="$root/.claude/devs/$AF_AGENT.paths"
[ -f "$list" ] || { echo "담당 범위 파일이 없습니다: $list" >&2; exit 2; }

if [ "$inside" -eq 1 ]; then
  while IFS= read -r p || [ -n "$p" ]; do
    p="${p%%#*}"; p="${p//[[:space:]]/}"
    [ -z "$p" ] && continue
    case "$p" in
      */) case "$rel" in "$p"*) exit 0;; esac;;   # 디렉터리 항목: 접두어
      *) [ "$rel" = "$p" ] && exit 0;;            # 파일 항목: 완전 일치
    esac
  done < "$list"
fi

echo "담당 범위 밖 파일입니다: $rel ($AF_AGENT). 수정하지 말고 report에 필요한 변경을 적은 뒤 멈추세요." >&2
exit 2
