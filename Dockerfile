# AgentForge 설치형 이미지 (T-813, design.md 10.2)
# 빌드 단계: 소스에서 워크스페이스를 빌드하고 실행에 필요한 파일만 /out 으로 뽑는다.
FROM node:22-alpine AS build
WORKDIR /src
# 루트 package.json 도 이름이 agentforge 라서 앱 선택은 이름이 아니라 경로로 한다
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm build \
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
# 컨테이너 안에서는 0.0.0.0 에 바인드한다. 외부 노출은 -p 127.0.0.1:3456:3456 처럼 사용자가 정한다.
# 이름으로 접속하려면 AF_MARKET_HOSTS(허용 Host 목록)를 지정한다. 관리 API 는 AF_MARKET_ADMIN=1 일 때만 켜진다.
ENV AF_MARKET_DATA=/data HOST=0.0.0.0 PORT=3456
VOLUME /data
EXPOSE 3456
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3456)+'/api/market/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["node", "dist/cli.js"]
