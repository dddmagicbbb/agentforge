import fs from "node:fs";
import { expect, test, type Download, type Page } from "@playwright/test";
import { defaultDraft, mergeClaudeMd } from "@agentforge/core";
import { expectedFiles, readZip } from "./helpers.js";

// T-615 E2E: I18N-01(화면 영어 전환·생성물 언어) · DOC-03(기존 CLAUDE.md 병합)
// design.md 8.1·8.5. 각 시나리오는 독립이다(ZIP 을 서로 이어 쓰지 않는다).

const HANGUL = /[\uAC00-\uD7A3]/;
const EN_STEPS = ["Requirements", "Routine and sequential-stage agents", "Agents per developer", "Skills", "Connection and parallel run", "Generate"];
const EN_REQUIREMENT = "Build an order management portal. Sales staff register, view and edit orders.";

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 2, name, exact: true });

async function saveDownload(d: Download): Promise<Buffer> {
  return fs.readFileSync(await d.path());
}

async function zipText(buf: Buffer, projectName: string, relPath: string): Promise<string> {
  const { zip } = await readZip(buf);
  const f = zip.file(`${projectName}/${relPath}`);
  if (!f) throw new Error(`ZIP 항목 없음: ${projectName}/${relPath}`);
  return f.async("string");
}

// 6단계(생성)까지 "다음" 을 눌러 이동. 버튼 이름은 화면 언어에 따른다.
async function goToLastStep(page: Page, next: string): Promise<void> {
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: next, exact: true }).click();
}

// ---------------------------------------------------------------- I18N-01 (a) 화면 en 전환

test("I18N-01 (a) 화면 영어 전환: 단계 이름·버튼이 영어이고 ZIP 내용은 화면 언어와 무관", async ({ page }) => {
  await page.goto("/");
  // 새로 열면 ko
  await expect(page.getByRole("heading", { level: 2, name: "요구사항", exact: true })).toBeVisible();

  const group = page.getByRole("group", { name: "화면 언어" });
  await group.getByRole("button", { name: "English" }).click();
  // 전환 후 그룹 접근명도 영어
  await expect(page.getByRole("group", { name: "Display language" })).toBeVisible();

  for (let i = 0; i < EN_STEPS.length; i++) {
    await expect(heading(page, EN_STEPS[i]!)).toBeVisible();
    if (i < EN_STEPS.length - 1) await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download ZIP" }).click()]);
  const buf = await saveDownload(download);

  // 화면 언어는 생성물에 영향이 없다: 생성 파일 전체(경로·내용)가 language=ko 의 core 렌더와 같다
  const { name, files } = expectedFiles(defaultDraft());
  const { zip, entries } = await readZip(buf);
  expect(entries.filter((e) => !e.dir).map((e) => e.name).sort()).toEqual(files.map((f) => `${name}/${f.path}`).sort());
  for (const f of files) expect(await zip.file(`${name}/${f.path}`)!.async("string"), f.path).toBe(f.content);

  // 선택은 저장하지 않는다: 새로 열면 ko
  await page.reload();
  await expect(page.getByRole("heading", { level: 2, name: "요구사항", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "화면 언어" })).toBeVisible();
});

// ---------------------------------------------------------------- I18N-01 (b) 생성물 언어 en

test("I18N-01 (b) language=en: ZIP 의 README·CLAUDE.md 가 영어(한글 없음)이고 core 렌더와 같다", async ({ page }) => {
  await page.goto("/");
  // 화면은 ko 그대로 두고 생성물 언어만 en 으로
  await page.getByLabel("답변·문서 언어").selectOption("en");
  await page.getByLabel(/자유 문장/).fill(EN_REQUIREMENT);
  await goToLastStep(page, "다음");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ZIP 다운로드" }).click()]);
  const buf = await saveDownload(download);

  const draft = { ...defaultDraft(), language: "en" as const, requirement: EN_REQUIREMENT };
  const { name, files } = expectedFiles(draft);
  for (const p of ["README.md", "CLAUDE.md"]) {
    const text = await zipText(buf, name, p);
    expect(text, `${p} 에 한글이 있으면 안 된다`).not.toMatch(HANGUL);
    expect(text, p).toBe(files.find((f) => f.path === p)!.content);
  }
});

// ---------------------------------------------------------------- DOC-03 (c) 기존 CLAUDE.md 병합

const OLD_MD = [
  "# My team rules",
  "USER-LINE-BEFORE keep this exactly",
  "<!-- AGENTFORGE:PROJECT:BEGIN -->",
  "USER-PROJECT-NOTE keep inside project section",
  "<!-- AGENTFORGE:PROJECT:END -->",
  "USER-LINE-AFTER keep this too",
  "<!-- AGENTFORGE:AGENTS:BEGIN -->",
  "STALE-AGENTS must be replaced",
  "<!-- AGENTFORGE:AGENTS:END -->",
  "",
].join("\n");

// 6단계 "기존 CLAUDE.md 붙여넣기(선택)" 입력(T-624 접근명 확정). 마커 오류는 aria-invalid="true" 와 #doc-error 로 표시된다.
const pasteBox = (page: Page) => page.getByLabel("기존 CLAUDE.md 붙여넣기(선택)");

test("DOC-03 (c) 기존 CLAUDE.md 를 붙여넣으면 ZIP 의 CLAUDE.md 에 마커 밖 사용자 텍스트·PROJECT 구간이 보존된다", async ({ page }) => {
  await page.goto("/");
  await goToLastStep(page, "다음");
  await pasteBox(page).fill(OLD_MD);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "ZIP 다운로드" }).click()]);
  const buf = await saveDownload(download);

  const { name, files } = expectedFiles(defaultDraft());
  const next = files.find((f) => f.path === "CLAUDE.md")!.content;
  const text = await zipText(buf, name, "CLAUDE.md");
  // 사용자 텍스트와 PROJECT 구간은 그대로
  expect(text).toContain("USER-LINE-BEFORE keep this exactly");
  expect(text).toContain("USER-LINE-AFTER keep this too");
  expect(text).toContain("USER-PROJECT-NOTE keep inside project section");
  // 나머지 자동 구간은 새로 생성한 내용으로 채워진다(core 병합 결과와 동일)
  expect(text).toBe(mergeClaudeMd(OLD_MD, next));
  expect(text).toContain("AGENTFORGE:AGENTS:BEGIN");
  // 교체 규칙 2: AGENTS 구간 안쪽은 next 내용으로 바뀌어 옛 내용이 남지 않는다
  expect(text).not.toContain("STALE-AGENTS");
});

test("DOC-03 (c) 마커 짝이 맞지 않으면 ZIP 버튼이 비활성이다", async ({ page }) => {
  await page.goto("/");
  await goToLastStep(page, "다음");
  // AGENTS 구간에 BEGIN 만 있고 END 가 없다
  await pasteBox(page).fill("# rules\n<!-- AGENTFORGE:AGENTS:BEGIN -->\nbroken\n");
  await expect(pasteBox(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#doc-error")).toBeVisible();
  // 정상 버튼(ZIP 다운로드) 또는 오류 차단 버튼(오류 N건을 먼저 해결하세요) 중 어느 쪽이든 활성 상태가 아니어야 한다
  const zipButtons = page.getByRole("button", { name: /ZIP 다운로드|먼저 해결/ });
  await expect(zipButtons.first()).toBeVisible();
  for (const b of await zipButtons.all()) await expect(b).toBeDisabled();
});
