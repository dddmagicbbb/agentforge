import { expect, test, type Page, type Route } from "@playwright/test";

// EXP-02 E2E: 6단계 GitHub 푸시. 계약상 baseUrl 은 https 전용이라 실제 서버 대신
// 브라우저에서 https://api.github.com 요청을 가로채 가짜 응답을 준다.

const TOKEN = "ghp_E2ESecretTokenValue0123456789";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };

interface Seen { method: string; path: string; auth: string | undefined; body: unknown }

/** 가짜 GitHub. fail: "METHOD /path" → 상태 코드 */
async function fakeGithub(page: Page, fail: Record<string, number> = {}): Promise<Seen[]> {
  const seen: Seen[] = [];
  await page.route("https://api.github.com/**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const raw = req.postData();
    seen.push({ method, path: url.pathname, auth: req.headers()["authorization"], body: raw ? JSON.parse(raw) : undefined });
    const key = `${method} ${url.pathname}`;
    const json = (status: number, data: unknown) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(data) });
    if (fail[key]) return json(fail[key]!, { message: "fake failure" });
    if (key === "GET /user") return json(200, { login: "me" });
    if (key === "POST /user/repos") return json(201, { default_branch: "main", html_url: "https://github.com/me/demo-repo" });
    if (key === "POST /repos/me/demo-repo/git/trees") return json(201, { sha: "tree0001" });
    if (key === "POST /repos/me/demo-repo/git/commits") return json(201, { sha: "commit0001" });
    if (key === "PATCH /repos/me/demo-repo/git/refs/heads/main") return json(200, { ref: "refs/heads/main" });
    return json(404, { message: "unexpected" });
  });
  return seen;
}

async function openGithub(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /^6 생성/ }).click();
  await page.getByRole("button", { name: "GitHub 내보내기" }).click();
  await page.getByLabel("소유자(owner)").fill("me");
  await page.getByLabel("저장소(repo)").fill("demo-repo");
  await page.getByLabel("공개 범위").selectOption("private");
  await page.getByLabel("방식").selectOption("create");
}

const tokenInput = (page: Page) => page.getByLabel("토큰(저장하지 않음, 한 번만 사용)");
const push = async (page: Page) => {
  await tokenInput(page).fill(TOKEN);
  await page.getByRole("button", { name: "GitHub 에 올리기" }).click();
};

function watchLeaks(page: Page): string[] {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  page.on("pageerror", (e) => logs.push(String(e)));
  return logs;
}

test("푸시 성공: 요청 순서·mode·부모 없음·force·링크·토큰 지움·토큰 미노출", async ({ page }) => {
  const logs = watchLeaks(page);
  const seen = await fakeGithub(page);
  await openGithub(page);
  await push(page);

  const result = page.getByTestId("github-result");
  await expect(result).toBeVisible();
  await expect(result.getByRole("link", { name: "https://github.com/me/demo-repo" })).toHaveAttribute("href", "https://github.com/me/demo-repo");
  await expect(tokenInput(page)).toHaveValue("");

  expect(seen.map((s) => `${s.method} ${s.path}`)).toEqual([
    "GET /user",
    "POST /user/repos",
    "POST /repos/me/demo-repo/git/trees",
    "POST /repos/me/demo-repo/git/commits",
    "PATCH /repos/me/demo-repo/git/refs/heads/main",
  ]);
  expect(seen[1]!.body).toMatchObject({ name: "demo-repo", private: true });
  const trees = seen[2]!.body as { tree: { path: string; mode: string; type: string; content: string }[]; base_tree?: string };
  expect(trees.base_tree).toBeUndefined();
  expect(trees.tree.length).toBeGreaterThan(10);
  for (const it of trees.tree) {
    expect(typeof it.content, it.path).toBe("string");
    expect(it.mode, it.path).toBe(it.path.endsWith(".sh") ? "100755" : "100644");
  }
  expect(trees.tree.some((it) => it.path.endsWith(".sh"))).toBe(true);
  expect(trees.tree.some((it) => /(^|\/)env\.local$/.test(it.path))).toBe(false);
  expect(seen[3]!.body).toMatchObject({ tree: "tree0001", parents: [] });
  expect(seen[4]!.body).toMatchObject({ sha: "commit0001", force: true });

  // 토큰은 Authorization 헤더에만 있다
  for (const s of seen) {
    expect(s.auth, s.path).toContain(TOKEN);
    expect(s.path).not.toContain(TOKEN);
    expect(JSON.stringify(s.body ?? "")).not.toContain(TOKEN);
  }
  expect(await page.locator("body").innerText()).not.toContain(TOKEN);
  expect(await page.content()).not.toContain(TOKEN);
  expect(logs.join("\n")).not.toContain(TOKEN);
});

test("401: GITHUB_AUTH 문구가 나오고 토큰이 지워진다", async ({ page }) => {
  const logs = watchLeaks(page);
  const seen = await fakeGithub(page, { "GET /user": 401 });
  await openGithub(page);
  await push(page);
  await expect(page.getByTestId("github-error")).toContainText("인증에 실패했습니다");
  await expect(tokenInput(page)).toHaveValue("");
  await expect(page.getByTestId("github-result")).toHaveCount(0);
  expect(seen.map((s) => s.path)).toEqual(["/user"]);
  expect(await page.locator("body").innerText()).not.toContain(TOKEN);
  expect(logs.join("\n")).not.toContain(TOKEN);
});

test("commit 단계 500: GITHUB_PARTIAL 문구와 저장소 링크", async ({ page }) => {
  const logs = watchLeaks(page);
  await fakeGithub(page, { "POST /repos/me/demo-repo/git/commits": 500 });
  await openGithub(page);
  await push(page);
  const err = page.getByTestId("github-error");
  await expect(err).toContainText("저장소(브랜치)는 생성됐지만 마무리하지 못했습니다");
  await expect(err.getByRole("link")).toHaveAttribute("href", "https://github.com/me/demo-repo");
  await expect(tokenInput(page)).toHaveValue("");
  expect(await page.locator("body").innerText()).not.toContain(TOKEN);
  expect(logs.join("\n")).not.toContain(TOKEN);
});
