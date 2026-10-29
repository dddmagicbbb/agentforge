import { act, fireEvent, render as mount, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDraft, type RenderedFile } from "@agentforge/core";
import { App } from "../src/App";
import i18n from "../src/i18n";
import en from "../src/locales/en.json";
import { applyExistingClaudeMd, buildPreview } from "../src/use-preview";

const toZip = vi.hoisted(() => vi.fn(async (_files: readonly RenderedFile[], _name: string) => new Uint8Array([1])));
vi.mock("@agentforge/exporter", () => ({ toZip }));

const goto = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!);
const claudeOf = (files: readonly RenderedFile[]) => files.find((f) => f.path === "CLAUDE.md")!.content;
const base = buildPreview(defaultDraft());
const OLD_PROJECT = "내가 직접 쓴 프로젝트 설명 ZZ-PROJECT";
// 생성본의 PROJECT 구간 안쪽을 사용자 내용으로 바꾸고 앞뒤에 사용자 텍스트를 붙인 "기존 CLAUDE.md"
const oldMd = () =>
  "사용자 서문 ZZ-HEAD\n\n" +
  claudeOf(base.files).replace(/(<!-- AGENTFORGE:PROJECT:BEGIN -->)[\s\S]*?(<!-- AGENTFORGE:PROJECT:END -->)/, `$1\n${OLD_PROJECT}\n$2`) +
  "\n사용자 꼬리 ZZ-TAIL\n";
const area = () => screen.getByLabelText("기존 CLAUDE.md 붙여넣기(선택)");
const paste = (v: string) => fireEvent.change(area(), { target: { value: v } });
const previewText = () => document.querySelector(".preview pre")!.textContent ?? "";

afterEach(async () => {
  toZip.mockClear();
  await act(async () => {
    await i18n.changeLanguage("ko");
  });
});

describe("DOC-03 T-624: applyExistingClaudeMd", () => {
  it("빈 값이면 파일 목록을 그대로 돌려준다", () => {
    const r = applyExistingClaudeMd(base.files, "");
    expect(r.files).toBe(base.files);
    expect(r.issues).toEqual([]);
  });

  it("CLAUDE.md 만 바뀌고 다른 파일은 불변이다", () => {
    const r = applyExistingClaudeMd(base.files, oldMd());
    expect(r.files.map((f) => f.path)).toEqual(base.files.map((f) => f.path));
    const changed = r.files.filter((f, i) => f !== base.files[i]).map((f) => f.path);
    expect(changed).toEqual(["CLAUDE.md"]);
    expect(claudeOf(r.files)).toContain("ZZ-HEAD");
    expect(claudeOf(r.files)).toContain("ZZ-TAIL");
    expect(claudeOf(r.files)).toContain(OLD_PROJECT);
  });

  it("마커 오류는 CLAUDE_MD_MARKERS error issue(구간 ID 포함)로 바뀌고 파일은 원본 그대로", () => {
    const r = applyExistingClaudeMd(base.files, "<!-- AGENTFORGE:AGENTS:BEGIN -->x");
    expect(r.files).toBe(base.files);
    expect(r.issues).toEqual([{ level: "error", code: "CLAUDE_MD_MARKERS", path: ["existingClaudeMd"], params: { id: "AGENTS" } }]);
  });
});

describe("DOC-03 T-624: 6단계 화면", () => {
  it("입력란이 있고 비어 있으면 생성본 CLAUDE.md 가 그대로다", () => {
    mount(<App />);
    goto(6);
    expect(area()).toHaveValue("");
    expect(previewText()).toBe(claudeOf(base.files));
  });

  it("마커가 코드블록 안에 있어도 센다는 안내가 있다", () => {
    mount(<App />);
    goto(6);
    expect(screen.getByText(/코드블록/)).toBeInTheDocument();
  });

  it("붙여넣으면 미리보기에 사용자 텍스트와 PROJECT 구간이 보존된다", () => {
    mount(<App />);
    goto(6);
    paste(oldMd());
    expect(previewText()).toContain("ZZ-HEAD");
    expect(previewText()).toContain("ZZ-TAIL");
    expect(previewText()).toContain(OLD_PROJECT);
  });

  it("ZIP 입력 파일에 병합 결과가 들어가고 다른 파일은 같다", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
    mount(<App />);
    goto(6);
    paste(oldMd());
    fireEvent.click(screen.getByRole("button", { name: "ZIP 다운로드" }));
    await waitFor(() => expect(toZip).toHaveBeenCalled());
    const sent = toZip.mock.calls[0]![0];
    expect(claudeOf(sent)).toContain("ZZ-HEAD");
    expect(sent.filter((f) => f.path !== "CLAUDE.md")).toEqual(base.files.filter((f) => f.path !== "CLAUDE.md"));
    vi.restoreAllMocks();
  });

  it("마커 오류면 구간 ID 가 든 오류를 보이고 ZIP 을 막는다", () => {
    mount(<App />);
    goto(6);
    paste("<!-- AGENTFORGE:DEVS:BEGIN -->x");
    expect(within(screen.getByTestId("check-list")).getByText(/DEVS/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^오류 \d+건을 먼저 해결하세요/ })).toBeDisabled();
    paste("");
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("붙여넣은 내용은 저장하지 않는다", () => {
    const { unmount } = mount(<App />);
    goto(6);
    paste(oldMd());
    unmount();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    mount(<App />);
    goto(6);
    expect(area()).toHaveValue("");
  });

  it("en 화면: 라벨과 오류 문구가 영어다", async () => {
    mount(<App />);
    goto(6);
    await act(async () => {
      await i18n.changeLanguage("en");
    });
    const box = screen.getByLabelText(en.doc.label);
    fireEvent.change(box, { target: { value: "<!-- AGENTFORGE:SKILLS:END -->" } });
    expect(within(screen.getByTestId("check-list")).getByText(/SKILLS/)).toHaveTextContent(/markers/i);
  });
});
