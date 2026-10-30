// 앱 기동: 서버(createServer·listenServer)를 번들한 web·catalog 와 함께 띄운다.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { scanSkillRisk } from "@agentforge/core";
import { createServer, listenServer, type ListenAddress, type ScanFn } from "@agentforge/server";
import { CliError } from "./args.js";

export interface RunOptions {
  port: number;
  host: string;
  data: string;
  licenseFile?: string;
  admin: boolean;
}

export interface RunExtras {
  /** web dist 위치(기본: 패키지 안 web/) */
  webDist?: string;
  /** 기본 마켓 소스(기본: 패키지 안 catalog/market-sources.json) */
  defaultSourcesFile?: string;
  scan?: ScanFn;
  /** 부모 환경(기본 process.env) */
  env?: Record<string, string | undefined>;
  /** 서버에 넘기는 환경을 관찰하는 시험용 훅 */
  onEnv?: (env: Record<string, string | undefined>) => void;
}

export interface RunningApp {
  address: ListenAddress;
  close(): Promise<void>;
}

// 번들(dist/cli.js)과 같은 폴더의 web/·catalog/ 를 쓴다(빌드가 dist 안으로 복사). src 에서 직접 실행할 때는 extras 로 지정한다
const PKG = new URL("./", import.meta.url);

export async function startApp(opts: RunOptions, extras: RunExtras = {}): Promise<RunningApp> {
  const env: Record<string, string | undefined> = { ...(extras.env ?? process.env) };
  // 관리 API 는 --admin 일 때만 켠다. 부모 환경의 값은 따르지 않는다.
  if (opts.admin) env["AF_MARKET_ADMIN"] = "1";
  else delete env["AF_MARKET_ADMIN"];

  // TODO(T-811): 서버가 AF_LICENSE·dataDir/license.key 를 읽으면 이 자리를 그대로 연결한다(파일 내용만 env 로 넘긴다).
  if (opts.licenseFile) {
    try {
      env["AF_LICENSE"] = (await readFile(opts.licenseFile, "utf8")).trim();
    } catch {
      throw new CliError("LICENSE_FILE");
    }
  }
  extras.onEnv?.(env);

  const app = await createServer({
    dataDir: opts.data,
    scan: extras.scan ?? scanSkillRisk,
    webDist: extras.webDist ?? fileURLToPath(new URL("web", PKG)),
    defaultSourcesFile: extras.defaultSourcesFile ?? fileURLToPath(new URL("catalog/market-sources.json", PKG)),
    env,
  });
  let address: ListenAddress;
  try {
    address = await listenServer(app, { host: opts.host, port: opts.port });
  } catch (e) {
    await app.close();
    throw e;
  }
  let closing: Promise<void> | undefined;
  return { address, close: () => (closing ??= app.close()) };
}
