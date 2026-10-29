import { fireEvent, render as mount, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultDraft, type Issue } from "@agentforge/core";
import { App } from "../src/App";
import { StepConnection } from "../src/steps/StepConnection";
import { StepGenerate } from "../src/steps/StepGenerate";
import { buildPreview } from "../src/use-preview";
import { errorSteps, stepOfPath } from "../src/issue-step";
import { TmuxPreview } from "../src/components/TmuxPreview";

const goto = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!);
const windows = () => screen.getAllByTestId("tmux-window");
const names = () => windows().map((w) => within(w).getAllByText(/^\d:/)[0]!.textContent);
const tmuxDefault = { layout: "pair", prefix: "C-b", mouse: false, logs: false } as const;

describe("RUN-04 T-622: tmux 설정 입력", () => {
  it("기본은 pair·C-b·마우스/로그 꺼짐이고 draft 에 tmux 가 없다", () => {
    const patch = vi.fn();
    mount(<StepConnection draft={defaultDraft()} patch={patch} issues={[]} />);
    expect(screen.getByLabelText("tmux 배치")).toHaveValue("pair");
    expect(screen.getByLabelText("tmux prefix")).toHaveValue("C-b");
    expect(screen.getByLabelText("마우스 사용")).not.toBeChecked();
    expect(screen.getByLabelText("pane 로그 기록")).not.toBeChecked();
    expect(patch).not.toHaveBeenCalled();
  });

  it("배치·접두키·마우스·로그를 바꾸면 draft.tmux 를 설정한다", () => {
    const patch = vi.fn();
    mount(<StepConnection draft={defaultDraft()} patch={patch} issues={[]} />);
    fireEvent.change(screen.getByLabelText("tmux 배치"), { target: { value: "grid" } });
    expect(patch).toHaveBeenLastCalledWith({ tmux: { ...tmuxDefault, layout: "grid" } });
    fireEvent.change(screen.getByLabelText("tmux prefix"), { target: { value: "C-a" } });
    expect(patch).toHaveBeenLastCalledWith({ tmux: { ...tmuxDefault, prefix: "C-a" } });
    fireEvent.click(screen.getByLabelText("마우스 사용"));
    expect(patch).toHaveBeenLastCalledWith({ tmux: { ...tmuxDefault, mouse: true } });
    fireEvent.click(screen.getByLabelText("pane 로그 기록"));
    expect(patch).toHaveBeenLastCalledWith({ tmux: { ...tmuxDefault, logs: true } });
  });

  it("지정한 뒤 '기본으로' 를 누르면 tmux 를 비운다", () => {
    const patch = vi.fn();
    mount(<StepConnection draft={{ ...defaultDraft(), tmux: { ...tmuxDefault, mouse: true } }} patch={patch} issues={[]} />);
    expect(screen.getByLabelText("마우스 사용")).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "tmux 기본값으로" }));
    expect(patch).toHaveBeenLastCalledWith({ tmux: undefined });
  });

  it("잘못된 접두키는 오류로 표시된다(App 검증)", () => {
    mount(<App />);
    goto(5);
    fireEvent.change(screen.getByLabelText("tmux prefix"), { target: { value: "C-1" } });
    expect(screen.getByRole("alert")).toHaveTextContent("C-a");
  });

  it("App 에서 배치를 바꾸면 미리보기가 따라간다", () => {
    mount(<App />);
    goto(5);
    expect(names()).toEqual(["0:watch", "1:dev1", "2:dev2", "3:dev3"]);
    fireEvent.change(screen.getByLabelText("tmux 배치"), { target: { value: "grid" } });
    expect(names()).toEqual(["0:watch", "1:agents"]);
    fireEvent.change(screen.getByLabelText("tmux 배치"), { target: { value: "role" } });
    expect(names()).toEqual(["0:watch", "1:dev", "2:review"]);
  });
});

describe("RUN-04 미리보기 배치", () => {
  it("grid: 한 창에 dev-1, review-1, dev-2 … 순서", () => {
    const d = { ...defaultDraft(), tmux: { ...tmuxDefault, layout: "grid" as const } };
    mount(<TmuxPreview draft={d} />);
    const panes = [...windows()[1]!.querySelectorAll(".pane b")].map((e) => e.textContent);
    expect(panes).toEqual(["dev-1", "review-1", "dev-2", "review-2", "dev-3", "review-3"]);
  });

  it("role: dev 창에 dev-1..N, review 창에 review-1..N", () => {
    const d = { ...defaultDraft(), tmux: { ...tmuxDefault, layout: "role" as const } };
    mount(<TmuxPreview draft={d} />);
    const of = (i: number) => [...windows()[i]!.querySelectorAll(".pane b")].map((e) => e.textContent);
    expect(of(1)).toEqual(["dev-1", "dev-2", "dev-3"]);
    expect(of(2)).toEqual(["review-1", "review-2", "review-3"]);
  });
});

describe("VSC-02·PRV-03 T-623", () => {
  const info: Issue = { level: "info", code: "DEVCONTAINER_CLOSED_NET", path: ["devcontainer"], params: {} };

  it("Dev Container 토글은 draft.devcontainer 를 설정한다", () => {
    const patch = vi.fn();
    mount(<StepConnection draft={defaultDraft()} patch={patch} issues={[]} />);
    const box = screen.getByLabelText("Dev Container 생성");
    expect(box).not.toBeChecked();
    fireEvent.click(box);
    expect(patch).toHaveBeenLastCalledWith({ devcontainer: true });
  });

  it("끄면 draft 에서 값을 비운다", () => {
    const patch = vi.fn();
    mount(<StepConnection draft={{ ...defaultDraft(), devcontainer: true }} patch={patch} issues={[]} />);
    fireEvent.click(screen.getByLabelText("Dev Container 생성"));
    expect(patch).toHaveBeenLastCalledWith({ devcontainer: undefined });
  });

  it("DEVCONTAINER_CLOSED_NET info 를 실제 render 결과(devcontainer: true)로 5단계에 표시한다", () => {
    const draft = { ...defaultDraft(), devcontainer: true };
    const real = buildPreview(draft).issues;
    expect(real.some((i) => i.code === "DEVCONTAINER_CLOSED_NET" && i.level === "info")).toBe(true);
    expect(buildPreview(defaultDraft()).issues.some((i) => i.code === "DEVCONTAINER_CLOSED_NET")).toBe(false);
    mount(<StepConnection draft={draft} patch={() => undefined} issues={real} />);
    expect(screen.getByRole("status")).toHaveTextContent(/내려받/);
  });

  it("6단계 검사 목록에도 표시되고 코드 원문(default)으로 떨어지지 않는다", () => {
    mount(<StepGenerate existingMd="" onExistingMd={() => undefined} draft={defaultDraft()} issues={[info]} files={[]} exportable onStep={() => undefined} patch={() => undefined} />);
    expect(screen.getByTestId("check-list")).toHaveTextContent(/내려받/);
    expect(screen.getByTestId("check-list")).not.toHaveTextContent("DEVCONTAINER_CLOSED_NET");
  });

  it("6단계 '받은 뒤 할 일' 에 모델 점검(토큰 사용 안내)이 있다", () => {
    mount(<StepGenerate existingMd="" onExistingMd={() => undefined} draft={defaultDraft()} issues={[]} files={[]} exportable onStep={() => undefined} patch={() => undefined} />);
    const items = within(screen.getByTestId("next-steps")).getAllByRole("listitem").map((l) => l.textContent);
    const i = items.findIndex((x) => x?.includes("bash scripts/check-models.sh"));
    expect(i).toBeGreaterThan(-1);
    expect(items[i]).toMatch(/토큰/);
    expect(i).toBeGreaterThan(items.findIndex((x) => x?.includes("check-forge.sh")));
  });
});

describe("review-3 반려: tmux·devcontainer 오류 단계", () => {
  it("stepOfPath: tmux·devcontainer 는 5단계(인덱스 4)", () => {
    expect(stepOfPath(["tmux", "prefix"])).toBe(4);
    expect(stepOfPath(["devcontainer"])).toBe(4);
  });

  it("App: prefix C-1 이면 오류 점은 5단계에만 있고 6단계 이동 버튼은 연결 단계를 가리킨다", () => {
    mount(<App />);
    goto(5);
    fireEvent.change(screen.getByLabelText("tmux prefix"), { target: { value: "C-1" } });
    const buttons = within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button");
    const dotted = buttons.map((b, i) => (within(b).queryByRole("img", { name: "오류 있음" }) ? i : -1)).filter((i) => i >= 0);
    expect(dotted).toEqual([4]);
    goto(6);
    const list = screen.getByTestId("check-list");
    expect(within(list).getAllByRole("button", { name: "연결·실행 단계로 이동" })[0]).toBeInTheDocument();
    expect(within(list).queryByRole("button", { name: "요구사항 단계로 이동" })).not.toBeInTheDocument();
  });

  it("errorSteps 는 tmux prefix 오류를 5단계로 센다", () => {
    const issue: Issue = { level: "error", code: "TMUX_PREFIX", path: ["tmux", "prefix"], params: {} };
    expect([...errorSteps([issue])]).toEqual([4]);
  });

  it("buildPreview: 기본값 복귀 시 생성물 동일, tmux 지정 시 forge.config.json 에 tmux 포함", () => {
    const base = buildPreview(defaultDraft());
    const reset = buildPreview({ ...defaultDraft(), tmux: undefined });
    expect(reset.files).toEqual(base.files);
    const set = buildPreview({ ...defaultDraft(), tmux: { ...tmuxDefault, layout: "grid", mouse: true } });
    const cfg = (f: typeof base.files) => f.find((x) => x.path === ".agentforge/forge.config.json")!.content;
    expect(cfg(set.files)).toContain('"tmuxLayout": "grid"');
    expect(cfg(set.files)).toContain('"mouse": true');
    expect(cfg(base.files)).not.toContain('"tmux":');
  });

  it("접근성: prefix 오류 시 aria-invalid·오류 연결, Dev Container 안내 연결", () => {
    mount(<App />);
    goto(5);
    const input = screen.getByLabelText("tmux prefix");
    expect(input).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "C-1" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    const ids = input.getAttribute("aria-describedby")!.split(" ");
    expect(ids).toContain("tmux-prefix-error");
    expect(document.getElementById("tmux-prefix-error")).toHaveTextContent("tmux 접두키는 C-a ~ C-z 형식으로 적습니다");
    const dc = screen.getByLabelText("Dev Container 생성");
    expect(document.getElementById(dc.getAttribute("aria-describedby")!)).toHaveTextContent(/devcontainer\.json/);
  });
});
