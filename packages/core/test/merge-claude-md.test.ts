import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AppError, mergeClaudeMd } from "../src/index.js";

// DOC-03: CLAUDE.md 재생성 병합(design.md 8.1)

const IDS = ["PROJECT", "AGENTS", "DEVS", "SKILLS"] as const;
type Id = (typeof IDS)[number];
const sec = (id: Id, body: string) => `<!-- AGENTFORGE:${id}:BEGIN -->${body}<!-- AGENTFORGE:${id}:END -->`;
const doc = (outer: string[], bodies: Record<Id, string>) =>
  `${outer[0]}${sec("PROJECT", bodies.PROJECT)}${outer[1]}${sec("AGENTS", bodies.AGENTS)}${outer[2]}${sec("DEVS", bodies.DEVS)}${outer[3]}${sec("SKILLS", bodies.SKILLS)}${outer[4]}`;

const body = (s: string) => `\n${s}\n`;
const O = { PROJECT: body("old-p"), AGENTS: body("old-a"), DEVS: body("old-d"), SKILLS: body("old-s") };
const N = { PROJECT: body("new-p"), AGENTS: body("new-a"), DEVS: body("new-d"), SKILLS: body("new-s") };

// 마커 문자열이 섞이지 않는 임의 텍스트
const text = fc.string({ maxLength: 40 }).filter((s) => !s.includes("AGENTFORGE") && !s.includes("<!--"));
const bodies = fc.record({ PROJECT: text, AGENTS: text, DEVS: text, SKILLS: text });
const outers = fc.array(text, { minLength: 5, maxLength: 5 });

describe("mergeClaudeMd 단위", () => {
  it("규칙 1~3: 마커 밖은 old, AGENTS·DEVS·SKILLS 는 next, PROJECT 는 old", () => {
    const old = doc(["# 내 제목\n", "\n사용자 메모\n", "\n", "\n", "\n끝\n"], O);
    const next = doc(["# 다른 제목\n", "\n", "\n", "\n", "\n"], N);
    expect(mergeClaudeMd(old, next)).toBe(doc(["# 내 제목\n", "\n사용자 메모\n", "\n", "\n", "\n끝\n"], { ...O, AGENTS: N.AGENTS, DEVS: N.DEVS, SKILLS: N.SKILLS }));
  });

  it("규칙 4: next 에만 있는 구간은 old 끝에 붙이고 끝 줄바꿈을 1개로 맞춘다", () => {
    const old = `사용자\n${sec("PROJECT", O.PROJECT)}\n\n\n`;
    const next = doc(["", "\n", "\n", "\n", "\n"], N);
    const out = mergeClaudeMd(old, next);
    expect(out.startsWith(`사용자\n${sec("PROJECT", O.PROJECT)}\n`)).toBe(true);
    expect(out).toContain(sec("AGENTS", N.AGENTS));
    expect(out.indexOf("AGENTS:BEGIN")).toBeLessThan(out.indexOf("DEVS:BEGIN"));
    expect(out.indexOf("DEVS:BEGIN")).toBeLessThan(out.indexOf("SKILLS:BEGIN"));
    expect(out).not.toContain("new-p");
    expect(out.endsWith("\n")).toBe(true);
  });

  it("규칙 5: old 에 마커가 없으면 사용자 파일로 보고 구간 4개를 끝에 붙인다", () => {
    const old = "# 내 CLAUDE.md\n직접 쓴 규칙\n";
    const next = doc(["", "\n", "\n", "\n", "\n"], N);
    const out = mergeClaudeMd(old, next);
    expect(out.startsWith(old)).toBe(true);
    for (const id of IDS) expect(out).toContain(sec(id, N[id]));
  });

  it("규칙 6: 두 번 병합해도 같다", () => {
    const old = "# 메모\n";
    const next = doc(["", "\n", "\n", "\n", "\n"], N);
    const once = mergeClaudeMd(old, next);
    expect(mergeClaudeMd(once, next)).toBe(once);
  });

  it("next 에 없는 구간은 old 그대로 둔다", () => {
    const old = doc(["", "\n", "\n", "\n", "\n"], O);
    const next = `${sec("AGENTS", N.AGENTS)}\n`;
    expect(mergeClaudeMd(old, next)).toBe(doc(["", "\n", "\n", "\n", "\n"], { ...O, AGENTS: N.AGENTS }));
  });

  it.each([
    ["END 누락(old)", `${"<!-- AGENTFORGE:AGENTS:BEGIN -->x"}`, "", "AGENTS"],
    ["BEGIN 누락(old)", "x<!-- AGENTFORGE:DEVS:END -->", "", "DEVS"],
    ["중복(old)", `${sec("SKILLS", "a")}${sec("SKILLS", "b")}`, "", "SKILLS"],
    ["순서 뒤집힘(old)", "<!-- AGENTFORGE:PROJECT:END -->x<!-- AGENTFORGE:PROJECT:BEGIN -->", "", "PROJECT"],
    ["END 누락(next)", "", "<!-- AGENTFORGE:AGENTS:BEGIN -->x", "AGENTS"],
  ])("마커 짝 오류 %s → CLAUDE_MD_MARKERS", (_n, o, n, id) => {
    try {
      mergeClaudeMd(o, n);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("CLAUDE_MD_MARKERS");
      expect((e as AppError).params).toEqual({ id });
    }
  });
});

describe("mergeClaudeMd 속성", () => {
  it("마커 밖 텍스트는 보존된다", () => {
    fc.assert(
      fc.property(outers, bodies, bodies, (o, ob, nb) => {
        const out = mergeClaudeMd(doc(o, ob), doc(["", "", "", "", ""], nb));
        const expected = doc(o, { ...ob, AGENTS: nb.AGENTS, DEVS: nb.DEVS, SKILLS: nb.SKILLS });
        expect(out).toBe(expected);
      }),
    );
  });

  it("PROJECT 구간은 old 내용을 유지한다", () => {
    fc.assert(
      fc.property(outers, bodies, bodies, (o, ob, nb) => {
        const out = mergeClaudeMd(doc(o, ob), doc(o, nb));
        expect(out).toContain(sec("PROJECT", ob.PROJECT));
      }),
    );
  });

  it("멱등: merge(merge(o,n),n) === merge(o,n) (마커 없는 old 포함)", () => {
    fc.assert(
      fc.property(text, outers, bodies, bodies, fc.boolean(), (plain, o, ob, nb, hasMarkers) => {
        const old = hasMarkers ? doc(o, ob) : plain;
        const next = doc(["", "\n", "\n", "\n", "\n"], nb);
        const once = mergeClaudeMd(old, next);
        expect(mergeClaudeMd(once, next)).toBe(once);
      }),
    );
  });

  it("next 의 AGENTS·DEVS·SKILLS 구간이 결과에 반영된다", () => {
    fc.assert(
      fc.property(text, bodies, (plain, nb) => {
        const out = mergeClaudeMd(plain, doc(["", "\n", "\n", "\n", "\n"], nb));
        for (const id of ["AGENTS", "DEVS", "SKILLS"] as const) expect(out).toContain(sec(id, nb[id]));
      }),
    );
  });
});

describe("mergeClaudeMd 구간 겹침(review-1 반려)", () => {
  const b = (id: Id) => `<!-- AGENTFORGE:${id}:BEGIN -->`;
  const e = (id: Id) => `<!-- AGENTFORGE:${id}:END -->`;
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (err) {
      return err instanceof AppError ? { code: err.code, params: err.params } : String(err);
    }
    return "no-throw";
  };

  it("엇갈린 구간(A:BEGIN D:BEGIN A:END D:END)은 뒤 구간 ID 로 오류", () => {
    const bad = `${b("AGENTS")}x${b("DEVS")}y${e("AGENTS")}z${e("DEVS")}`;
    expect(code(() => mergeClaudeMd(bad, ""))).toEqual({ code: "CLAUDE_MD_MARKERS", params: { id: "DEVS" } });
    expect(code(() => mergeClaudeMd("", bad))).toEqual({ code: "CLAUDE_MD_MARKERS", params: { id: "DEVS" } });
  });

  it("포함된 구간(PROJECT ⊂ AGENTS)은 PROJECT 내용을 잃지 않고 오류", () => {
    const bad = `${b("AGENTS")}${b("PROJECT")}소중${e("PROJECT")}${e("AGENTS")}`;
    expect(code(() => mergeClaudeMd(bad, doc(["", "", "", "", ""], N)))).toEqual({ code: "CLAUDE_MD_MARKERS", params: { id: "PROJECT" } });
  });

  it("속성: 정상 병합 결과의 구간은 서로 겹치지 않는다", () => {
    fc.assert(
      fc.property(outers, bodies, bodies, (o, ob, nb) => {
        const out = mergeClaudeMd(doc(o, ob), doc(o, nb));
        const spans = IDS.map((id) => [out.indexOf(b(id)), out.indexOf(e(id)) + e(id).length] as const).sort((x, y) => x[0] - y[0]);
        for (let i = 1; i < spans.length; i++) expect(spans[i - 1]![1]).toBeLessThanOrEqual(spans[i]![0]);
      }),
    );
  });

  it("속성: 마커 없는 old 이면 결과는 old(끝 줄바꿈 제외)로 시작한다", () => {
    fc.assert(
      fc.property(text, bodies, (plain, nb) => {
        const out = mergeClaudeMd(plain, doc(["", "\n", "\n", "\n", "\n"], nb));
        expect(out.startsWith(plain.replace(/(\r?\n)+$/, ""))).toBe(true);
      }),
    );
  });

  it("CRLF 끝 줄바꿈도 1개로 정리해 붙인다", () => {
    const out = mergeClaudeMd("메모\r\n\r\n", doc(["", "\n", "\n", "\n", "\n"], N));
    expect(out.startsWith("메모\n\n<!-- AGENTFORGE:PROJECT:BEGIN -->")).toBe(true);
  });
});
