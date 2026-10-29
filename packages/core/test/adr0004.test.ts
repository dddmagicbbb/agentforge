import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/index.js";
import { build, find } from "./fixtures.js";

// ADR-0004: 정적 스크립트·생성 스킬 템플릿 보정이 생성 파일에 반영됐는지 확인한다(동작 시험은 tests/scripts bats).

const hasBash = (() => {
  try {
    execFileSync("bash", ["-c", "exit 0"]);
    return true;
  } catch {
    return false;
  }
})();

const files = build();
const setup = find(files, "scripts/setup.sh");
const guard = find(files, ".claude/hooks/guard-paths.sh");
const integrate = find(files, "scripts/integrate.sh");
const wait = find(files, "scripts/wait-and-review.sh");
const check = find(files, "scripts/check-forge.sh");
const forgeAgents = find(files, ".claude/skills/forge-agents/SKILL.md");

describe("ADR-0004 T-404 정적 스크립트", () => {
  it("setup.sh: sed -i 없이 tr + mv, chmod 는 mv 뒤", () => {
    expect(setup).not.toContain("sed -i");
    expect(setup).toContain(`tr -d '\\r' < "$f" > "$f.af-tmp"`);
    expect(setup).toContain('mv "$f.af-tmp" "$f"');
    expect(setup.indexOf('mv "$f.af-tmp"')).toBeLessThan(setup.indexOf('chmod +x "$f"'));
  });

  it("guard-paths.sh: realpath 제거, 어휘 정규화 함수 존재", () => {
    expect(guard).not.toContain("realpath");
    expect(guard).toContain("normalize()");
  });

  it("guard-paths.sh: AF_AGENT 검사가 jq 검사보다 먼저, jq 부재 시 exit 2 와 안내 문구", () => {
    expect(guard.indexOf("AF_AGENT:-")).toBeLessThan(guard.indexOf("command -v jq"));
    expect(guard).toContain('echo "jq 가 없어 담당 범위를 검사할 수 없습니다. 설치 후 다시 실행하세요." >&2; exit 2;');
  });

  it("guard-paths.sh: 끝이 / 인 항목은 접두어, 아닌 항목은 완전 일치, 차단 문구 유지", () => {
    expect(guard).toContain('*/) case "$rel" in "$p"*) exit 0;; esac;;');
    expect(guard).toContain('*) [ "$rel" = "$p" ] && exit 0;;');
    expect(guard).toContain('echo "담당 범위 밖 파일입니다: $rel ($AF_AGENT). 수정하지 말고 report에 필요한 변경을 적은 뒤 멈추세요." >&2');
  });

  it("guard-paths.sh: 글롭 미확장(set -f, 따옴표 없는 for 확장 없음, 배열 분할)", () => {
    expect(guard).toMatch(/^set -f\b/m);
    expect(guard).not.toMatch(/for \w+ in \$/);
    expect(guard).toContain("read -r -d '' -a segs");
    expect(guard).toContain('for seg in "${segs[@]}"');
  });

  it("guard-paths.sh: here-string 미사용(끝 개행), 제어 문자 차단 분기와 문구", () => {
    expect(guard).not.toContain("<<<");
    expect(guard).toContain("< <(printf '%s' \"$1\")");
    expect(guard).toContain("explode | any(. < 32 or . == 127)");
    expect(guard).toContain('echo "경로에 제어 문자가 있어 수정을 막았습니다." >&2; exit 2;');
    // 제어 문자 검사는 빈 값 통과보다 앞(개행만 있는 경로가 빈 값으로 통과하지 않게)
    expect(guard.indexOf("경로에 제어 문자")).toBeLessThan(guard.indexOf('[ -z "$file" ] && exit 0'));
    // 제어 문자 검사는 file 값 변환(정규화) 앞에 있어야 한다
    expect(guard.indexOf("경로에 제어 문자")).toBeLessThan(guard.indexOf('file="$(normalize'));
  });

  it.skipIf(!hasBash)("guard-paths.sh normalize(): 끝 .. · . 도 정규화(bash 실행)", () => {
    const fn = /^normalize\(\) \{[\s\S]*?^\}$/m.exec(guard)?.[0];
    expect(fn).toBeDefined();
    const run = (p: string) => execFileSync("bash", ["-c", `set -u; set -f; ${fn}\nnormalize "$1"`, "bash", p], { encoding: "utf8" });
    expect(run("/r/src/order/..")).toBe("/r/src");
    expect(run("/r/src/order/x/../..")).toBe("/r/src");
    expect(run("/r/src/order/.")).toBe("/r/src/order");
    expect(run("/r/src/order/")).toBe("/r/src/order");
    expect(run("/r//src/./order/../a")).toBe("/r/src/a");
    expect(run("/..")).toBe("/");
  });

  it("guard-paths.sh: jq 해석 실패는 exit 2 와 안내 문구(fail-closed)", () => {
    expect(guard).toContain('echo "hook 입력을 해석하지 못해 수정을 막았습니다." >&2; exit 2;');
  });

  it("setup.sh: tr 실패가 set -e 를 우회하지 않도록 mv 와 분리", () => {
    expect(setup).not.toMatch(/tr -d '\\r'[^\n]*&& mv/);
    expect(setup).toContain("CR 제거 실패");
  });

  it("integrate.sh: 충돌 시 abort 후 reset --hard pre-integration, 안내문 일치", () => {
    expect(integrate).toMatch(/git merge --abort\n\s+git reset --hard pre-integration\n/);
    expect(integrate).toContain("develop 을 pre-integration 태그 상태로 되돌렸습니다.");
    expect(integrate).not.toContain("태그 상태로 유지");
  });

  it("wait-and-review.sh: 이력 이름 충돌 시 .<초>.<n> 순번, count 는 기존 패턴", () => {
    expect(wait).toContain('while [ -e "$dest" ]; do n=$((n + 1)); dest="$base.$n"; done');
    expect(wait).toContain('-name "$1.*"');
  });
});

describe("ADR-0004 T-403 자리표시 검사", () => {
  it("check-forge.sh: 7번째 항목이 6항목 뒤에 있고 forge-agents 지시문은 제외", () => {
    expect(check.indexOf("# 6)")).toBeLessThan(check.indexOf("# 7)"));
    expect(check).toContain("채우지 않은 자리표시");
    expect(check).toContain("[A-Z_]+");
    expect(check).toContain('[ "$f" = ".claude/skills/forge-agents/SKILL.md" ] && continue');
  });

  it("forge-agents 의 자리표시 목록이 dev.tpl.md·review.tpl.md 의 실제 집합과 같다", () => {
    const tokens = (s: string) => new Set(s.match(/\{\{[A-Z_]+\}\}/g) ?? []);
    const line = forgeAgents.split("\n").find((l) => l.includes("템플릿의 자리표시")) ?? "";
    const listed = tokens(line);
    const actual = new Set([...tokens(TEMPLATES["md/dev.tpl.md"]), ...tokens(TEMPLATES["md/review.tpl.md"])]);
    expect([...listed].sort()).toEqual([...actual].sort());
    for (const t of listed) expect(forgeAgents).toContain(`- \`${t}\` :`);
    expect(forgeAgents).not.toContain("{{PATHS}}");
  });

  it("forge-agents 스킬은 disable-model-invocation 유지(GEN-01)", () => {
    expect(forgeAgents).toMatch(/^disable-model-invocation: true$/m);
  });
});
