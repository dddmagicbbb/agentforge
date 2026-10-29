import { fireEvent, render as mount, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDraft, render, validate, type Issue } from "@agentforge/core";
import { App } from "../src/App";
import { IssueList } from "../src/components/IssueList";
import { stepOfPath } from "../src/issue-step";

const nav = () => within(screen.getByRole("navigation", { name: "단계" }));
const goto = (n: number) => fireEvent.click(nav().getAllByRole("button")[n - 1]!);
const clearPlannerModel = () => {
  goto(2);
  // 비 Claude 제공자에서 모델을 비워야 MODEL_MISSING(agents.planner.model) 오류가 된다
  fireEvent.change(screen.getByLabelText("planner 제공자"), { target: { value: "ollama" } });
  fireEvent.change(screen.getByLabelText("planner 모델"), { target: { value: "" } });
};

// 화면 기본값과 같은 입력을 core 로 검증·렌더한 결과
const defaultFiles = () => {
  const v = validate(defaultDraft());
  return v.project ? render(v.project) : [];
};

describe("EXP-01 6단계 생성 화면", () => {
  it("칩 수치가 render 결과와 일치한다", () => {
    mount(<App />);
    goto(6);
    const files = defaultFiles();
    const exec = files.filter((f) => f.mode === 0o755).length;
    const ai = files.filter((f) => f.author === "ai-fill").length;
    expect(files.length).toBeGreaterThan(0);
    expect(screen.getByText(/^파일 \d+개$/)).toHaveTextContent(`파일 ${files.length}개`);
    expect(screen.getByText(/^실행 스크립트/)).toHaveTextContent(`실행 스크립트 ${exec}개`);
    expect(screen.getByText(/^AI가 채울 파일/)).toHaveTextContent(`AI가 채울 파일 ${ai}개`);
  });

  it("검사 결과 전체 목록을 보이고 경고만 있으면 ZIP 이 가능하다", () => {
    mount(<App />);
    fireEvent.change(screen.getByLabelText(/^요구사항/), { target: { value: "짧음" } });
    goto(6);
    const list = screen.getByTestId("check-list");
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(within(list).getByText(/요구사항이 짧습니다/).closest("li")).toHaveClass("lv-warn");
    expect(within(list).getByText(/OpenRouter 무료 모델/).closest("li")).toHaveClass("lv-warn");
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("오류가 있으면 ZIP 이 막히고 이동 버튼이 원인 단계로 이동한다", () => {
    mount(<App />);
    clearPlannerModel();
    goto(6);
    expect(screen.getByRole("button", { name: /오류 1건을 먼저 해결하세요/ })).toBeDisabled();
    fireEvent.click(within(screen.getByTestId("check-list")).getByRole("button", { name: /루틴·에이전트.*이동/ }));
    expect(nav().getAllByRole("button")[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("heading", { name: "루틴과 순차 단계 에이전트" })).toBeInTheDocument();
  });

  it("단계 바에 오류가 있는 단계를 표시한다", () => {
    mount(<App />);
    clearPlannerModel();
    expect(within(nav().getAllByRole("button")[1]!).getByLabelText("오류 있음")).toBeInTheDocument();
    expect(within(nav().getAllByRole("button")[0]!).queryByLabelText("오류 있음")).not.toBeInTheDocument();
  });

  it("1단계 오류 안내의 이동 버튼도 원인 단계로 이동한다", () => {
    mount(<App />);
    clearPlannerModel();
    goto(1);
    fireEvent.click(screen.getByRole("button", { name: /루틴·에이전트.*이동/ }));
    expect(nav().getAllByRole("button")[1]).toHaveAttribute("aria-current", "step");
  });

  it("받은 뒤 할 일에서 UI/UX 설계를 끄면 UI/UX 단계가 빠진다", () => {
    mount(<App />);
    goto(6);
    expect(screen.getByTestId("next-steps")).toHaveTextContent("UI/UX 설계");
    goto(1);
    fireEvent.click(screen.getByLabelText(/UI\/UX 설계 단계 사용/));
    goto(6);
    expect(screen.getByTestId("next-steps")).not.toHaveTextContent("UI/UX 설계");
  });

  it("GitHub 영역은 접힌 채 시작하고 펼치기 전에는 토큰 입력란이 없다", () => {
    mount(<App />);
    goto(6);
    expect(screen.getByRole("button", { name: "GitHub 내보내기" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText(/토큰|token/i)).not.toBeInTheDocument();
  });

  it("ZIP 파일명은 <이름>-agentforge.zip 이다", { timeout: 20000 }, async () => {
    // jsdom 에는 두 메서드가 없으므로 자리만 만들고 spy 로 대체(afterEach 에서 복원)
    Object.assign(URL, { createObjectURL: () => "", revokeObjectURL: () => undefined });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    mount(<App />);
    goto(6);
    fireEvent.click(screen.getByRole("button", { name: "ZIP 다운로드" }));
    // 지연 import 라 부하 시 늦을 수 있어 대기 시간을 늘린다(T-723)
    await waitFor(() => expect(names).toEqual(["order-portal-agentforge.zip"]), { timeout: 10000 });
  });
});

afterEach(() => vi.restoreAllMocks());

describe("code → 단계 이동(path 없는 경고)", () => {
  const mk = (code: string, level: "warn" | "info"): Issue => ({ code, level, path: [], params: {} });
  it.each(["OPENROUTER_FREE_LIMIT", "GATEWAY_REQUIRED", "VLLM_TOOL_PARSER"])("%s -> 5단계 이동 버튼", (code) => {
    const go = vi.fn();
    mount(<IssueList issues={[mk(code, code === "OPENROUTER_FREE_LIMIT" ? "warn" : "info")]} onGoto={go} />);
    fireEvent.click(screen.getByRole("button"));
    expect(go).toHaveBeenCalledWith(4);
  });
  it("매핑 없는 path 없는 항목은 버튼이 없다", () => {
    mount(<IssueList issues={[mk("UNKNOWN", "warn")]} onGoto={() => undefined} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("W3 NAME_INVALID slug 문구", () => {
  const issue = (params: Issue["params"]): Issue => ({ code: "NAME_INVALID", level: "warn", path: ["name"], params });
  it("slug 가 있으면 지금 값으로 만들 이름을 보여 준다", () => {
    mount(<IssueList issues={[issue({ name: "My App", slug: "my-app" })]} />);
    expect(screen.getByText(/지금 값으로는 "my-app" 로 만듭니다\./)).toBeInTheDocument();
  });
  it("slug 가 없으면 앞 문장만 보인다", () => {
    mount(<IssueList issues={[issue({ name: "My App" })]} />);
    expect(screen.getByText("프로젝트 이름은 영문 소문자·숫자·.·_·- 만 씁니다.")).toBeInTheDocument();
  });
});

describe("오류 경로 → 단계 매핑", () => {
  it.each([
    [["name"], 0], [["requirement"], 0], [["commands", "test"], 0], [["developerCount"], 0],
    [["agents", "planner", "model"], 1], [["devs", 1, "paths"], 2], [["devs"], 2],
    [["skills", "tdd"], 3], [["imported", 0], 3], [["connections", "vllm"], 4], [[], 0],
  ])("%j -> %i", (path, step) => {
    expect(stepOfPath(path as (string | number)[])).toBe(step);
  });
});
