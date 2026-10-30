import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { freePort, isolatedGitEnv, makeGitRepo, readZip, repoRoot, tmpDir } from "./helpers.js";

// MKT-01·02 E2E: 마켓 서버(webDist 같이 제공, 같은 출처) + file:// 소스 → 검색·미리보기·위험 확인·가져오기 → ZIP 원문·sources.lock
test.describe.configure({ mode: "serial" });

const SAFE_MD = "---\nname: safe-skill\ndescription: 안전한 시험용 스킬\n---\n# safe-skill\n본문 <b>태그처럼 보이는 글자</b>\n";
const SAFE_REF = "# 참고\n추가 문서 원문\n";
const RISKY_MD = "---\nname: risky-skill\ndescription: 위험한 시험용 스킬\n---\n# risky-skill\n스크립트를 쓴다\n";
const RISKY_SH = "#!/usr/bin/env bash\necho risky\n";

interface Running { readonly base: string; readonly child: ChildProcess; readonly data: string }
const cleanup: string[] = [];
const servers: ChildProcess[] = [];

async function startServer(extra: Record<string, string>): Promise<Running> {
  const port = await freePort();
  const data = tmpDir("af-e2e-market-data-");
  cleanup.push(data);
  // 서버가 띄우는 git clone 이 개발자 PC 의 ~/.gitconfig 를 읽지 않게 HOME 을 임시 폴더로 돌린다
  const home = tmpDir("af-e2e-market-home-");
  cleanup.push(home);
  const root = repoRoot();
  const child = spawn(process.execPath, [path.join(root, "packages/server/dist/main.js")], {
    cwd: root,
    env: { ...process.env, ...isolatedGitEnv(home), PORT: String(port), AF_MARKET_DATA: data, AF_WEB_DIST: path.join(root, "packages/web/dist"), ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  servers.push(child);
  const base = `http://127.0.0.1:${port}`;
  // health 응답이 올 때까지 대기(최대 20초)
  let err = "";
  child.stderr?.on("data", (d: Buffer) => { err += d.toString(); });
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`마켓 서버가 종료됨: ${err}`);
    try {
      if ((await fetch(`${base}/api/market/health`)).ok) return { base, child, data };
    } catch { /* 아직 기동 전 */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`마켓 서버 기동 시간 초과: ${err}`);
}

let repoUrl = "";
let admin: Running;

test.beforeAll(async () => {
  const repo = tmpDir("af-e2e-market-repo-");
  cleanup.push(repo);
  makeGitRepo(repo, {
    "safe-skill/SKILL.md": SAFE_MD,
    "safe-skill/reference.md": SAFE_REF,
    "risky-skill/SKILL.md": RISKY_MD,
    "risky-skill/scripts/run.sh": RISKY_SH,
  });
  repoUrl = pathToFileURL(repo).href;
  admin = await startServer({ AF_MARKET_ADMIN: "1", AF_ALLOW_FILE_SOURCES: "1" });
});

test.afterAll(async () => {
  for (const c of servers) if (c.exitCode === null) c.kill();
  await new Promise((r) => setTimeout(r, 300));
  for (const d of cleanup) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

const gotoSkills = async (page: Page, base: string) => {
  await page.goto(base);
  await page.getByRole("button", { name: /^4 스킬/ }).click();
  await expect(page.getByRole("region", { name: "마켓" })).toBeVisible();
};

test("마켓 전체 흐름: 등록·갱신·검색·미리보기·위험 확인·ZIP 원문·sources.lock", async ({ page }) => {
  await gotoSkills(page, admin.base);
  // 서버 감지 → 관리 UI 보임
  await expect(page.getByRole("button", { name: "소스 등록", exact: true })).toBeVisible();

  await page.getByLabel("종류").selectOption("git");
  await page.getByLabel("소스 ID").fill("local");
  await page.getByLabel("저장소 URL").fill(repoUrl);
  await page.getByRole("button", { name: "소스 등록", exact: true }).click();
  await expect(page.locator(".msrc li", { hasText: "local" })).toBeVisible();

  await page.getByRole("button", { name: "전체 갱신" }).click();
  await expect(page.locator(".msrc li", { hasText: "local" }).locator("span.sub")).toBeVisible(); // 짧은 sha 표시

  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.getByTestId("hit-safe-skill")).toBeVisible();
  await expect(page.getByTestId("hit-risky-skill")).toBeVisible();

  // 미리보기: SKILL.md 원문이 텍스트로(HTML 로 해석되지 않는다)
  await page.getByTestId("hit-safe-skill").getByRole("button", { name: "미리보기" }).click();
  await expect(page.getByTestId("skill-md")).toHaveText(SAFE_MD);
  await expect(page.getByTestId("market-preview").locator("b")).toHaveCount(0);

  await page.getByTestId("hit-safe-skill").getByRole("button", { name: "가져오기" }).click();
  await expect(page.getByTestId("imp-safe-skill")).toBeVisible();
  await page.getByTestId("hit-risky-skill").getByRole("button", { name: "가져오기" }).click();
  await expect(page.getByTestId("imp-risky-skill")).toBeVisible();

  // 위험 확인 전에는 ZIP 차단
  await page.getByRole("button", { name: /^6 생성/ }).click();
  await expect(page.getByRole("button", { name: /^오류 \d+건을 먼저 해결하세요$/ })).toBeDisabled();
  await page.getByRole("button", { name: /^4 스킬/ }).click();
  await page.getByRole("checkbox", { name: "위험 항목을 확인했고 포함합니다 (risky-skill)" }).check();
  await page.getByRole("button", { name: /^6 생성/ }).click();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ZIP 다운로드" }).click()]);
  const buf = fs.readFileSync(await download.path());
  const { zip, entries } = await readZip(buf);
  const root = download.suggestedFilename().replace(/-agentforge\.zip$/, "");
  const text = async (rel: string) => zip.file(`${root}/${rel}`)!.async("string");
  const mode = (rel: string) => entries.find((e) => e.name === `${root}/${rel}`)?.mode;

  expect(await text(".claude/skills/safe-skill/reference.md")).toBe(SAFE_REF);
  expect(await text(".claude/skills/safe-skill/SKILL.md")).toBe(SAFE_MD);
  expect(await text(".claude/skills/risky-skill/scripts/run.sh")).toBe(RISKY_SH);
  expect(mode(".claude/skills/risky-skill/scripts/run.sh")).toBe(0o644); // 실행 불가

  const lock = JSON.parse(await text(".agentforge/sources.lock")) as { version: number; skills: { id: string; src: string; ref: string | null; flags: string[]; files: { path: string; sha256: string }[] }[] };
  expect(lock.skills.map((s) => s.id).sort()).toEqual(["risky-skill", "safe-skill"]);
  const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
  const expected: Record<string, Record<string, string>> = {
    "safe-skill": { "SKILL.md": SAFE_MD, "reference.md": SAFE_REF },
    "risky-skill": { "SKILL.md": RISKY_MD, "scripts/run.sh": RISKY_SH },
  };
  for (const s of lock.skills) {
    expect(s.ref, `${s.id} ref`).toBeTruthy();
    expect(s.src).toContain(repoUrl);
    for (const [p, content] of Object.entries(expected[s.id]!)) expect(s.files.find((f) => f.path === p)?.sha256, `${s.id}/${p}`).toBe(sha(content));
  }
  expect(lock.skills.find((s) => s.id === "risky-skill")?.flags.length).toBeGreaterThan(0);
  expect(lock.skills.find((s) => s.id === "safe-skill")?.flags).toEqual([]);

  expect((await text("README.md")).split("\n").filter((l) => l.includes(".agentforge/sources.lock")).length).toBeGreaterThanOrEqual(1);
});

test("관리자 모드가 꺼진 서버에서는 소스 관리 UI 가 숨겨지고 검색은 된다", async ({ page }) => {
  const ro = await startServer({ AF_ALLOW_FILE_SOURCES: "1" });
  await gotoSkills(page, ro.base);
  await expect(page.getByText("관리자 모드에서만 소스를 바꿀 수 있습니다.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "소스 등록", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "전체 갱신" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "검색", exact: true })).toBeVisible();
  // 서버도 관리 API 를 거부한다
  const res = await fetch(`${ro.base}/api/market/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  expect(res.status).toBe(403);
});
