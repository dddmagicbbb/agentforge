// 기동 진입점. 기본 host 는 127.0.0.1(외부 노출은 호출자가 명시하고 별도 접근 통제를 둔다).
import type { FastifyInstance } from "fastify";
import { createServer } from "./app.js";
import type { ScanFn } from "./types.js";

export interface ListenAddress {
  host: string;
  port: number;
}

export async function listenServer(app: FastifyInstance, opts: { host?: string; port: number }): Promise<ListenAddress> {
  const host = opts.host ?? "127.0.0.1";
  await app.listen({ host, port: opts.port });
  const a = app.server.address();
  if (a === null || typeof a === "string") throw new Error("listen address unavailable");
  return { host, port: a.port };
}

/** 환경 변수로 기동: PORT(기본 8787)·AF_MARKET_DATA(기본 ./.agentforge-market)·AF_WEB_DIST(선택). 나머지 AF_* 는 createServer 가 읽는다 */
export async function startFromEnv(env: Record<string, string | undefined>, scan: ScanFn): Promise<{ app: FastifyInstance; address: ListenAddress }> {
  const portText = env["PORT"] ?? "8787";
  const port = Number(portText);
  if (!/^\d{1,5}$/.test(portText) || port > 65535) throw new Error("invalid PORT");
  const app = await createServer({ dataDir: env["AF_MARKET_DATA"] ?? "./.agentforge-market", scan, ...(env["AF_WEB_DIST"] ? { webDist: env["AF_WEB_DIST"] } : {}), env });
  return { app, address: await listenServer(app, { port }) };
}
