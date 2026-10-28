import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canExport, checks, defaultDraft, render, validate, type Issue, type ProjectInput } from "../src/index.js";

// T-405 PRV-02·PRV-04

const codes = (i: Issue[]) => i.map((x) => x.code);
const run = (patch: (d: ProjectInput) => void = () => {}) => {
  const d = defaultDraft();
  patch(d);
  return checks(d);
};
const claude = { provider: "claude" as const, model: "sonnet" };
/** 경고·정보 없는 깨끗한 구성 */
const clean = (d: ProjectInput) => {
  d.devs.forEach((x) => ((x.dev = { ...claude }), (x.review = { ...claude })));
  d.devs[0]!.domain = "order";
  d.devs[0]!.paths = ["src/order/"];
  d.devs[1]!.domain = "pay";
  d.devs[1]!.paths = ["src/pay/"];
  d.devs[2]!.domain = "adm";
  d.devs[2]!.paths = ["src/adm/"];
};

describe("checks 코드 12종", () => {
  it("깨끗한 구성은 ALL_OK 하나", () => {
    expect(run(clean)).toEqual([{ level: "ok", code: "ALL_OK", path: [], params: {} }]);
  });

  it("기본 초안: 무료 모델 warn 이 있어 ALL_OK 가 없다", () => {
    expect(codes(run())).toEqual(["OPENROUTER_FREE_LIMIT", "VLLM_TOOL_PARSER"]);
  });

  it("NAME_INVALID(error)", () => {
    const r = run((d) => (d.name = "Bad Name"));
    expect(r.find((i) => i.code === "NAME_INVALID")?.level).toBe("error");
  });

  it("REQ_SHORT(warn): 30자 미만만", () => {
    expect(codes(run((d) => (d.requirement = "x".repeat(29))))).toContain("REQ_SHORT");
    expect(codes(run((d) => (d.requirement = "x".repeat(30))))).not.toContain("REQ_SHORT");
    expect(run((d) => (d.requirement = "짧음")).find((i) => i.code === "REQ_SHORT")?.level).toBe("warn");
  });

  it("PATH_OVERLAP(error): 접두어 겹침, 정규화 후 src/order 와 src/orders 는 안 겹침", () => {
    const r = run((d) => {
      d.devs[0]!.paths = ["src/a/"];
      d.devs[1]!.paths = ["src/a/b/"];
    });
    const o = r.find((i) => i.code === "PATH_OVERLAP");
    expect(o?.level).toBe("error");
    expect(o?.params).toEqual({ devA: 1, pathA: "src/a/", devB: 2, pathB: "src/a/b/" });
    const none = run((d) => {
      d.devs[0]!.paths = ["src/order"];
      d.devs[1]!.paths = ["src/orders"];
    });
    expect(codes(none)).not.toContain("PATH_OVERLAP");
  });

  it("DEV_DEFERRED(info): 비어 있는 dev 마다", () => {
    const r = run((d) => {
      d.devs[1]!.domain = "";
      d.devs[1]!.paths = [];
    });
    expect(r.filter((i) => i.code === "DEV_DEFERRED").map((i) => i.params)).toEqual([{ dev: 2 }]);
  });

  it("MODEL_MISSING(error): 비 claude 모델 빈 값, uiDesign=false 면 ux-designer 제외", () => {
    const r = run((d) => (d.devs[0]!.dev = { provider: "ollama", model: " " }));
    expect(r.find((i) => i.code === "MODEL_MISSING")?.params).toEqual({ agent: "dev-1" });
    const off = run((d) => {
      d.uiDesign = false;
      d.agents["ux-designer"] = { provider: "ollama", model: "" };
    });
    expect(codes(off)).not.toContain("MODEL_MISSING");
    const on = run((d) => (d.agents["ux-designer"] = { provider: "ollama", model: "" }));
    expect(on.find((i) => i.code === "MODEL_MISSING")?.params).toEqual({ agent: "ux-designer" });
  });

  it("REVIEW_WEAKER(warn): dev 가 claude 인데 review 가 아님", () => {
    const r = run((d) => {
      clean(d);
      d.devs[1]!.review = { provider: "ollama", model: "qwen" };
    });
    expect(r.find((i) => i.code === "REVIEW_WEAKER")).toMatchObject({ level: "warn", params: { dev: 2 } });
    expect(codes(r)).not.toContain("ALL_OK");
  });

  it("OPENROUTER_FREE_LIMIT(warn): :free 모델 에이전트 수", () => {
    const r = run();
    expect(r.find((i) => i.code === "OPENROUTER_FREE_LIMIT")).toMatchObject({ level: "warn", params: { count: 1 } });
  });

  it("GATEWAY_REQUIRED·VLLM_TOOL_PARSER(info)", () => {
    const g = run((d) => {
      clean(d);
      d.agents.planner = { provider: "openai", model: "gpt-5.5" };
    });
    expect(g.map((i) => [i.level, i.code])).toEqual([["ok", "ALL_OK"], ["info", "GATEWAY_REQUIRED"]]);
    const v = run((d) => {
      clean(d);
      d.devs[0]!.dev = { provider: "vllm", model: "m" };
    });
    expect(v.map((i) => [i.level, i.code])).toEqual([["ok", "ALL_OK"], ["info", "VLLM_TOOL_PARSER"]]);
  });

  it("IMPORT_UNACKED(error): flags 있고 미확인", () => {
    const imp = (ack: boolean) => (d: ProjectInput) =>
      d.imported.push({ id: "x-skill", src: "s", trust: "unverified", desc: "", flags: ["shell"], target: "all", acknowledged: ack });
    const r = run(imp(false));
    expect(r.find((i) => i.code === "IMPORT_UNACKED")).toMatchObject({ level: "error", params: { id: "x-skill" } });
    expect(codes(run(imp(true)))).not.toContain("IMPORT_UNACKED");
  });

  it("UI_OFF(info)", () => {
    const r = run((d) => {
      clean(d);
      d.uiDesign = false;
    });
    expect(r.map((i) => [i.level, i.code])).toEqual([["ok", "ALL_OK"], ["info", "UI_OFF"]]);
  });

  it("출력 순서는 PoC 와 같다", () => {
    const r = run((d) => {
      clean(d);
      d.name = "X";
      d.requirement = "";
      d.devs[0]!.paths = ["src/"];
      d.devs[2]!.domain = "";
      d.devs[2]!.paths = [];
      d.devs[1]!.dev = { provider: "vllm", model: "" };
      d.devs[1]!.review = { provider: "openrouter", model: "a:free" };
      d.agents.planner = { provider: "gemini", model: "g" };
      d.imported.push({ id: "z", src: "s", trust: "community", desc: "", flags: ["f"], target: "dev", acknowledged: false });
      d.uiDesign = false;
    });
    expect(codes(r)).toEqual([
      "NAME_INVALID", "REQ_SHORT", "PATH_OVERLAP", "DEV_DEFERRED", "MODEL_MISSING", "OPENROUTER_FREE_LIMIT",
      "GATEWAY_REQUIRED", "VLLM_TOOL_PARSER", "IMPORT_UNACKED", "UI_OFF",
    ]);
  });
});

describe("canExport", () => {
  it("error 가 있으면 false", () => {
    expect(canExport(run((d) => (d.name = "X")))).toBe(false);
  });
  it("warn·info 만이면 true", () => {
    expect(canExport(run())).toBe(true);
    expect(canExport([])).toBe(true);
  });
});

describe("checks 견고성", () => {
  it("검증 전 깨진 입력에도 throw 하지 않는다", () => {
    fc.assert(
      fc.property(fc.anything(), (v) => {
        const r = checks(v as ProjectInput);
        expect(Array.isArray(r)).toBe(true);
      }),
      { numRuns: 200 },
    );
    expect(() => checks({} as ProjectInput)).not.toThrow();
    expect(() => checks({ devs: [null, 3, { paths: [1, "a"] }], agents: { planner: null }, imported: [null] } as unknown as ProjectInput)).not.toThrow();
  });
});

describe("PRV-02 게이트웨이 파일 조건부 생성", () => {
  const paths = (patch: (d: ProjectInput) => void) => {
    const d = defaultDraft();
    patch(d);
    return render(validate(d).project!).map((f) => f.path);
  };
  it("openai/gemini 를 쓰지 않으면 litellm.yaml·start-gateway.sh 가 없다", () => {
    const p = paths(() => {});
    expect(p).not.toContain(".agentforge/litellm.yaml");
    expect(p).not.toContain("scripts/start-gateway.sh");
  });
  it("쓰면 둘 다 생긴다", () => {
    const p = paths((d) => (d.agents.planner = { provider: "gemini", model: "gemini-3-pro" }));
    expect(p).toContain(".agentforge/litellm.yaml");
    expect(p).toContain("scripts/start-gateway.sh");
  });
});
