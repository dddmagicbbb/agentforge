import { act, fireEvent, render as mount, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resizeDevs, type RenderedFile } from "@agentforge/core";
import { App } from "../src/App";
import i18n from "../src/i18n";
import ko from "../src/locales/ko.json";
import en from "../src/locales/en.json";
import { buildPreview } from "../src/use-preview";
import { parseLicenseResponse, toLicenseResult, type VerifyFn } from "../src/license/license";
import { initialDraft } from "../src/App";

const toZip = vi.hoisted(() => vi.fn(async (_files: readonly RenderedFile[], _name: string) => new Uint8Array([1])));
vi.mock("@agentforge/exporter", () => ({ toZip }));

const KEY = "AF1.eyJ0ZXN0Ijoic2VjcmV0LXBheWxvYWQifQ.c2lnbmF0dXJlLXNlY3JldC12YWx1ZQ";
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
const serverOf = (data: unknown, status = 200) => vi.fn(async () => json(data, status));
const noServer = () => vi.fn(async () => { throw new TypeError("net"); });
const PRO_INFO = { ok: true as const, tier: "pro" as const, licensee: "ACME Corp", seats: 5, expires: "2027-01-01", id: "L-1" };
const verifyOk: VerifyFn = () => PRO_INFO;
type Code = "LICENSE_FORMAT" | "LICENSE_SIGNATURE" | "LICENSE_EXPIRED" | "LICENSE_UNKNOWN_KID";
const verifyFail = (code: Code): VerifyFn => () => ({ ok: false as const, code });

const nav = () => within(screen.getByRole("navigation", { name: "단계" }));
const badge = () => screen.getByTestId("license-badge");
const more = () => screen.getByRole("button", { name: "개발자 늘리기" });
const count = () => screen.getByRole("status", { name: "개발자 수" }).textContent;
const zipBtn = () => screen.queryByRole("button", { name: "ZIP 다운로드" });
const openDialog = async (name = "라이선스 키 입력") => {
  fireEvent.click(await screen.findByRole("button", { name }));
  return await screen.findByRole("dialog");
};
const applyKey = async (key = KEY) => {
  const dlg = await openDialog();
  fireEvent.change(within(dlg).getByLabelText("라이선스 키"), { target: { value: key } });
  fireEvent.click(within(dlg).getByRole("button", { name: "적용" }));
};

afterEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  toZip.mockClear();
  await act(async () => { await i18n.changeLanguage("ko"); });
});

describe("LIC-01 등급 표시와 기본값", () => {
  it("라이선스가 없으면 Free 배지, 기본 개발자 2명, 제한 오류 없음, ZIP 가능", () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    expect(badge()).toHaveTextContent("Free");
    expect(count()).toBe("2");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(zipBtn()).toBeEnabled();
  });

  it("Free 에서 3명으로 늘리면 LICENSE_LIMIT 안내가 개발자 수 옆에 뜨고 ZIP 이 막힌다", () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    fireEvent.click(more());
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Free");
    expect(alert).toHaveTextContent("2명");
    expect(alert).toHaveTextContent("Pro");
    expect(zipBtn()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /오류 1건을 먼저 해결하세요/ })).toBeDisabled();
  });
});

describe("LIC-01 서버 결과", () => {
  it("서버가 pro 를 주면 배지와 licensee 를 보이고 키 입력 버튼은 없다. 6명까지 허용", async () => {
    mount(<App licenseFetch={serverOf({ tier: "pro", licensee: "ACME Corp", seats: 5, expires: "2027-01-01" })} verifyLicense={verifyOk} />);
    await waitFor(() => expect(badge()).toHaveTextContent("Pro"));
    expect(badge()).toHaveTextContent("ACME Corp");
    expect(screen.queryByRole("button", { name: "라이선스 키 입력" })).not.toBeInTheDocument();
    for (let i = 0; i < 4; i++) fireEvent.click(more());
    expect(count()).toBe("6");
    expect(zipBtn()).toBeEnabled();
  });

  it("형태가 깨진 응답은 무시하고 Free + 키 입력 버튼을 유지한다", async () => {
    const bads = [
      serverOf({ tier: "gold" }),
      serverOf("pro"),
      serverOf({ tier: "pro", licensee: 5 }),
      serverOf({ tier: "pro", seats: "x" }),
      serverOf({ nothing: true }),
      serverOf({ tier: "pro" }, 500),
      vi.fn(async () => new Response("<html>", { status: 200 })),
    ];
    for (const bad of bads) {
      const { unmount } = mount(<App licenseFetch={bad} verifyLicense={verifyOk} />);
      await waitFor(() => expect(bad).toHaveBeenCalled());
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
      expect(badge()).toHaveTextContent("Free");
      expect(screen.getByRole("button", { name: "라이선스 키 입력" })).toBeInTheDocument();
      unmount();
    }
  });

  it("서버가 실패 code 를 주면 Free 로 동작하고 6단계에 LICENSE_INVALID 안내를 보인다", async () => {
    mount(<App licenseFetch={serverOf({ tier: "free", code: "LICENSE_EXPIRED" })} verifyLicense={verifyOk} />);
    await waitFor(() => expect(badge()).toHaveTextContent("만료"));
    fireEvent.click(nav().getAllByRole("button")[5]!);
    expect(screen.getByText(/Free 로 동작/)).toHaveTextContent("만료");
  });
});

describe("LIC-01 키 입력(메모리만)", () => {
  it("검증 성공: 오늘 날짜로 호출하고 Pro 가 적용되며 키는 어디에도 남지 않는다", async () => {
    const verify = vi.fn<VerifyFn>(() => PRO_INFO);
    mount(<App licenseFetch={noServer()} verifyLicense={verify} />);
    await applyKey();
    await waitFor(() => expect(badge()).toHaveTextContent("Pro"));
    expect(verify).toHaveBeenCalledWith(KEY, { today: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // 대화상자를 닫은 뒤 DOM 어디에도 키가 없다
    expect(document.body.innerHTML).not.toContain(KEY);
    expect([...document.querySelectorAll("input,textarea")].some((e) => (e as HTMLInputElement).value.includes("AF1."))).toBe(false);
    for (const s of [localStorage, sessionStorage]) expect(s.length).toBe(0);
    expect(window.location.href).not.toContain("AF1");
    // 생성물에도 들어가지 않는다
    fireEvent.click(zipBtn()!);
    await waitFor(() => expect(toZip).toHaveBeenCalled());
    const files = toZip.mock.calls[0]![0];
    expect(files.some((f) => f.content.includes(KEY) || f.content.includes("ACME Corp"))).toBe(false);
  });

  it("새로 고침(다시 마운트)하면 Free 로 돌아간다", async () => {
    const first = mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    await applyKey();
    await waitFor(() => expect(badge()).toHaveTextContent("Pro"));
    first.unmount();
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    expect(badge()).toHaveTextContent("Free");
  });

  it.each([
    ["LICENSE_FORMAT", "형식"],
    ["LICENSE_SIGNATURE", "서명"],
    ["LICENSE_EXPIRED", "만료"],
    ["LICENSE_UNKNOWN_KID", "발급 키"],
  ] as const)("검증 실패 %s: 코드별 문구를 보이고 Free 유지", async (code, word) => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyFail(code)} />);
    await applyKey();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(word);
    expect(badge()).toHaveTextContent("Free");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("영어 전환 시 실패 문구가 영어다", async () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyFail("LICENSE_SIGNATURE")} />);
    await act(async () => { await i18n.changeLanguage("en"); });
    const dlg = await openDialog("Enter license key");
    fireEvent.change(within(dlg).getByLabelText("License key"), { target: { value: KEY } });
    fireEvent.click(within(dlg).getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/signature/i);
  });

  it("빈 키는 적용할 수 없고 취소하면 닫힌다", async () => {
    const verify = vi.fn<VerifyFn>(() => PRO_INFO);
    mount(<App licenseFetch={noServer()} verifyLicense={verify} />);
    const dlg = await openDialog();
    expect(within(dlg).getByRole("button", { name: "적용" })).toBeDisabled();
    fireEvent.click(within(dlg).getByRole("button", { name: "취소" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });
});

describe("LIC-01 제한 해제·재적용", () => {
  it("LICENSE_LIMIT 상태에서 Pro 를 적용하면 풀리고, 해제하면 다시 막힌다", async () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    fireEvent.click(more());
    expect(zipBtn()).not.toBeInTheDocument();
    await applyKey();
    await waitFor(() => expect(zipBtn()).toBeEnabled());
    expect(count()).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "라이선스 해제" }));
    expect(badge()).toHaveTextContent("Free");
    expect(zipBtn()).not.toBeInTheDocument();
  });

  it("6단계에서 제한 오류의 이동 버튼이 1단계로 연결된다", () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    fireEvent.click(more());
    fireEvent.click(nav().getAllByRole("button")[5]!);
    fireEvent.click(screen.getAllByRole("button", { name: "요구사항 단계로 이동" })[0]!);
    expect(screen.getByRole("heading", { name: ko.req.title })).toBeInTheDocument();
  });

  it("영어 전환 시 제한 안내가 영어다", async () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    fireEvent.click(more());
    await act(async () => { await i18n.changeLanguage("en"); });
    expect(screen.getByRole("alert")).toHaveTextContent(/up to 2 developers/);
  });
});

describe("LIC-01 리뷰 보강", () => {
  it("parseLicenseResponse: pro+code 는 Free, 모르는 code·잘못된 expires·seats 상한 초과는 무시(null)", () => {
    expect(parseLicenseResponse({ tier: "pro", code: "LICENSE_EXPIRED" })).toMatchObject({ tier: "free", code: "LICENSE_EXPIRED" });
    expect(parseLicenseResponse({ tier: "pro", code: "LICENSE_WEIRD" })).toBeNull();
    expect(parseLicenseResponse({ tier: "pro", expires: "내일" })).toBeNull();
    expect(parseLicenseResponse({ tier: "pro", seats: 10001 })).toBeNull();
    expect(parseLicenseResponse({ tier: "pro", seats: 10000 })).not.toBeNull();
  });

  it("서버가 pro+LICENSE_EXPIRED 를 주면 화면은 Free(상한 2)다", async () => {
    mount(<App licenseFetch={serverOf({ tier: "pro", code: "LICENSE_EXPIRED" })} verifyLicense={verifyOk} />);
    await waitFor(() => expect(badge()).toHaveTextContent("만료"));
    expect(badge()).toHaveTextContent("Free");
    fireEvent.click(more());
    expect(screen.getByRole("alert")).toHaveTextContent("2명");
  });

  it("buildPreview(draft, license): 라이선스를 받아 LICENSE_LIMIT 을 낸다", () => {
    const three = resizeDevs(initialDraft(), 3);
    expect(buildPreview(three).issues.some((i) => i.code === "LICENSE_LIMIT")).toBe(true);
    expect(buildPreview(three).exportable).toBe(false);
    expect(buildPreview(three, { tier: "pro" }).issues.some((i) => i.code === "LICENSE_LIMIT")).toBe(false);
    expect(buildPreview(three, { tier: "pro" }).exportable).toBe(true);
  });

  it("toLicenseResult 어댑터: Free 는 undefined, Pro 는 ok, 서버 실패 code 는 실패 결과", () => {
    expect(toLicenseResult({ tier: "free" })).toBeUndefined();
    expect(toLicenseResult({ tier: "pro", licensee: "A", seats: 1, expires: null })).toMatchObject({ ok: true, tier: "pro" });
    expect(toLicenseResult({ tier: "free", code: "LICENSE_EXPIRED" })).toEqual({ ok: false, code: "LICENSE_EXPIRED" });
  });

  it("Free 에서 3명 -> 2명으로 줄이면 제한이 풀린다", () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    fireEvent.click(more());
    expect(zipBtn()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "개발자 줄이기" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(zipBtn()).toBeEnabled();
  });

  it("LICENSE_LIMIT 이면 GitHub 올리기 버튼이 비활성이다", async () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    fireEvent.click(more());
    fireEvent.click(nav().getAllByRole("button")[5]!);
    fireEvent.click(await screen.findByRole("button", { name: "GitHub 내보내기" }));
    expect(await screen.findByRole("button", { name: /^GitHub 에 올리기/ })).toBeDisabled();
  });

  it("verify 가 예외를 던지면 LICENSE_FORMAT 문구로 처리한다", async () => {
    mount(<App licenseFetch={noServer()} verifyLicense={() => { throw new Error("boom"); }} />);
    await applyKey();
    expect(await screen.findByRole("alert")).toHaveTextContent("형식");
    expect(badge()).toHaveTextContent("Free");
  });

  it("적용 중에는 버튼이 재진입되지 않는다", async () => {
    let resolve!: (r: ReturnType<VerifyFn> extends Promise<infer R> | infer R ? R : never) => void;
    const verify = vi.fn<VerifyFn>(() => new Promise((r) => { resolve = r; }));
    mount(<App licenseFetch={noServer()} verifyLicense={verify} />);
    await applyKey();
    const dlg = screen.getByRole("dialog");
    expect(within(dlg).getByRole("button", { name: "적용" })).toBeDisabled();
    fireEvent.click(within(dlg).getByRole("button", { name: "적용" }));
    expect(verify).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(PRO_INFO); });
    await waitFor(() => expect(badge()).toHaveTextContent("Pro"));
  });

  it("Esc 로 닫히고 포커스가 열기 버튼으로 돌아온다. 초기 포커스는 입력란", async () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    const opener = await screen.findByRole("button", { name: "라이선스 키 입력" });
    opener.focus();
    const dlg = await openDialog();
    await waitFor(() => expect(within(dlg).getByLabelText("라이선스 키")).toHaveFocus());
    fireEvent.keyDown(dlg, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "라이선스 키 입력" })).toHaveFocus();
  });

  it("서버 결과가 확정되면 열린 대화상자가 닫힌다", async () => {
    let release!: () => void;
    const slow = vi.fn(() => new Promise<Response>((r) => { release = () => r(json({ tier: "team", licensee: "X" })); }));
    mount(<App licenseFetch={slow as unknown as typeof fetch} verifyLicense={verifyOk} />);
    await openDialog();
    await act(async () => { release(); });
    await waitFor(() => expect(badge()).toHaveTextContent("Team"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("배지에 접근성 이름이 있다", () => {
    mount(<App licenseFetch={noServer()} verifyLicense={verifyOk} />);
    expect(screen.getByRole("group", { name: "라이선스 등급" })).toBe(badge());
  });
});

describe("LIC-01 문구", () => {
  it("ko·en 모두 LICENSE_* 키를 갖는다", () => {
    type Bag = { issue: Record<string, string>; license: { error: Record<string, string>; tier: Record<string, string> } };
    for (const bag of [ko, en] as unknown as Bag[]) {
      for (const k of ["LICENSE_LIMIT", "LICENSE_INVALID"]) expect(bag.issue[k]).toBeTruthy();
      for (const k of ["LICENSE_FORMAT", "LICENSE_SIGNATURE", "LICENSE_EXPIRED", "LICENSE_UNKNOWN_KID"]) expect(bag.license.error[k]).toBeTruthy();
      for (const k of ["free", "pro", "team"]) expect(bag.license.tier[k]).toBeTruthy();
    }
  });
});
