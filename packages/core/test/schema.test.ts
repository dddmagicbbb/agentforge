import { describe, expect, it } from "vitest";
import { AppError, defaultDraft, mergeClaudeMd, PathPrefix, TEMPLATES, validate, type ProjectInput } from "../src/index.js";

// 불변식 I1~I6과 입력 패턴(design.md 2.2·2.3) 검증

const codes = (input: unknown) => validate(input).issues.map((i) => i.code);

function draft(patch: (d: ProjectInput) => void = () => {}): ProjectInput {
  const d = defaultDraft();
  patch(d);
  return d;
}

describe("기본값", () => {
  it("PoC DEF()와 같은 기본 프로젝트는 오류 없이 통과한다", () => {
    const r = validate(defaultDraft());
    expect(r.issues).toEqual([]);
    expect(r.project?.name).toBe("order-portal");
  });

  it("담당 폴더는 끝에 / 가 붙은 형태로 정규화된다", () => {
    const r = validate(draft((d) => (d.devs[0]!.paths = ["src/order"])));
    expect(r.project?.devs[0]?.paths).toEqual(["src/order/"]);
  });
});

describe("불변식", () => {
  it("I1 developerCount ≠ devs.length 이면 DEV_COUNT_MISMATCH", () => {
    expect(codes(draft((d) => (d.developerCount = 2)))).toContain("DEV_COUNT_MISMATCH");
  });

  it("I2 등급 상한을 넘으면 DEV_COUNT_OVER_TIER", () => {
    const r = validate(defaultDraft(), { tierLimit: 2 });
    expect(r.issues.map((i) => i.code)).toContain("DEV_COUNT_OVER_TIER");
    expect(r.project).toBeUndefined();
  });

  it("I3 도메인만 있고 폴더가 없으면 DEV_PARTIAL", () => {
    expect(codes(draft((d) => (d.devs[1]!.paths = [])))).toContain("DEV_PARTIAL");
  });

  it("I3 도메인·폴더를 모두 비우면 통과한다(/forge-agents 위임)", () => {
    expect(codes(draft((d) => Object.assign(d.devs[2]!, { domain: "", paths: [] })))).toEqual([]);
  });

  it("I4 다른 개발자와 폴더 접두어가 겹치면 PATH_OVERLAP", () => {
    const r = validate(draft((d) => (d.devs[1]!.paths = ["src/"])));
    const overlap = r.issues.filter((i) => i.code === "PATH_OVERLAP");
    expect(overlap.length).toBeGreaterThan(0);
    expect(overlap[0]?.params).toMatchObject({ devA: 1, devB: 2 });
  });

  it("I4 src/order 와 src/orders 는 겹치지 않는다(D4)", () => {
    expect(codes(draft((d) => { d.devs[0]!.paths = ["src/order"]; d.devs[1]!.paths = ["src/orders"]; }))).toEqual([]);
  });

  it("I5 비 Claude 제공자에 모델이 없으면 MODEL_MISSING", () => {
    expect(codes(draft((d) => (d.devs[0]!.dev = { provider: "vllm", model: "" })))).toContain("MODEL_MISSING");
    expect(codes(draft((d) => (d.agents.planner = { provider: "openai", model: "" })))).toContain("MODEL_MISSING");
  });

  it("I5 Claude 는 모델이 비어도 통과한다(기본 sonnet)", () => {
    expect(codes(draft((d) => (d.agents.planner = { provider: "claude", model: "" })))).toEqual([]);
  });

  it("I6 위험 항목을 확인하지 않은 가져온 스킬은 IMPORT_UNACKED", () => {
    const imported = { id: "webapp-testing", src: "anthropics/skills", trust: "official" as const, desc: "", flags: ["scripts/ 포함"], target: "all" as const, acknowledged: false };
    expect(codes(draft((d) => (d.imported = [imported])))).toContain("IMPORT_UNACKED");
    expect(codes(draft((d) => (d.imported = [{ ...imported, acknowledged: true }])))).toEqual([]);
  });
});

describe("입력 패턴", () => {
  it.each(["Order Portal", "-x", "", "a/b", "한글"])("프로젝트 이름 %j 는 거부한다(REQ-02)", (name) => {
    expect(codes(draft((d) => (d.name = name)))).not.toEqual([]);
  });

  it("한글 도메인은 거부한다(D3)", () => {
    expect(codes(draft((d) => (d.devs[0]!.domain = "주문")))).not.toEqual([]);
  });

  it.each(["/abs/", "../x/", "src/../x", "./src", "src\\win", "a b/"])("담당 폴더 %j 는 거부한다", (p) => {
    expect(PathPrefix.safeParse(p).success).toBe(false);
  });

  it.each(["http://u:p@host:8000", "http://h/$(id)", "ftp://h", "http://h:80 x", "http://h/'"])("주소 %j 는 거부한다(D6)", (url) => {
    expect(codes(draft((d) => (d.connections.vllmUrl = url)))).not.toEqual([]);
  });

  it("명령에 줄바꿈이 있으면 거부한다", () => {
    expect(codes(draft((d) => (d.commands.test = "npm test\nrm -rf /")))).not.toEqual([]);
  });

  it("모델 ID에 셸 메타문자가 있으면 거부한다", () => {
    expect(codes(draft((d) => (d.devs[0]!.dev.model = "x;rm -rf /")))).not.toEqual([]);
  });
});

describe("PH2 골격", () => {
  it("템플릿 26종이 내장된다", () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(26);
    expect(TEMPLATES["md/dev.tpl.md"]).toContain("{{N}}");
  });

  it("미구현 API(mergeClaudeMd, P1)는 AppError(NOT_IMPLEMENTED)를 던진다", () => {
    expect(() => mergeClaudeMd("", "")).toThrow(AppError);
  });
});

describe("오류 코드", () => {
  it("패턴 위반은 패턴 코드(PROJECT_NAME 등)로 보고한다", () => {
    expect(codes(draft((d) => (d.name = "Order Portal")))).toEqual(["PROJECT_NAME"]);
    expect(codes(draft((d) => (d.devs[0]!.domain = "주문")))).toEqual(["DOMAIN"]);
  });

  // T-503 보안 점검: litellm.yaml·frontmatter 에 그대로 들어가므로 YAML 예약 문자(@ :)·옵션 모양(-)으로 시작하면 안 된다
  it("모델 ID 는 영문·숫자로 시작해야 한다(MODEL_ID)", () => {
    for (const m of ["@x", ":x", "-x", ".x", "/x"]) {
      expect(codes(draft((d) => (d.devs[0]!.dev = { provider: "openai", model: m })))).toEqual(["MODEL_ID"]);
    }
    for (const m of ["gpt-5.5", "qwen/qwen3-coder:free", "org/model@v2"]) {
      expect(codes(draft((d) => (d.devs[0]!.dev = { provider: "openai", model: m })))).toEqual([]);
    }
  });
});
