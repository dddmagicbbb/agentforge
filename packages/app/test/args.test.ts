import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CliError, HELP_TEXT, parseCliArgs } from "../src/args.js";

const HOME = "/home/u";
const parse = (argv: string[], env: Record<string, string | undefined> = {}) => parseCliArgs(argv, env, HOME);

describe("parseCliArgs", () => {
  it("기본값: 3456 / 127.0.0.1 / ~/.agentforge/data / admin 꺼짐", () => {
    const c = parse([]);
    expect(c).toEqual({ kind: "run", port: 3456, host: "127.0.0.1", data: join(HOME, ".agentforge", "data"), admin: false });
  });

  it("모든 인자를 읽는다", () => {
    const c = parse(["--port", "4000", "--host", "0.0.0.0", "--data", "/d", "--license-file", "/l.key", "--admin"]);
    expect(c).toEqual({ kind: "run", port: 4000, host: "0.0.0.0", data: "/d", licenseFile: "/l.key", admin: true });
  });

  it("--port=4000 형태도 받는다", () => {
    expect(parse(["--port=4000"])).toMatchObject({ port: 4000 });
  });

  it("환경 변수 PORT·HOST·AF_MARKET_DATA 는 기본값을 대신하고 인자가 우선한다 (Docker)", () => {
    const env = { PORT: "5000", HOST: "0.0.0.0", AF_MARKET_DATA: "/data" };
    expect(parse([], env)).toMatchObject({ port: 5000, host: "0.0.0.0", data: "/data" });
    expect(parse(["--port", "6000"], env)).toMatchObject({ port: 6000 });
  });

  it("AF_MARKET_ADMIN=1 이면 --admin 없이도 관리 API 를 켠다 (Docker), 다른 값은 꺼짐", () => {
    expect(parse([], { AF_MARKET_ADMIN: "1" })).toMatchObject({ admin: true });
    expect(parse([], { AF_MARKET_ADMIN: "true" })).toMatchObject({ admin: false });
  });

  it("--help / -h", () => {
    expect(parse(["--help"])).toEqual({ kind: "help" });
    expect(parse(["-h"])).toEqual({ kind: "help" });
    expect(HELP_TEXT).toContain("--port");
    expect(HELP_TEXT).toContain("--admin");
  });

  it.each([["abc"], ["-1"], ["65536"], ["1.5"], [""]])("잘못된 포트 %j 는 INVALID_PORT", (p) => {
    expect(() => parse([`--port=${p}`])).toThrowError(expect.objectContaining({ code: "INVALID_PORT" }));
  });

  it("환경 변수 PORT 가 잘못돼도 INVALID_PORT", () => {
    expect(() => parse([], { PORT: "x" })).toThrowError(CliError);
  });

  it("알 수 없는 옵션·값 누락·위치 인자는 INVALID_ARGS", () => {
    for (const argv of [["--nope"], ["--port"], ["extra"], ["--admin=1"]]) {
      expect(() => parse(argv), argv.join(" ")).toThrowError(expect.objectContaining({ code: "INVALID_ARGS" }));
    }
  });

  it("host 에 공백이 있거나 비어 있으면 INVALID_HOST", () => {
    expect(() => parse(["--host", "a b"])).toThrowError(expect.objectContaining({ code: "INVALID_HOST" }));
    expect(() => parse(["--host", ""])).toThrowError(expect.objectContaining({ code: "INVALID_HOST" }));
  });

  it("홈 폴더를 알 수 없고 --data 도 없으면 INVALID_ARGS", () => {
    expect(() => parseCliArgs([], {}, "")).toThrowError(expect.objectContaining({ code: "INVALID_ARGS" }));
  });
});
