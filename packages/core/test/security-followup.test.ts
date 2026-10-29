import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/index.js";
import { build, find } from "./fixtures.js";

// design.md 8.6: S-3(defaultMode)·S-4(검토 파일 확인)

describe("S-3 settings.json defaultMode", () => {
  it("permissions.defaultMode 가 default 이고 permissions 의 첫 키다", () => {
    const s = JSON.parse(find(build(), ".claude/settings.json")) as { permissions: Record<string, unknown> };
    expect(s.permissions["defaultMode"]).toBe("default");
    expect(Object.keys(s.permissions)[0]).toBe("defaultMode");
  });
  it("README 에 이유 한 줄이 있다", () => {
    expect(find(build(), "README.md")).toContain("기본 권한 모드");
  });
});

describe("S-4 정적 스크립트", () => {
  const integrate = TEMPLATES["static/integrate.sh"] ?? "";
  const wait = TEMPLATES["static/wait-and-review.sh"] ?? "";
  it("integrate.sh 는 checkout·tag 앞에서 검토 파일을 확인한다", () => {
    const chk = integrate.indexOf('git cat-file -e "feature/dev$i:docs/review/dev-$i.md"');
    expect(chk).toBeGreaterThan(-1);
    expect(chk).toBeLessThan(integrate.indexOf("git checkout develop"));
    expect(chk).toBeLessThan(integrate.indexOf("git tag -f"));
  });
  it("wait-and-review.sh 코드 검토 요청에 검토 파일 경로가 있다", () => {
    const line = wait.split("\n").find((l) => l.includes("코드 검토:")) ?? "";
    expect(line).toContain("docs/review/dev-$i.md");
    expect(line).toContain("커밋한 뒤");
  });
});
