#!/usr/bin/env bash
# T-813 / DPL-01 (design.md 10.2): 폐쇄망(외부 접속 불가) Docker 시험.
#   1) 이미지 빌드 → docker network create --internal(외부 차단)
#   2) 앱 컨테이너 기동(--admin 인자, AF_ALLOW_FILE_SOURCES=1, AF_MARKET_HOSTS=컨테이너 이름)
#   3) 같은 네트워크의 curlimages/curl 로 / 와 /api/market/health 확인
#   4) 볼륨에 만든 시험 git 저장소를 file:// 소스로 등록·색인·검색
#   5) 앱 컨테이너에서 외부(https://github.com) 연결이 실패하는지 확인
#   6) 컨테이너·네트워크·볼륨·이미지 삭제
# TODO(T-811 이후): /api/license 확인 단계 추가(시험 키는 AF_LICENSE, 시험 공개 키는 AF_LICENSE_TEST_PUBKEY + AF_ALLOW_TEST_LICENSE=1)
# 사용: bash tests/scripts/airgap-check.sh   (docker 필요)
#   AF_AIRGAP_REQUIRED=1 이면 docker 가 없을 때 건너뛰는 대신 실패(exit 1)한다(CI 에서 조용히 건너뛰는 것을 막는 용도)
set -euo pipefail
export MSYS_NO_PATHCONV=1 # Git Bash 에서 컨테이너 경로가 변환되지 않게 한다

skip() {
  echo "건너뜀: $1"
  if [ "${AF_AIRGAP_REQUIRED:-}" = "1" ]; then echo "실패: AF_AIRGAP_REQUIRED=1 인데 확인을 수행하지 못했습니다"; exit 1; fi
  exit 0
}
fail() { echo "실패: $1"; exit 1; }

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
command -v docker >/dev/null || skip "docker 없음"
docker info >/dev/null 2>&1 || skip "docker 데몬에 연결할 수 없음"

sfx="$(date +%s)-$$-${RANDOM}"
IMG="agentforge-airgap:${sfx}"
NET="af-airgap-${sfx}"
APP="af-app-${sfx}"
VOL="af-data-${sfx}"
CURL_IMG="${AF_AIRGAP_CURL_IMAGE:-curlimages/curl:8.11.1}"
PORT=3456

cleanup() {
  docker rm -f "$APP" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
  docker volume rm "$VOL" >/dev/null 2>&1 || true
  docker rmi "$IMG" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 같은 내부 네트워크 안의 curl 컨테이너로 요청한다(호스트 포트는 열지 않는다)
net_curl() { docker run --rm --network "$NET" "$CURL_IMG" -fsS --max-time 10 "$@"; }
# 구조화된 응답은 앱 이미지의 node 로 해석한다(별도 jq 불필요)
js() { docker exec "$APP" node -e "$1"; }

# 이미지는 네트워크를 만들기 전에 미리 받아 둔다(폐쇄망 네트워크 안에서는 pull 불가)
docker pull -q "$CURL_IMG" >/dev/null || fail "curl 이미지를 받을 수 없습니다"
echo "== 1) 이미지 빌드"
docker build -q -t "$IMG" "$REPO" >/dev/null || fail "이미지 빌드"

echo "== 2) 내부 네트워크·볼륨"
docker network create --internal "$NET" >/dev/null
docker volume create "$VOL" >/dev/null

# 시험 저장소는 앱과 같은 사용자(af)로 만들어야 git 소유권 검사(dubious ownership)에 걸리지 않는다
docker run --rm -v "$VOL:/data" --entrypoint sh "$IMG" -c '
  set -e
  mkdir -p /data/testrepo/hello && cd /data/testrepo
  printf -- "---\nname: hello\ndescription: airgap test skill\n---\n\n# hello\n" > hello/SKILL.md
  git init -q -b main
  git add -A
  git -c user.name=t -c user.email=t@example.invalid commit -q -m init
' || fail "시험 저장소 생성"

echo "== 3) 앱 컨테이너 기동"
docker run -d --name "$APP" --network "$NET" -v "$VOL:/data" \
  -e AF_ALLOW_FILE_SOURCES=1 -e "AF_MARKET_HOSTS=$APP" \
  "$IMG" --admin >/dev/null || fail "앱 컨테이너 기동"

ok=0
for _ in $(seq 1 30); do
  if net_curl "http://$APP:$PORT/api/market/health" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || { docker logs "$APP" 2>&1 | tail -20; fail "health 응답 없음"; }

echo "== 4) / (web), health"
net_curl "http://$APP:$PORT/" | grep -qi "<html" || fail "/ 가 web index.html 이 아닙니다"
net_curl "http://$APP:$PORT/api/market/health" | grep -q '"admin":true' || fail "health 에 admin:true 가 없습니다"

# 비루트 확인
[ "$(docker exec "$APP" id -u)" != "0" ] || fail "컨테이너가 루트로 실행 중입니다"

echo "== 5) file:// 소스 등록·색인·검색"
net_curl -X POST -H 'content-type: application/json' \
  -d '{"id":"airgap","kind":"git","url":"file:///data/testrepo","trust":"org"}' \
  "http://$APP:$PORT/api/market/sources" >/dev/null || fail "소스 등록"
net_curl -X POST -H 'content-type: application/json' -d '{"id":"airgap"}' \
  "http://$APP:$PORT/api/market/refresh" | grep -q '"ok":true' || fail "색인 갱신"
net_curl "http://$APP:$PORT/api/market/search?q=hello" | grep -q '"id":"hello"' || fail "색인된 스킬이 검색되지 않습니다"

echo "== 6) 외부 연결 차단 확인"
# 판정을 분리한다: 연결 실패(차단됨)=7 → 정상, 연결 성공(새어 나감)=8 → exit 3, 그 밖(exec 실패 등) → exit 1
set +e
js "fetch('https://github.com',{signal:AbortSignal.timeout(5000)}).then(()=>process.exit(8),()=>process.exit(7))"
rc=$?
set -e
case "$rc" in
  7) ;;
  8) echo "실패: 앱 컨테이너에서 외부(https://github.com)로 나갈 수 있습니다 — 폐쇄망 시험이 성립하지 않습니다"; exit 3 ;;
  *) fail "외부 연결 확인을 수행하지 못했습니다(rc=$rc)" ;;
esac

echo "통과: 폐쇄망 시험 (web, health, file:// 소스 색인, 외부 차단)"
