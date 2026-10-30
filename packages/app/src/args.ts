// 명령행 인자 해석(순수 함수). 우선순위: 인자 > 환경 변수(AF_PORT·AF_HOST·AF_MARKET_DATA, Docker 용; 일반 이름 PORT·HOST 는 읽지 않음) > 기본값.
import { parseArgs } from "node:util";
import { join } from "node:path";

export type CliErrorCode = "INVALID_ARGS" | "INVALID_PORT" | "INVALID_HOST" | "LICENSE_FILE";

export class CliError extends Error {
  constructor(
    readonly code: CliErrorCode,
    readonly detail: string = "",
  ) {
    super(code);
    this.name = "CliError";
  }
}

export type CliCommand = { kind: "help" } | { kind: "run"; port: number; host: string; data: string; licenseFile?: string; admin: boolean };

export const DEFAULT_PORT = 3456;
export const DEFAULT_HOST = "127.0.0.1";

export const HELP_TEXT = `사용법: agentforge [옵션]

  --port <번호>          접속 포트 (기본 ${DEFAULT_PORT}, 환경 변수 AF_PORT)
  --host <주소>          바인드 주소 (기본 ${DEFAULT_HOST}, 환경 변수 AF_HOST)
  --data <폴더>          마켓 색인 데이터 폴더 (기본 ~/.agentforge/data, 환경 변수 AF_MARKET_DATA)
  --license-file <파일>  라이선스 키 파일
  --admin                마켓 관리 API(소스 등록·삭제, 갱신) 켜기 (기본 꺼짐, 환경 변수로는 켜지지 않음)
  -h, --help             도움말
`;

function toPort(text: string): number {
  if (!/^\d{1,5}$/.test(text)) throw new CliError("INVALID_PORT");
  const n = Number(text);
  if (n > 65535) throw new CliError("INVALID_PORT");
  return n;
}

export function parseCliArgs(argv: string[], env: Record<string, string | undefined>, home: string): CliCommand {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      allowPositionals: false,
      strict: true,
      options: {
        port: { type: "string" },
        host: { type: "string" },
        data: { type: "string" },
        "license-file": { type: "string" },
        admin: { type: "boolean" },
        help: { type: "boolean", short: "h" },
      },
    }));
  } catch {
    // 메시지에 사용자 입력이 섞일 수 있어 코드만 남긴다
    throw new CliError("INVALID_ARGS");
  }
  if (values.help) return { kind: "help" };

  const port = values.port !== undefined ? toPort(values.port) : env["AF_PORT"] ? toPort(env["AF_PORT"]) : DEFAULT_PORT;
  const host = values.host ?? (env["AF_HOST"] ? env["AF_HOST"] : DEFAULT_HOST);
  if (!/^[A-Za-z0-9._:[\]-]+$/.test(host)) throw new CliError("INVALID_HOST");
  const dataArg = values.data ?? (env["AF_MARKET_DATA"] ? env["AF_MARKET_DATA"] : undefined);
  if (dataArg === "") throw new CliError("INVALID_ARGS");
  let data = dataArg;
  if (data === undefined) {
    if (!home) throw new CliError("INVALID_ARGS", "home");
    data = join(home, ".agentforge", "data");
  }
  const licenseFile = values["license-file"];
  return { kind: "run", port, host, data, ...(licenseFile ? { licenseFile } : {}), admin: values.admin === true };
}
