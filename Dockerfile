# AgentForge 설치형 이미지 (T-813, design.md 10.2)
# 권고(운영): 재현 가능한 빌드를 위해 node 이미지를 digest 로 고정한다(node:22-alpine@sha256:...). 태그는 유지하고 digest 는 릴리스 때 정한다.
# 빌드 단계: 소스에서 워크스페이스를 빌드하고 실행에 필요한 파일만 /out 으로 뽑는다.
FROM node:22-alpine AS build
WORKDIR /src
RUN corepack enable
# 매니페스트·lock 만 먼저 복사해 의존성 설치 레이어를 캐시한다(소스만 바뀌면 재사용)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/app/package.json packages/app/
COPY packages/core/package.json packages/core/
COPY packages/exporter/package.json packages/exporter/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile
COPY . .
# 루트 package.json 도 이름이 agentforge 라서 앱 선택은 이름이 아니라 경로로 한다
RUN pnpm build \
 && pnpm --filter ./packages/app --prod deploy --legacy /out

# 런타임 단계: 소스·devDependencies 없음. 번들(dist/cli.js)과 실행 의존성(fastify·zod)만 둔다.
FROM node:22-alpine
# git: 마켓 git 소스 색인에 필요
RUN apk add --no-cache git \
 && adduser -D -u 10001 af \
 && mkdir /data /app \
 && chown af:af /data /app
WORKDIR /app
COPY --from=build --chown=af:af /out /app
USER af
# 일반 이름(HOST·PORT)은 쓰지 않는다. 바인드 주소는 ENTRYPOINT 의 --host 로 컨테이너 안에서만 넓게 연다.
# 외부 노출은 -p 127.0.0.1:3456:3456 처럼 운영자가 정한다. 이름으로 접속하려면 AF_MARKET_HOSTS(허용 Host 목록)를 지정한다.
# 관리 API 는 환경 변수로 켜지지 않는다: docker run ... IMAGE --admin
ENV AF_MARKET_DATA=/data AF_PORT=3456
VOLUME /data
EXPOSE 3456
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.AF_PORT||3456)+'/api/market/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# 추가 인자(--admin, --port 등)는 이 뒤에 붙는다
ENTRYPOINT ["node", "dist/cli.js", "--host", "0.0.0.0"]
