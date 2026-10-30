import { fireEvent, render as mount, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App3 as App } from "./pro3";

const fileCount = () => Number(/(\d+)개/.exec(screen.getByRole("heading", { level: 2, name: /생성 파일/ }).textContent ?? "")?.[1]);
const count = () => screen.getByRole("status", { name: "개발자 수" });
const more = () => fireEvent.click(screen.getByRole("button", { name: "개발자 늘리기" }));
const less = () => fireEvent.click(screen.getByRole("button", { name: "개발자 줄이기" }));

describe("REQ-01·02 / DEV-01 / RTN-01 1단계", () => {
  it("스테퍼로 개발자 수를 바꾸면 값과 미리보기 파일 수가 바뀐다", () => {
    mount(<App />);
    const before = fileCount();
    expect(count()).toHaveTextContent("3");
    // 빈 개발자(도메인 미정)는 파일을 만들지 않으므로 늘릴 때는 설정 파일의 developers 값으로 확인한다
    more();
    expect(count()).toHaveTextContent("4");
    fireEvent.click(screen.getByRole("button", { name: /\.agentforge\/forge\.config\.json/ }));
    expect(screen.getByText(/"developers": 4/, { selector: "pre" })).toBeInTheDocument();
    less();
    less();
    expect(count()).toHaveTextContent("2");
    expect(fileCount()).toBeLessThan(before);
  });

  it("개발자 수는 1~6 범위에서 버튼이 비활성이 된다", () => {
    mount(<App />);
    for (let i = 0; i < 5; i++) less();
    expect(count()).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: "개발자 줄이기" })).toBeDisabled();
    for (let i = 0; i < 5; i++) more();
    expect(count()).toHaveTextContent("6");
    expect(screen.getByRole("button", { name: "개발자 늘리기" })).toBeDisabled();
  });

  it("반려 한도는 2~5 선택이고 변경된다", () => {
    mount(<App />);
    const sel = screen.getByLabelText(/반려 한도/);
    expect(within(sel).getAllByRole("option").map((o) => o.textContent)).toEqual(["2", "3", "4", "5"]);
    expect(sel).toHaveValue("3");
    fireEvent.change(sel, { target: { value: "5" } });
    expect(sel).toHaveValue("5");
  });

  it("요구사항이 30자 미만이면 경고를 보이지만 ZIP은 막지 않는다", () => {
    mount(<App />);
    fireEvent.change(screen.getByLabelText(/^요구사항 \(/), { target: { value: "짧은 요구사항" } });
    expect(screen.getByText(/요구사항이 짧습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("요구사항이 충분히 길면 경고가 없다", () => {
    mount(<App />);
    expect(screen.queryByText(/요구사항이 짧습니다/)).not.toBeInTheDocument();
  });

  it("이름 규칙 오류는 한 번만 표시되고 ZIP이 막힌다", () => {
    mount(<App />);
    fireEvent.change(screen.getByLabelText(/프로젝트 이름/), { target: { value: "Bad Name" } });
    expect(screen.getAllByText(/프로젝트 이름은 영문 소문자/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: /먼저 해결/ })).toBeDisabled();
  });
});
