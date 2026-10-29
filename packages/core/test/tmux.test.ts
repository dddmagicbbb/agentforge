import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/index.js";
import { build, find } from "./fixtures.js";

// RUN-04: tmux 배치·접두키·마우스·로그(design.md 8.2)

const TMUX = { layout: "grid", prefix: "C-a", mouse: true, logs: true } as const;
const cfg = (files: ReturnType<typeof build>) => find(files, ".agentforge/forge.config.json");

describe("RUN-04 config", () => {
  it("tmux 미지정이면 tmuxLayout: pair 만 쓰고 tmux 키는 없다", () => {
    const c = JSON.parse(cfg(build())) as Record<string, unknown>;
    expect(c["tmuxLayout"]).toBe("pair");
    expect("tmux" in c).toBe(false);
  });

  it("tmux 지정 시 tmuxLayout 값과 바로 뒤에 tmux {prefix, mouse, logs}", () => {
    const text = cfg(build((d) => (d.tmux = { ...TMUX })));
    const c = JSON.parse(text) as Record<string, unknown>;
    expect(c["tmuxLayout"]).toBe("grid");
    expect(c["tmux"]).toEqual({ prefix: "C-a", mouse: true, logs: true });
    const keys = Object.keys(c);
    expect(keys[keys.indexOf("tmuxLayout") + 1]).toBe("tmux");
    expect(Object.keys(c["tmux"] as object)).toEqual(["prefix", "mouse", "logs"]);
  });
});

describe("RUN-04 .gitignore", () => {
  it("기본값이면 logs 줄이 없다", () => {
    expect(find(build(), ".gitignore")).not.toContain(".agentforge/logs/");
  });
  it("tmux 지정이어도 logs false 면 불변", () => {
    const base = find(build(), ".gitignore");
    expect(find(build((d) => (d.tmux = { ...TMUX, logs: false })), ".gitignore")).toBe(base);
  });
  it("logs true 면 .agentforge/logs/ 가 추가된다", () => {
    const g = find(build((d) => (d.tmux = { ...TMUX })), ".gitignore");
    expect(g.split("\n")).toContain(".agentforge/logs/");
  });
});

describe("RUN-04 run-agents.sh", () => {
  const s = TEMPLATES["static/run-agents.sh"] ?? "";
  it("config 에서 배치·접두키·마우스·로그를 기본값과 함께 읽는다", () => {
    expect(s).toContain(".tmuxLayout // \"pair\"");
    expect(s).toContain(".tmux.prefix // \"C-b\"");
    expect(s).toContain(".tmux.mouse // false");
    expect(s).toContain(".tmux.logs // false");
  });
  it("세 배치와 tiled 를 처리한다", () => {
    for (const l of ["pair", "grid", "role"]) expect(s).toContain(`${l})`);
    expect(s).toContain("select-layout");
    expect(s).toContain("tiled");
  });
  it("prefix·mouse 는 세션 범위(-t)로만 설정하고 전역(-g)은 쓰지 않는다", () => {
    expect(s).toMatch(/tmux set -t "\$name" prefix/);
    expect(s).toMatch(/tmux set -t "\$name" mouse on/);
    expect(s).not.toMatch(/set(-option)? +-g/);
  });
  it("logs 면 logs 폴더를 만들고 pane 마다 pipe-pane -o", () => {
    expect(s).toContain("mkdir -p");
    expect(s).toContain(".agentforge/logs");
    expect(s).toContain("pipe-pane -o");
  });
  it("모든 배치가 같은 함수로 panes 기록을 남기고, 안내 문구는 실제 접두키를 쓴다", () => {
    expect(s).toContain('> "$panes/$a"');
    expect(s).toContain("창 이동: $key 숫자");
    expect(s).toContain('key="$prefix"');
  });
});

describe("RUN-04 review-1 반려 대응", () => {
  const s = TEMPLATES["static/run-agents.sh"] ?? "";
  it("pipe-pane 은 bash 전용 printf %q 대신 POSIX 인용(sq)을 쓴다", () => {
    const line = s.split("\n").find((l) => l.includes("pipe-pane")) ?? "";
    expect(line).toContain("sq ");
    expect(line).not.toContain("%q");
  });
  it("grid·role 은 창의 마지막 pane 을 나눈다", () => {
    expect(s).toContain("list-panes");
    expect(s).toContain("tail -n1");
    expect(s).toMatch(/split-window[^\n]*-t "\$last"/);
  });
});

describe("RUN-04 sq() 동작(왕복)", () => {
  const ok = (cmd: string) => {
    try {
      execFileSync(cmd, ["-c", "exit 0"]);
      return true;
    } catch {
      return false;
    }
  };
  const hasShells = ok("bash") && ok("sh");
  const line = (TEMPLATES["static/run-agents.sh"] ?? "").split("\n").find((l) => l.startsWith("sq()")) ?? "";
  const cases = ["it's", "\'", "''", "a\nb", "공백 한글 경로", "$HOME", "`id`", "a\"b", "plain"];
  it.skipIf(!hasShells)("sq 결과를 /bin/sh 가 실행해도 원문과 같다", () => {
    expect(line).not.toBe("");
    for (const p of cases) {
      // 인자 대신 환경 변수로 넘긴다(Windows 에서 인자의 작은따옴표가 변형되는 것을 피함)
      const quoted = execFileSync("bash", [], { input: `${line}
sq "$P"`, encoding: "utf8", env: { ...process.env, P: p } });
      const back = execFileSync("sh", [], { input: `printf %s ${quoted}`, encoding: "utf8" });
      expect(back, JSON.stringify(p)).toBe(p);
    }
  });
});
