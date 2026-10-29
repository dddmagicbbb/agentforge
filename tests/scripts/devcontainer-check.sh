#!/usr/bin/env bash
# T-613 / VSC-02 (design.md 8.4): 생성된 .devcontainer/devcontainer.json 의 이미지·postCreateCommand 가 실제로 동작하는지 확인한다.
#   1) devcontainer: true 입력으로 ZIP 생성 → 풀기 → JSON 구조 확인(항상 실행)
#   2) docker 가 있으면: 그 이미지로 컨테이너를 띄워 postCreateCommand 실행 후 tmux·jq·claude 버전 확인
#   3) docker 가 없고 AF_IN_DEVCONTAINER_IMAGE=1(CI 가 이미 그 이미지 안)이면: 현재 환경에서 같은 확인
#   4) 둘 다 아니면 "건너뜀" 으로 끝낸다(exit 0)
# 사용: bash tests/scripts/devcontainer-check.sh   (사전 조건: pnpm build)
set -euo pipefail
# AF_DEVCONTAINER_REQUIRED=1 이면 건너뛰는 대신 실패(exit 1)한다(CI 에서 조용히 건너뛰는 것을 막는 용도)
skip() { echo "건너뜀: $1"; [ "${AF_DEVCONTAINER_REQUIRED:-}" = "1" ] && { echo "실패: AF_DEVCONTAINER_REQUIRED=1 인데 확인을 수행하지 못했습니다"; exit 1; }; exit 0; }
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY='tmux -V && jq --version && claude --version'

for t in node jq unzip; do command -v "$t" >/dev/null || skip "$t 없음"; done
[ -f "$REPO/packages/core/dist/index.js" ] && [ -f "$REPO/packages/exporter/dist/index.js" ] \
  || skip "pnpm build 먼저"

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
jq '.devcontainer = true' "$REPO/tests/golden/g3-claude-only/input.json" > "$work/in.json"
node "$REPO/tools/make-zip.mjs" "$work/in.json" "$work/p.zip" >/dev/null
(cd "$work" && unzip -q p.zip)
proj="$work/$(jq -r .name "$work/in.json")"
cfg="$proj/.devcontainer/devcontainer.json"
[ -f "$cfg" ] || { echo "실패: .devcontainer/devcontainer.json 이 생성되지 않았습니다"; exit 1; }

image="$(jq -r '.image // empty' "$cfg")"
post="$(jq -r '.postCreateCommand // empty' "$cfg")"
[ -n "$image" ] || { echo "실패: image 가 비었습니다"; exit 1; }
[ -n "$post" ] || { echo "실패: postCreateCommand 가 비었습니다"; exit 1; }
[ "$(jq -r '.remoteEnv.AF_IN_CONTAINER // empty' "$cfg")" = "1" ] || { echo "실패: remoteEnv.AF_IN_CONTAINER 가 1 이 아닙니다"; exit 1; }
[ "$(jq -r '.name // empty' "$cfg")" = "$(jq -r .name "$work/in.json")" ] || { echo "실패: name 이 프로젝트 slug 와 다릅니다"; exit 1; }
# shellcheck disable=SC2012  # 파일 하나의 권한 문자열만 읽는다(ls -l 첫 열). stat 은 GNU·BSD 옵션이 달라 쓰지 않는다
perm="$(ls -l "$cfg" | cut -c1-10)"
[ "$perm" = "-rw-r--r--" ] || { echo "실패: devcontainer.json 권한이 644 가 아닙니다($perm)"; exit 1; }
echo "구조 확인 통과: image=$image"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  echo "docker 로 확인: $image"
  docker run --rm -v "$proj:/workspace" -w /workspace "$image" bash -lc "set -e; $post; $VERIFY"
elif [ "${AF_IN_DEVCONTAINER_IMAGE:-}" = "1" ]; then
  echo "현재 환경(이미지 안)에서 확인"
  (cd "$proj" && bash -lc "set -e; $post; $VERIFY")
else
  echo "구조 확인 통과 후 실동작 확인은 생략합니다"
  skip "docker 가 없고 AF_IN_DEVCONTAINER_IMAGE=1 도 아닙니다"
fi
echo "통과: postCreateCommand 실행 후 tmux·jq·claude 확인"
