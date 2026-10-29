import { fireEvent, render as mount, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { defaultDraft } from "@agentforge/core";
import { App } from "../src/App";
import { StepConnection } from "../src/steps/StepConnection";

const goto = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!);
const providerRows = () => within(screen.getByRole("table", { name: "사용 중인 제공자" })).getAllByTestId("prov-row");
const rowOf = (name: string) => providerRows().find((r) => within(r).queryByText(name) !== null)!;
const windows = () => screen.getAllByTestId("tmux-window");

describe("PRV-01·04 5단계 연결·실행", () => {
  it("사용 중인 제공자만 표에 나오고 에이전트 수를 센다", () => {
    mount(<App />);
    goto(5);
    // 기본값: claude(순차 6 + review 3), vllm(dev 2), openrouter(dev 1)
    expect(providerRows()).toHaveLength(3);
    expect(within(rowOf("Claude 로그인")).getByText("9")).toBeInTheDocument();
    expect(within(rowOf("사내 vLLM")).getByText("2")).toBeInTheDocument();
    expect(within(rowOf("OpenRouter")).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Ollama 로컬")).not.toBeInTheDocument();
  });

  it("UI/UX 설계를 끄면 ux-designer 는 에이전트 수에서 빠진다", () => {
    mount(<App />);
    fireEvent.click(screen.getByLabelText(/UI\/UX 설계 단계 사용/));
    goto(5);
    expect(within(rowOf("Claude 로그인")).getByText("8")).toBeInTheDocument();
  });

  it("vLLM 을 쓰면 주소 입력이 있고 Ollama 입력은 없다", () => {
    mount(<App />);
    goto(5);
    expect(screen.getByLabelText("vLLM 주소")).toHaveValue("http://10.0.0.5:8000");
    expect(screen.queryByLabelText("Ollama 주소")).not.toBeInTheDocument();
  });

  it("Ollama 로 바꾸면 Ollama 주소 입력이 나타나고 vLLM 이 쓰이지 않으면 사라진다", () => {
    mount(<App />);
    goto(3);
    for (const n of [1, 2]) fireEvent.change(screen.getByLabelText(`dev-${n} 제공자`), { target: { value: "ollama" } });
    goto(5);
    expect(screen.getByLabelText("Ollama 주소")).toHaveValue("http://localhost:11434");
    expect(screen.queryByLabelText("vLLM 주소")).not.toBeInTheDocument();
    expect(screen.queryByText("사내 vLLM")).not.toBeInTheDocument();
  });

  it("주소를 고치면 draft 에 반영되고 잘못된 주소는 오류만 보인다(입력은 유지)", () => {
    mount(<App />);
    goto(5);
    const input = screen.getByLabelText("vLLM 주소");
    fireEvent.change(input, { target: { value: "http://gpu.local:8000" } });
    expect(input).toHaveValue("http://gpu.local:8000");
    fireEvent.change(input, { target: { value: "ftp://x y" } });
    expect(input).toHaveValue("ftp://x y");
    expect(within(rowOf("사내 vLLM")).getByText(/주소 형식/)).toBeInTheDocument();
  });

  it("OpenRouter·LiteLLM 은 주소 입력 없이 안내만 있다", () => {
    const draft = defaultDraft();
    draft.devs = draft.devs.map((d, i) => (i === 0 ? { ...d, dev: { provider: "openai", model: "gpt-5.5" } } : d));
    mount(<StepConnection draft={draft} patch={() => undefined} issues={[]} />);
    expect(within(rowOf("OpenRouter")).getByText(/env\.local/)).toBeInTheDocument();
    expect(within(rowOf("OpenAI·LiteLLM")).getByText(/http:\/\/localhost:4000/)).toBeInTheDocument();
    expect(within(rowOf("OpenAI·LiteLLM")).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("키 입력란이 없다", () => {
    mount(<App />);
    goto(5);
    expect(screen.queryByLabelText(/키|key|token|비밀/i)).not.toBeInTheDocument();
    expect(document.querySelector("input[type=password]")).toBeNull();
  });

  it("tmux 미리보기 창 수는 개발자 수 + 1(0:watch)이고 스테퍼를 따라간다", () => {
    mount(<App />);
    goto(5);
    expect(windows()).toHaveLength(4);
    expect(within(windows()[0]!).getByText("0:watch")).toBeInTheDocument();
    expect(within(windows()[3]!).getByText("3:dev3")).toBeInTheDocument();
    goto(1);
    fireEvent.click(screen.getByRole("button", { name: "개발자 늘리기" }));
    goto(5);
    expect(windows()).toHaveLength(5);
    expect(within(windows()[4]!).getByText("review-4")).toBeInTheDocument();
    expect(screen.getByText(/\[order-portal\] 0:watch 1:dev1 2:dev2 3:dev3 4:dev4/)).toBeInTheDocument();
  });

  it("tmux 감시 창에 반려 한도가 나온다", () => {
    mount(<App />);
    goto(1);
    fireEvent.change(screen.getByLabelText(/반려 한도/), { target: { value: "5" } });
    goto(5);
    expect(within(windows()[0]!).getByText(/반려 5회 한도/)).toBeInTheDocument();
  });

  it("기본값에서는 vLLM 도구 호출 안내와 OpenRouter 한도 경고가 나오고 게이트웨이 안내는 없다", () => {
    mount(<App />);
    goto(5);
    expect(screen.getByText(/--tool-call-parser/)).toBeInTheDocument();
    expect(screen.getByText(/OpenRouter 무료 모델 1개 에이전트/)).toBeInTheDocument();
    expect(screen.queryByText(/LiteLLM 게이트웨이를 거칩니다/)).not.toBeInTheDocument();
  });

  it("OpenAI 를 쓰면 게이트웨이 안내가 나온다", () => {
    mount(<App />);
    goto(3);
    fireEvent.change(screen.getByLabelText("dev-3 제공자"), { target: { value: "openai" } });
    goto(5);
    expect(screen.getByText(/LiteLLM 게이트웨이를 거칩니다/)).toBeInTheDocument();
    expect(screen.queryByText(/OpenRouter 무료 모델/)).not.toBeInTheDocument();
  });

  it("모델 ID 누락 오류가 5단계에도 나온다", () => {
    mount(<App />);
    goto(3);
    fireEvent.change(screen.getByLabelText("dev-1 모델"), { target: { value: "" } });
    goto(5);
    expect(screen.getByText("dev-1: 모델 ID를 입력하세요.")).toBeInTheDocument();
  });
});
