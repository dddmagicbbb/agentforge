import { fireEvent, render as mount, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORE_SKILLS, PROVIDERS, SEQ, defaultDraft, devSkill } from "@agentforge/core";
import { App } from "../src/App";
import { ModelPicker } from "../src/components/ModelPicker";
import { StepSkills } from "../src/steps/StepSkills";

const goto = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!);
const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

describe("W1 core export 사용(화면 사본 제거)", () => {
  it("ModelPicker 의 제공자 목록·추천 모델이 core PROVIDERS 와 같다", () => {
    mount(<ModelPicker id="x" value={{ provider: "ollama", model: "" }} onChange={() => undefined} />);
    const opts = within(screen.getByLabelText("x 제공자")).getAllByRole("option").map((o) => o.getAttribute("value"));
    expect(opts).toEqual(PROVIDERS.map((p) => p.id));
    const dl = [...document.querySelectorAll("datalist option")].map((o) => o.getAttribute("value"));
    expect(dl).toEqual([...PROVIDERS.find((p) => p.id === "ollama")!.models]);
  });

  it("스킬 화면이 core CORE_SKILLS·devSkill 을 그대로 쓴다", () => {
    mount(<StepSkills draft={defaultDraft()} patch={() => undefined} />);
    for (const k of CORE_SKILLS) expect(screen.getByText(k.id)).toBeInTheDocument();
    expect(screen.getByText(devSkill(defaultDraft().devs[0]!, 1))).toBeInTheDocument();
  });

  it("순차 단계 표가 core SEQ 순서(+통합 검증)와 같다", () => {
    mount(<App />);
    goto(2);
    const ids = [...SEQ.map((s) => s.id), "integrator"];
    for (const id of ids) expect(screen.getByLabelText(`${id} 제공자`)).toBeInTheDocument();
  });

  it("catalog.ts·agents.ts 에 제공자·스킬 사본 리터럴이 없다", () => {
    expect(src("../src/catalog.ts")).not.toMatch(/exaone-32b|qwen3-coder|"conventions"/);
    expect(src("../src/agents.ts")).not.toMatch(/"integrator"|"ux-designer"/);
  });
});

describe("W2 tmux 미리보기 i18n", () => {
  it("문구는 i18n 키를 쓰고 소스에 하드코딩이 없다", () => {
    const s = src("../src/components/TmuxPreview.tsx");
    expect(s).not.toMatch(/`Claude /);
    expect(s).not.toMatch(/\.replace\(/);
    expect(s).toMatch(/tmux\.paneModel/);
    mount(<App />);
    goto(5);
    expect(screen.getAllByText("Claude sonnet").length).toBeGreaterThan(0);
    expect(screen.getAllByText("사내 vLLM · exaone-32b").length).toBeGreaterThan(0);
  });
});
