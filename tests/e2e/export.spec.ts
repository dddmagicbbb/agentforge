import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Download, type Page } from "@playwright/test";
import { defaultDraft } from "@agentforge/core";
import { expectedFiles, extractZip, isolatedEnv, readZip, scenario2Draft, shellSkipReason, tmpDir } from "./helpers.js";

// EXP-01 E2E: 6단계 진행 → ZIP 다운로드 → 풀기 → setup.sh → check-forge.sh → 파일 목록·권한
// 시나리오 ①②가 받은 ZIP 을 ③④가 이어서 검증한다(직렬 실행).

test.describe.configure({ mode: "serial" });

const STEP_TITLES = ["요구사항", "루틴과 순차 단계 에이전트", "개발자별 에이전트", "스킬", "연결과 병렬 실행", "생성"];

const zips: { default?: Buffer; custom?: Buffer } = {};

async function saveDownload(d: Download): Promise<Buffer> {
  const p = await d.path();
  return fs.readFileSync(p);
}

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 2, name, exact: true });

async function downloadZip(page: Page): Promise<Download> {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ZIP 다운로드" }).click()]);
  return download;
}

test("① 기본값으로 1→6단계 진행 후 ZIP 다운로드", async ({ page }) => {
  await page.goto("/");
  for (let i = 0; i < STEP_TITLES.length; i++) {
    await expect(heading(page, STEP_TITLES[i]!)).toBeVisible();
    if (i < STEP_TITLES.length - 1) await page.getByRole("button", { name: "다음", exact: true }).click();
  }
  // 6단계 칩: 파일·실행 스크립트·AI 파일 수(core render 와 같아야 한다)
  const { files } = expectedFiles(defaultDraft());
  const exec = files.filter((f) => f.mode === 0o755).length;
  const ai = files.filter((f) => f.author === "ai-fill").length;
  await expect(page.getByText(`파일 ${files.length}개`, { exact: true })).toBeVisible();
  await expect(page.getByText(`실행 스크립트 ${exec}개`, { exact: true })).toBeVisible();
  await expect(page.getByText(`AI가 채울 파일 ${ai}개`, { exact: true })).toBeVisible();

  const download = await downloadZip(page);
  expect(download.suggestedFilename()).toBe("order-portal-agentforge.zip");
  zips.default = await saveDownload(download);
});

test("② 입력 변경: 폴더 겹침 오류가 ZIP 을 막고 3단계로 돌아가 고친 뒤 다운로드", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("프로젝트 이름(폴더·tmux 세션명)").fill("e2e-demo");
  await page.getByRole("button", { name: "개발자 줄이기" }).click();
  await expect(page.getByLabel("개발자 수", { exact: true })).toHaveText("2");
  await page.getByRole("checkbox", { name: "UI/UX 설계 단계 사용" }).uncheck();

  // 3단계: dev-1·dev-2 가 같은 폴더를 쓰도록 입력(겹침 오류 유발)
  await page.getByRole("button", { name: /^3 개발자/ }).click();
  await expect(heading(page, "개발자별 에이전트")).toBeVisible();
  await page.getByLabel("dev-1 도메인").fill("alpha");
  await page.getByLabel("dev-1 담당 폴더").fill("src/alpha/, tests/alpha/");
  await page.getByLabel("dev-2 도메인").fill("beta");
  await page.getByLabel("dev-2 담당 폴더").fill("src/alpha/");
  await expect(page.getByText(/담당 폴더 겹침: dev-1\(src\/alpha\/\) \/ dev-2\(src\/alpha\/\)/).first()).toBeVisible();

  // 1단계에서 ZIP 차단 + 이동 버튼
  await page.getByRole("button", { name: /^1 요구사항/ }).click();
  await expect(page.getByRole("button", { name: /^오류 \d+건을 먼저 해결하세요$/ })).toBeDisabled();
  await page.getByRole("button", { name: "개발자 단계로 이동" }).click();
  await expect(heading(page, "개발자별 에이전트")).toBeVisible();

  await page.getByLabel("dev-2 담당 폴더").fill("src/beta/, tests/beta/");
  await page.getByRole("button", { name: /^6 생성/ }).click();
  await expect(heading(page, "생성")).toBeVisible();

  const download = await downloadZip(page);
  expect(download.suggestedFilename()).toBe("e2e-demo-agentforge.zip");
  zips.custom = await saveDownload(download);
});

for (const [label, key, draft] of [
  ["기본값", "default", defaultDraft()],
  ["변경 입력", "custom", scenario2Draft()],
] as const) {
  test(`③ ZIP 검증(${label}): 루트 폴더·파일 목록·권한이 core render 결과와 같다`, async () => {
    const buf = zips[key];
    expect(buf, "선행 시나리오가 ZIP 을 받아야 한다").toBeDefined();
    const { name, files } = expectedFiles(draft);
    const { entries } = await readZip(buf!);
    const fileEntries = entries.filter((e) => !e.dir);
    expect(fileEntries.every((e) => e.name.startsWith(`${name}/`))).toBe(true);
    expect(fileEntries.map((e) => e.name).sort()).toEqual(files.map((f) => `${name}/${f.path}`).sort());
    for (const f of files) {
      const e = fileEntries.find((x) => x.name === `${name}/${f.path}`);
      expect(e?.mode, f.path).toBe(f.path.endsWith(".sh") ? 0o755 : 0o644);
      expect(e?.mode, f.path).toBe(f.mode);
    }
  });
}

test("④ 풀기 → setup.sh → 더미 문서 → check-forge.sh → 실행 권한", async () => {
  const reason = shellSkipReason();
  test.skip(reason !== null, reason ?? "");
  expect(zips.custom, "② 가 ZIP 을 받아야 한다").toBeDefined();

  const root = tmpDir("af-e2e-");
  const env = isolatedEnv(root);
  const run = (cmd: string[], cwd: string) => spawnSync("bash", cmd, { cwd, env, encoding: "utf8" });

  await extractZip(zips.custom!, root);
  const proj = path.join(root, "e2e-demo");

  const setup = run(["scripts/setup.sh"], proj);
  expect(setup.status, `${setup.stdout}\n${setup.stderr}`).toBe(0);

  fs.mkdirSync(path.join(proj, "docs"), { recursive: true });
  fs.writeFileSync(path.join(proj, "docs/prd.md"), "# PRD\n- F-001 주문 등록\n- F-002 주문 조회\n");
  fs.writeFileSync(path.join(proj, "docs/tasks.md"), "# 작업\n| T-101 | F-001 | dev-1 |\n| T-201 | F-002 | dev-2 |\n");

  const check = run(["scripts/check-forge.sh"], proj);
  expect(check.status, `${check.stdout}\n${check.stderr}`).toBe(0);
  expect(check.stdout).toContain("검증 통과");
  expect(check.stdout).not.toContain("✗");

  // 실행 권한: ZIP 의 .sh(755) 가 풀린 뒤에도 실행 가능해야 한다
  const { files } = expectedFiles(scenario2Draft());
  for (const f of files.filter((x) => x.path.endsWith(".sh"))) {
    expect(() => fs.accessSync(path.join(proj, f.path), fs.constants.X_OK), f.path).not.toThrow();
  }
});
