#!/usr/bin/env bash
# scripts/check-forge.sh : AI가 만든 에이전트·스킬·범위 파일을 기계적으로 검사한다.
set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)" || exit 1
fail=0
ok()  { echo "✓ $*"; }
err() { echo "✗ $*"; fail=1; }

n="$(jq -r '.developers' .agentforge/forge.config.json)"

# 1) CLAUDE.md 길이
lines="$(wc -l < CLAUDE.md)"
if [ "$lines" -le 200 ]; then ok "CLAUDE.md ${lines}줄"; else err "CLAUDE.md ${lines}줄(200줄 이하 권장)"; fi

# frontmatter의 skills 목록 추출
skills_of() {
  awk '/^---[[:space:]]*$/{c++; next}
       c==1 && /^skills:/{f=1; next}
       c==1 && f && /^[[:space:]]*-/{sub(/^[[:space:]]*-[[:space:]]*/,""); print; next}
       c==1 && f{f=0}' "$1"
}

# 2) 개발자별 에이전트·범위 파일·스킬 참조
for i in $(seq 1 "$n"); do
  for a in "dev-$i" "review-$i"; do
    f=".claude/agents/$a.md"
    if [ ! -f "$f" ]; then err "$f 없음"; continue; fi
    name="$(awk '/^---/{c++; next} c==1 && /^name:/{sub(/^name:[[:space:]]*/,""); print; exit}' "$f")"
    [ "$name" = "$a" ] || err "$f 의 name($name)이 파일명과 다름"
    [ -s ".claude/devs/$a.paths" ] || err ".claude/devs/$a.paths 없음"
    for s in $(skills_of "$f"); do
      [ -f ".claude/skills/$s/SKILL.md" ] || err "$a 가 참조한 스킬 $s 없음"
    done
  done
done

# 3) 개발자 사이 담당 범위 겹침
tmp="$(mktemp)"
for i in $(seq 1 "$n"); do
  sed 's/#.*//; s/[[:space:]]//g; /^$/d' ".claude/devs/dev-$i.paths" 2>/dev/null | sed "s/^/dev-$i /"
done > "$tmp"
while read -r a p; do
  while read -r b q; do
    [ "$a" \< "$b" ] || continue
    case "$p" in "$q"*) err "범위 겹침: $a($p) / $b($q)"; continue;; esac
    case "$q" in "$p"*) err "범위 겹침: $a($p) / $b($q)";; esac
  done < "$tmp"
done < "$tmp"
rm -f "$tmp"

# 4) 스킬 name = 폴더명
for d in .claude/skills/*/; do
  s="$(basename "$d")"
  name="$(awk '/^---/{c++; next} c==1 && /^name:/{sub(/^name:[[:space:]]*/,""); print; exit}' "$d/SKILL.md")"
  [ "$name" = "$s" ] || err "스킬 $s 의 name($name) 불일치"
done

# 5) hook 실행 권한
[ -x .claude/hooks/guard-paths.sh ] || err "guard-paths.sh 실행 권한 없음(chmod +x)"

# 6) PRD 기능 ID가 모두 배정되었는지
if [ -f docs/prd.md ] && [ -f docs/tasks.md ]; then
  mapfile -t ids < <(grep -oE 'F-[0-9]{3}' docs/prd.md | sort -u)
  for id in "${ids[@]}"; do
    grep -q "$id" docs/tasks.md || err "$id 가 docs/tasks.md 에 배정되지 않음"
  done
else
  err "docs/prd.md 또는 docs/tasks.md 가 없습니다(기획·분석 단계 먼저)"
fi

if [ "$fail" -eq 0 ]; then echo "검증 통과"; else echo "검증 실패: 위 항목을 고친 뒤 다시 실행"; exit 1; fi
