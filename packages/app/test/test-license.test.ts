import { describe, expect, it } from "vitest";
import { loadTestKeys } from "../src/test-license.js";

const HEX = "ab".repeat(32);

describe("시험 빌드 전용 공개 키 로더", () => {
  it("유효한 hex 면 kid test 로 돌려준다", () => {
    expect(loadTestKeys({ AF_LICENSE_TEST_PUBKEY: HEX }, () => {})).toEqual({ test: HEX });
  });
  it("없으면 undefined", () => {
    expect(loadTestKeys({}, () => {})).toBeUndefined();
  });
  it("형식이 틀리면 무시하고 경고 1줄(값 미출력)", () => {
    const w: string[] = [];
    expect(loadTestKeys({ AF_LICENSE_TEST_PUBKEY: "zz-secret" }, (m) => w.push(m))).toBeUndefined();
    expect(w).toHaveLength(1);
    expect(w[0]).not.toContain("zz-secret");
  });
});
