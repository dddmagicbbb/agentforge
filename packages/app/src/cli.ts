// agentforge 명령 진입점. 외부 접속 없이 실행한다.
import { homedir } from "node:os";
import process from "node:process";
import { CliError, HELP_TEXT, parseCliArgs } from "./args.js";
import { startApp } from "./run.js";

const MESSAGES: Record<string, string> = {
  INVALID_ARGS: "인자가 올바르지 않습니다. agentforge --help 를 확인하세요.",
  INVALID_PORT: "포트는 0~65535 사이 숫자여야 합니다.",
  INVALID_HOST: "host 값이 올바르지 않습니다.",
  LICENSE_FILE: "라이선스 파일을 읽을 수 없습니다.",
};

async function main(): Promise<void> {
  const cmd = parseCliArgs(process.argv.slice(2), process.env, homedir());
  if (cmd.kind === "help") {
    process.stdout.write(HELP_TEXT);
    return;
  }
  const app = await startApp(cmd);
  process.stdout.write(`AgentForge: http://${app.address.host}:${app.address.port}\n`);

  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e: unknown) => {
  if (e instanceof CliError) process.stderr.write(`${MESSAGES[e.code] ?? e.code}\n`);
  else if ((e as { code?: string }).code === "EADDRINUSE") process.stderr.write("이미 사용 중인 포트입니다. --port 로 다른 포트를 지정하세요.\n");
  else process.stderr.write("기동에 실패했습니다.\n");
  process.exit(e instanceof CliError ? 2 : 1);
});
