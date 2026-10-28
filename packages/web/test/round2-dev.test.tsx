import { fireEvent, render as mount, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../src/App";

const goto = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!);
const rows = () => screen.getAllByTestId("dev-row");
const row = (n: number) => rows()[n - 1]!;
const paths = (n: number, v: string) => fireEvent.change(screen.getByLabelText(`dev-${n} 담당 폴더`), { target: { value: v } });
const domain = (n: number, v: string) => fireEvent.change(screen.getByLabelText(`dev-${n} 도메인`), { target: { value: v } });

describe("DEV-02 3단계 개발자", () => {
  it("개발자 수를 바꾸면 3단계 행 수가 따라간다", () => {
    mount(<App />);
    goto(3);
    expect(rows()).toHaveLength(3);
    goto(1);
    fireEvent.click(screen.getByRole("button", { name: "개발자 늘리기" }));
    goto(3);
    expect(rows()).toHaveLength(4);
    expect(within(row(4)).getByText("review-4")).toBeInTheDocument();
    goto(1);
    fireEvent.click(screen.getByRole("button", { name: "개발자 줄이기" }));
    fireEvent.click(screen.getByRole("button", { name: "개발자 줄이기" }));
    goto(3);
    expect(rows()).toHaveLength(2);
  });

  it("기본값을 도메인·폴더·모델로 보여준다", () => {
    mount(<App />);
    goto(3);
    expect(screen.getByLabelText("dev-1 도메인")).toHaveValue("order");
    expect(screen.getByLabelText("dev-1 담당 폴더")).toHaveValue("src/order/, tests/order/");
    expect(screen.getByLabelText("dev-1 모델")).toHaveValue("exaone-32b");
    expect(screen.getByLabelText("review-1 모델")).toHaveValue("sonnet");
  });

  it("쉼표로 구분한 폴더가 배열로 반영되고 미리보기에 나타난다", () => {
    mount(<App />);
    goto(3);
    paths(1, "src/orders, tests/orders , lib/order");
    expect(screen.getByLabelText("dev-1 담당 폴더")).toHaveValue("src/orders, tests/orders , lib/order");
    fireEvent.click(screen.getByRole("button", { name: /\.claude\/devs\/dev-1\.paths/ }));
    const pre = screen.getByText(/lib\/order\//, { selector: "pre" });
    expect(pre).toHaveTextContent("src/orders/");
  });

  it("폴더가 겹치면 두 행 근처에 경고가 나오고 ZIP이 막힌다", () => {
    mount(<App />);
    goto(3);
    paths(2, "src/order/api");
    expect(within(row(1)).getByText(/담당 폴더 겹침/)).toBeInTheDocument();
    expect(within(row(2)).getByText(/담당 폴더 겹침/)).toBeInTheDocument();
    expect(within(row(3)).queryByText(/담당 폴더 겹침/)).not.toBeInTheDocument();
    goto(1);
    expect(screen.getByRole("button", { name: /먼저 해결/ })).toBeDisabled();
    goto(3);
    paths(2, "src/payment/");
    expect(screen.queryByText(/담당 폴더 겹침/)).not.toBeInTheDocument();
    goto(1);
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("검증 모델이 약하면 해당 행에 경고를 보이되 ZIP은 막지 않는다", () => {
    mount(<App />);
    goto(3);
    fireEvent.change(screen.getByLabelText("dev-1 제공자"), { target: { value: "claude" } });
    fireEvent.change(screen.getByLabelText("review-1 제공자"), { target: { value: "ollama" } });
    expect(within(row(1)).getByText(/review-1 이 dev-1 보다 약한 모델/)).toBeInTheDocument();
    expect(within(row(2)).queryByText(/약한 모델/)).not.toBeInTheDocument();
    goto(1);
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("도메인·폴더를 비우면 /forge-agents 위임 안내를 보이고 ZIP은 막지 않는다", () => {
    mount(<App />);
    goto(3);
    domain(2, "");
    paths(2, "");
    expect(within(row(2)).getByText(/\/forge-agents 가 만듭니다/)).toBeInTheDocument();
    goto(1);
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("잘못된 경로는 오류를 보이지만 입력은 막지 않는다", () => {
    mount(<App />);
    goto(3);
    paths(1, "../etc");
    expect(screen.getByLabelText("dev-1 담당 폴더")).toHaveValue("../etc");
    expect(within(row(1)).getByText(/담당 폴더/, { selector: "li" })).toBeInTheDocument();
    goto(1);
    expect(screen.getByRole("button", { name: /먼저 해결/ })).toBeDisabled();
  });

  it("도메인만 있고 폴더가 없으면 오류를 보인다", () => {
    mount(<App />);
    goto(3);
    paths(3, "");
    expect(within(row(3)).getByText(/도메인과 담당 폴더는 함께/)).toBeInTheDocument();
  });

  it("비 Claude 제공자에서 모델을 비우면 모델 누락 오류가 해당 행에 나온다", () => {
    mount(<App />);
    goto(3);
    fireEvent.change(screen.getByLabelText("dev-1 모델"), { target: { value: "" } });
    expect(within(row(1)).getByText(/dev-1: 모델 ID를 입력하세요/)).toBeInTheDocument();
  });
});
