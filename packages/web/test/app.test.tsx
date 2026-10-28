import { fireEvent, render as mount, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultDraft, render, validate } from "@agentforge/core";
import { App } from "../src/App";
import { defaultModel } from "../src/catalog";

const next = () => fireEvent.click(screen.getByRole("button", { name: "다음" }));
const prev = () => fireEvent.click(screen.getByRole("button", { name: "이전" }));
const stepBtn = (n: number) => within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!;
const treeHas = (path: string) => screen.queryByRole("button", { name: new RegExp(path.replace(/[.]/g, "\\.")) }) !== null;

describe("골격: 단계 이동", () => {
  it("단계 이동: 다음·이전·단계 바 클릭", () => {
    mount(<App />);
    expect(stepBtn(1)).toHaveAttribute("aria-current", "step");
    next();
    expect(stepBtn(2)).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { level: 2, name: "루틴과 순차 단계 에이전트" })).toBeInTheDocument();
    prev();
    expect(stepBtn(1)).toHaveAttribute("aria-current", "step");
    fireEvent.click(stepBtn(4));
    expect(screen.getByRole("heading", { level: 2, name: "스킬" })).toBeInTheDocument();
  });

  it("경계 단계에서 이전·다음 비활성", () => {
    mount(<App />);
    expect(screen.getByRole("button", { name: "이전" })).toBeDisabled();
    fireEvent.click(stepBtn(6));
    expect(screen.getByRole("button", { name: "다음" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이전" })).toBeEnabled();
  });

  it("자리표시 단계는 안내 문구를 보인다", () => {
    mount(<App />);
    for (const n of [3, 5, 6]) {
      fireEvent.click(stepBtn(n));
      expect(screen.getByText("다음 라운드에서 구현합니다.")).toBeInTheDocument();
    }
  });

  it("1단계 입력이 미리보기에 반영된다", () => {
    mount(<App />);
    fireEvent.change(screen.getByLabelText(/프로젝트 이름/), { target: { value: "my-app" } });
    fireEvent.click(screen.getByRole("button", { name: /\.agentforge\/templates\/prd\.md/ }));
    expect(screen.getAllByText(/my-app/, { selector: "pre" }).length).toBeGreaterThan(0);
  });

  it("잘못된 이름이면 오류를 보이고 ZIP이 막힌다", () => {
    mount(<App />);
    fireEvent.change(screen.getByLabelText(/프로젝트 이름/), { target: { value: "Bad Name" } });
    expect(screen.getByText("프로젝트 이름은 영문 소문자·숫자·.·_·- 만 씁니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /먼저 해결/ })).toBeDisabled();
  });
});

describe("RTN-02 2단계", () => {
  it("defaultModel: claude는 sonnet, 그 외 첫 추천", () => {
    expect(defaultModel("claude")).toBe("sonnet");
    expect(defaultModel("openrouter")).toBe("qwen/qwen3-coder:free");
    expect(defaultModel("vllm")).toBe("exaone-32b");
  });

  it("제공자 변경 시 모델이 추천 기본값으로 바뀐다", () => {
    mount(<App />);
    next();
    const prov = screen.getByLabelText("planner 제공자");
    const model = screen.getByLabelText("planner 모델");
    expect(model).toHaveValue("opus");
    fireEvent.change(prov, { target: { value: "ollama" } });
    expect(model).toHaveValue("qwen3.5:9b");
    fireEvent.change(prov, { target: { value: "claude" } });
    expect(model).toHaveValue("sonnet");
  });

  it("모델은 직접 입력할 수 있다", () => {
    mount(<App />);
    next();
    fireEvent.change(screen.getByLabelText("analyst 모델"), { target: { value: "haiku" } });
    expect(screen.getByLabelText("analyst 모델")).toHaveValue("haiku");
  });

  it("uiDesign을 끄면 ux-designer 행이 비활성이다", () => {
    mount(<App />);
    next();
    expect(screen.getByLabelText("ux-designer 제공자")).toBeEnabled();
    prev();
    fireEvent.click(screen.getByLabelText(/UI\/UX 설계 단계 사용/));
    next();
    expect(screen.getByLabelText("ux-designer 제공자")).toBeDisabled();
    expect(screen.getByLabelText("ux-designer 모델")).toBeDisabled();
    expect(screen.getByLabelText("planner 제공자")).toBeEnabled();
  });

  it("흐름도가 개발자 수만큼 병렬 쌍을 보인다", () => {
    mount(<App />);
    next();
    const flow = screen.getByTestId("flow");
    expect(within(flow).getAllByText(/상세 설계 → 개발/)).toHaveLength(3);
    expect(within(flow).getByText("통합 검증")).toBeInTheDocument();
    expect(within(flow).getByText("review-3 검증")).toBeInTheDocument();
  });

  it("산출물과 관문을 표시한다", () => {
    mount(<App />);
    next();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("docs/prd.md")).toBeInTheDocument();
    expect(table.getByText(/사람 승인\(기능 목록·우선순위\)/)).toBeInTheDocument();
  });
});

describe("SKL-01·02 4단계", () => {
  it("고정 스킬은 비활성이고 도메인 미정은 안내 문구", () => {
    mount(<App />);
    fireEvent.click(stepBtn(4));
    for (const id of ["detail-design", "code-review", "forge-init", "forge-agents"]) {
      const cb = screen.getByRole("checkbox", { name: new RegExp(`^${id}`) });
      expect(cb).toBeChecked();
      expect(cb).toBeDisabled();
    }
    expect(screen.getByText("dev1-order")).toBeInTheDocument();
    expect(screen.queryByText("도메인 미정 · /forge-agents가 생성")).not.toBeInTheDocument();
  });

  it("마켓 영역은 비활성 안내만 있다", () => {
    mount(<App />);
    fireEvent.click(stepBtn(4));
    expect(screen.getByText(/P1.*예정/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "가져오기" })).not.toBeInTheDocument();
  });

  it("tdd 토글을 끄면 미리보기에서 tdd 스킬이 사라진다", () => {
    mount(<App />);
    fireEvent.click(stepBtn(4));
    expect(treeHas(".claude/skills/tdd/SKILL.md")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /^tdd/ }));
    expect(treeHas(".claude/skills/tdd/SKILL.md")).toBe(false);
    expect(treeHas(".claude/skills/conventions/SKILL.md")).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /^conventions/ }));
    expect(treeHas(".claude/skills/conventions/SKILL.md")).toBe(false);
  });
});

describe("미리보기", () => {
  it("AI·755 표시가 있다", () => {
    mount(<App />);
    expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("755").length).toBeGreaterThan(0);
  });

  it("render 갱신이 100ms 이내", () => {
    const warm = validate(defaultDraft());
    if (!warm.project) throw new Error("기본값이 유효하지 않음");
    render(warm.project); // 예열
    const t0 = performance.now();
    const v = validate(defaultDraft());
    if (!v.project) throw new Error("기본값이 유효하지 않음");
    const files = render(v.project);
    const ms = performance.now() - t0;
    expect(files.length).toBeGreaterThan(10);
    expect(ms).toBeLessThan(100);
  });
});
