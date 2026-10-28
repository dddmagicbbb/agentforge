import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { defaultDraft, render, resizeDevs, validate, type ProjectInput, type RenderedFile } from "@agentforge/core";

/** ② 시나리오의 최종 입력(화면 조작 결과와 같아야 한다). 이름 e2e-demo · 개발자 2명 · UI 끔. */
export function scenario2Draft(): ProjectInput {
  const d = resizeDevs({ ...defaultDraft(), name: "e2e-demo", uiDesign: false }, 2);
  const [a, b] = d.devs;
  if (!a || !b) throw new Error("개발자 2명 필요");
  return { ...d, devs: [{ ...a, domain: "alpha", paths: ["src/alpha/", "tests/alpha/"] }, { ...b, domain: "beta", paths: ["src/beta/", "tests/beta/"] }] };
}

/** 같은 입력으로 core 가 렌더한 파일(기대값) */
export function expectedFiles(draft: ProjectInput): { name: string; files: RenderedFile[] } {
  const v = validate(draft);
  if (!v.project) throw new Error(`입력 오류: ${JSON.stringify(v.issues)}`);
  return { name: v.project.name, files: render(v.project) };
}

export interface ZipEntry { readonly name: string; readonly mode: number; readonly dir: boolean }

/** ZIP 항목 목록(이름·UNIX 권한). */
export async function readZip(buf: Buffer): Promise<{ zip: JSZip; entries: ZipEntry[] }> {
  const zip = await JSZip.loadAsync(buf, { createFolders: false });
  const entries = Object.values(zip.files).map((e) => ({ name: e.name, mode: Number(e.unixPermissions ?? 0) & 0o777, dir: e.dir }));
  return { zip, entries };
}

/** ZIP 을 폴더에 풀고 권한을 적용한다(unzip 명령 없이 모든 OS 공통). */
export async function extractZip(buf: Buffer, dest: string): Promise<void> {
  const { zip, entries } = await readZip(buf);
  for (const e of entries) {
    const target = path.join(dest, e.name);
    if (e.dir) { fs.mkdirSync(target, { recursive: true }); continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const file = zip.file(e.name);
    if (!file) throw new Error(`ZIP 항목 없음: ${e.name}`);
    fs.writeFileSync(target, await file.async("nodebuffer"));
    fs.chmodSync(target, e.mode); // umask 영향 제거
  }
}

function hasCmd(cmd: string): boolean {
  return spawnSync("bash", ["-c", `command -v ${cmd}`], { stdio: "ignore" }).status === 0;
}

/** 셸 단계를 돌릴 수 없는 사유(가능하면 null) */
export function shellSkipReason(): string | null {
  if (process.platform !== "linux" && process.platform !== "darwin") return `셸 단계는 Linux/macOS 에서만 실행(현재 ${process.platform})`;
  for (const c of ["bash", "git", "tmux", "jq"]) if (!hasCmd(c)) return `${c} 없음`;
  // macOS 기본 bash 3.2 에는 mapfile 이 없어 check-forge.sh 가 동작하지 않는다
  if (spawnSync("bash", ["-c", "mapfile -t _a < /dev/null"], { stdio: "ignore" }).status !== 0) return "bash 4 이상(mapfile) 필요";
  return null;
}

/** 가짜 claude 와 격리된 git 설정이 든 환경 변수 */
export function isolatedEnv(root: string): NodeJS.ProcessEnv {
  const bin = path.join(root, "fakebin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "claude"), "#!/usr/bin/env bash\nexit 0\n", { mode: 0o755 });
  const gitconfig = path.join(root, "gitconfig");
  fs.writeFileSync(gitconfig, "[user]\n\tname = af-e2e\n\temail = af-e2e@example.com\n[init]\n\tdefaultBranch = main\n");
  return { ...process.env, PATH: `${bin}${path.delimiter}${process.env["PATH"] ?? ""}`, GIT_CONFIG_GLOBAL: gitconfig, GIT_CONFIG_NOSYSTEM: "1" };
}

export function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
