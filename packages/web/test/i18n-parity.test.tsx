import { act, fireEvent, render as mount, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../src/App";
import i18n from "../src/i18n";
import ko from "../src/locales/ko.json";
import en from "../src/locales/en.json";

type Tree = { [k: string]: string | Tree };

// 중첩 객체를 점 표기 키 -> 값 맵으로 편다.
function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const vars = (s: string) => [...new Set([...s.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]!))].sort();
const koFlat = flatten(ko as Tree);
const enFlat = flatten(en as Tree);

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("ko");
  });
});

describe("I18N-01: 번역 파일 일관성", () => {
  it("ko·en 키 집합이 같다", () => {
    const koKeys = Object.keys(koFlat);
    const enKeys = Object.keys(enFlat);
    const missingInEn = koKeys.filter((k) => !(k in enFlat));
    const extraInEn = enKeys.filter((k) => !(k in koFlat));
    expect({ missingInEn, extraInEn }).toEqual({ missingInEn: [], extraInEn: [] });
  });

  it("같은 키의 {{변수}} 집합이 같다", () => {
    const mismatched = Object.keys(koFlat)
      .filter((k) => k in enFlat)
      .filter((k) => vars(koFlat[k]!).join(",") !== vars(enFlat[k]!).join(","))
      .map((k) => `${k}: ko[${vars(koFlat[k]!)}] en[${vars(enFlat[k]!)}]`);
    expect(mismatched).toEqual([]);
  });

  it("빈 문자열 값이 없다", () => {
    const empty = [
      ...Object.keys(koFlat).filter((k) => koFlat[k]!.trim() === "").map((k) => `ko:${k}`),
      ...Object.keys(enFlat).filter((k) => enFlat[k]!.trim() === "").map((k) => `en:${k}`),
    ];
    expect(empty).toEqual([]);
  });
});

describe("I18N-01: 화면 전환", () => {
  const sw = () => screen.getByRole("group", { name: "화면 언어" });

  it("시작은 ko 이고 전환 컨트롤이 있다", () => {
    mount(<App />);
    expect(within(sw()).getByRole("button", { name: "한국어" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
  });

  it("en 선택 시 단계 이름과 다음/이전이 영어로 바뀌고 ko 로 돌아온다", () => {
    mount(<App />);
    fireEvent.click(within(sw()).getByRole("button", { name: "English" }));
    const nav = screen.getByRole("navigation", { name: "Steps" });
    expect(within(nav).getAllByRole("button").map((b) => b.textContent?.trim())).toEqual(Object.values(en.steps).map((v, i) => `${i + 1} ${v}`));
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { level: 2, name: en.routine.title })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("group", { name: "Display language" })).getByRole("button", { name: "한국어" }));
    expect(screen.getByRole("button", { name: "다음" })).toBeInTheDocument();
  });

  it("화면 언어는 생성물 language 입력과 무관하다", () => {
    mount(<App />);
    fireEvent.click(within(sw()).getByRole("button", { name: "English" }));
    const select = screen.getByLabelText(en.req.language) as HTMLSelectElement;
    expect(select.value).toBe("ko");
    // 생성물(미리보기 파일 목록과 README 내용)은 화면 언어를 바꿔도 같다.
    const snapshot = () => {
      const tree = document.querySelector(".tree")!;
      const paths = [...tree.querySelectorAll("button > span:first-child")].map((e) => e.textContent);
      fireEvent.click(within(tree as HTMLElement).getByRole("button", { name: /^README.md/ }));
      return { paths, readme: document.querySelector(".preview pre")!.textContent };
    };
    const inEn = snapshot();
    fireEvent.click(within(screen.getByRole("group", { name: en.lang.switch })).getByRole("button", { name: "한국어" }));
    const inKo = snapshot();
    expect(inEn.paths.length).toBeGreaterThan(10);
    expect(inEn).toEqual(inKo);
  });
});
