import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checks, defaultDraft, TEMPLATES } from "../src/index.js";
import { build, find } from "./fixtures.js";

// T-603 PRV-03 check-models.sh / T-604 VSC-02 Dev Container (design.md 8.3·8.4)

describe("PRV-03 check-models.sh", () => {
  it("항상 생성되고 mode 755, 정적 원문 그대로다", () => {
    for (const patch of [() => {}, (d: ReturnType<typeof defaultDraft>) => (d.uiDesign = false)]) {
      const f = build(patch).find((x) => x.path === "scripts/check-models.sh");
      expect(f?.mode).toBe(0o755);
      expect(f?.content).toBe(TEMPLATES["static/check-models.sh"]);
    }
  });
  it("판정·출력 계약 문구를 가진다", () => {
    const s = TEMPLATES["static/check-models.sh"] ?? "";
    for (const k of ["AF_CHECK_TIMEOUT:-120", "command -v timeout", "--output-format json --max-turns 3", ".is_error", ".num_turns", "모델 점검: 통과 $pass · 경고 $warn · 실패 $fail", "source scripts/agent-env.sh"]) {
      expect(s, k).toContain(k);
    }
    expect(s).toContain("Read 도구로 .agentforge/forge.config.json 을 읽고 project 값만 한 단어로 답하세요.");
  });
  it("VS Code 7번째 작업", () => {
    const t = JSON.parse(find(build(), ".vscode/tasks.json")) as { tasks: { label: string; command: string }[] };
    expect(t.tasks).toHaveLength(7);
    expect(t.tasks[6]).toMatchObject({ label: "AF: 모델 점검", command: "bash scripts/check-models.sh" });
  });
});

describe("VSC-02 Dev Container", () => {
  it("미지정·false 면 파일과 README 안내가 없다", () => {
    for (const patch of [() => {}, (d: ReturnType<typeof defaultDraft>) => (d.devcontainer = false)]) {
      const f = build(patch);
      expect(f.some((x) => x.path.startsWith(".devcontainer/"))).toBe(false);
      expect(find(f, "README.md")).not.toContain("devcontainer");
    }
  });
  it("true 면 8.4 JSON(name=slug, 644)과 README 폐쇄망 안내", () => {
    const f = build((d) => (d.devcontainer = true));
    const file = f.find((x) => x.path === ".devcontainer/devcontainer.json");
    expect(file?.mode).toBe(0o644);
    expect(JSON.parse(file!.content)).toEqual({
      name: "order-portal",
      image: "mcr.microsoft.com/devcontainers/javascript-node:22",
      postCreateCommand: "sudo apt-get update && sudo apt-get install -y tmux jq && npm install -g @anthropic-ai/claude-code",
      remoteEnv: { AF_IN_CONTAINER: "1" },
    });
    expect(file!.content.endsWith("\n")).toBe(true);
    expect(find(f, "README.md")).toContain("사내 레지스트리");
  });
  it("checks: devcontainer true 일 때만 DEVCONTAINER_CLOSED_NET info", () => {
    const d = defaultDraft();
    expect(checks(d).some((i) => i.code === "DEVCONTAINER_CLOSED_NET")).toBe(false);
    d.devcontainer = true;
    const i = checks(d).find((x) => x.code === "DEVCONTAINER_CLOSED_NET");
    expect(i?.level).toBe("info");
  });
});

// check-models.sh 동작 시험: 가짜 claude 가 JSON 을 내는 방식(bash·jq·git 이 있을 때만).
// 주의: Windows 에서 execFileSync("bash") 는 PATH 순서에 따라 WSL(System32) bash 일 수 있다. Git Bash 가 앞서야 한다.
const have = (cmd: string, arg: string) => {
  try {
    execFileSync(cmd, [arg], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const canRun = have("bash", "--version") && have("jq", "--version") && have("git", "--version");

describe.skipIf(!canRun)("PRV-03 check-models.sh 동작", () => {
  function run(args: string[]): { out: string; rc: number } {
    const dir = mkdtempSync(join(tmpdir(), "af-cm-"));
    try {
      mkdirSync(join(dir, "scripts"));
      mkdirSync(join(dir, ".agentforge"));
      mkdirSync(join(dir, "bin"));
      writeFileSync(join(dir, "scripts/check-models.sh"), TEMPLATES["static/check-models.sh"] ?? "");
      writeFileSync(join(dir, "scripts/agent-env.sh"), 'export ANTHROPIC_MODEL="m-$1"\n');
      writeFileSync(join(dir, ".agentforge/forge.config.json"), JSON.stringify({ project: "demo", agents: { ok: {}, str: {}, err: {} } }));
      writeFileSync(
        join(dir, "bin/claude"),
        `#!/usr/bin/env bash\ncase "$2" in\n  ok) echo '{"result":"demo","num_turns":2}' ;;\n  str) echo '{"result":"demo","num_turns":"x"}' ;;\n  *) echo '{"is_error":true}' ;;\nesac\n`,
        { mode: 0o755 },
      );
      const r = spawnSync("bash", ["-c", 'export PATH="$PWD/bin:$PATH"; bash scripts/check-models.sh "$@"', "bash", ...args], { cwd: dir, encoding: "utf8" });
      return { out: r.stdout, rc: r.status ?? -1 };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("통과·경고(num_turns 가 숫자 아님)·실패 집계와 종료 코드", () => {
    const r = run([]);
    expect(r.out).toContain("✓ ok 통과 (m-ok)");
    expect(r.out).toContain("! str 경고: 도구 호출을 확인하지 못함");
    expect(r.out).toContain("✗ err 실패: 모델이 오류를 반환");
    expect(r.out).toContain("모델 점검: 통과 1 · 경고 1 · 실패 1");
    expect(r.rc).toBe(1);
  });
  it("경고만 있으면 종료 코드 0", () => {
    const r = run(["str"]);
    expect(r.out).toContain("모델 점검: 통과 0 · 경고 1 · 실패 0");
    expect(r.rc).toBe(0);
  });
  it("빈 에이전트 이름은 고정 문구의 실패 줄을 출력한다", () => {
    const r = run([""]);
    expect(r.out).toContain("✗ (빈 이름) 실패: 에이전트 이름 없음");
    expect(r.rc).toBe(1);
  });
});
