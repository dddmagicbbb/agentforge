#!/usr/bin/env bash
# .claude/hooks/guard-paths.sh
# PreToolUse(Edit|Write|MultiEdit|NotebookEdit): 에이전트별 담당 범위 밖 파일 수정을 막는다.
# AF_AGENT 가 없으면(리드·순차 단계 세션) 검사하지 않는다.
set -u
set -f   # 글롭 확장 끔(경로 조각이 패턴으로 펼쳐지는 우회 방지)
input="$(cat)"
[ -z "${AF_AGENT:-}" ] && exit 0

# jq 가 없으면 범위를 검사할 수 없으므로 통과시키지 않고 차단한다(fail-closed).
command -v jq >/dev/null 2>&1 || {
  echo "jq 가 없어 담당 범위를 검사할 수 없습니다. 설치 후 다시 실행하세요." >&2; exit 2; }

# JSON 해석 실패는 통과시키지 않고 차단한다(fail-closed). 경로는 file_path(Edit·Write·MultiEdit) 또는 notebook_path(NotebookEdit),
# 둘 다 비는 경우(파일 변경 도구 아님)는 아래에서 통과.
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')" &&
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty')" || {
  echo "hook 입력을 해석하지 못해 수정을 막았습니다." >&2; exit 2; }
# 제어 문자(개행·탭 등)가 든 경로는 차단한다. 명령 치환이 끝 개행을 지워 완전 일치로 우회되거나
# 개행만 있는 값이 빈 값으로 통과되는 것을 막으려고, 값 변환·빈 값 통과보다 앞에서 원시 JSON 을 jq 로 직접 검사한다(-e: 참이면 exit 0).
printf '%s' "$input" | jq -e '(.tool_input.file_path // .tool_input.notebook_path // "") | explode | any(. < 32 or . == 127)' >/dev/null 2>&1 && {
  echo "경로에 제어 문자가 있어 수정을 막았습니다." >&2; exit 2; }
[ -z "$file" ] && exit 0

# 어휘적 경로 정규화(파일이 없어도 동작, GNU 전용 도구 불필요): . 와 빈 세그먼트 제거, .. 는 앞 세그먼트 제거
normalize() {
  local seg out="" segs=()
  IFS=/ read -r -d '' -a segs < <(printf '%s' "$1")   # 끝 개행이 마지막 .. 를 가리지 않도록 개행 없이 분할(글롭 확장 대신 배열)
  for seg in "${segs[@]}"; do
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
