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
