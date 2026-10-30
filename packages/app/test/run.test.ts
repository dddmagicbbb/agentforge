import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer as netServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanSkillRisk } from "@agentforge/core";
import { startApp, type RunningApp } from "../src/run.js";

const roots: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "af-app-"));
  roots.push(d);
  return d;
}
afterAll(() => {
  for (const d of roots) rmSync(d, { recursive: true, force: true });
});

// 시험용 web dist 와 기본 소스 (실제 산출물과 같은 모양)
function fixtures() {
  const root = tmp();
  const webDist = join(root, "web");
  mkdirSync(webDist);
  writeFileSync(join(webDist, "index.html"), "<!doctype html><title>AgentForge</title>");
  const defaultSourcesFile = join(root, "market-sources.json");
  writeFileSync(defaultSourcesFile, JSON.stringify({ sources: [{ id: "anthropic-skills", kind: "github", owner: "anthropics", repo: "skills", trust: "official" }] }));
  return { root, webDist, defaultSourcesFile };
}

const JSON_POST = { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } as const;

async function boot(over: { admin?: boolean; port?: number } = {}): Promise<{ app: RunningApp; base: string }> {
  const f = fixtures();
  const app = await startApp(
    { port: over.port ?? 0, host: "127.0.0.1", data: join(f.root, "data"), admin: over.admin ?? false },
    { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: {} },
  );
  return { app, base: `http://127.0.0.1:${app.address.port}` };
}

describe("startApp", () => {
  it("/ 와 /api/market/health 가 200", async () => {
    const { app, base } = await boot();
    try {
      const root = await fetch(`${base}/`);
      expect(root.status).toBe(200);
      expect(await root.text()).toContain("AgentForge");
      const h = await fetch(`${base}/api/market/health`);
      expect(h.status).toBe(200);
      expect(await h.json()).toMatchObject({ admin: false });
    } finally {
      await app.close();
    }
  });

  it("--admin 이 없으면 관리 API 는 403 ADMIN_DISABLED", async () => {
    const { app, base } = await boot();
    try {
      const r = await fetch(`${base}/api/market/sources`, JSON_POST);
      expect(r.status).toBe(403);
      expect(await r.json()).toMatchObject({ code: "ADMIN_DISABLED" });
    } finally {
      await app.close();
    }
  });

  it("--admin 이면 관리 API 가 열린다 (본문 검증 단계까지 간다: 400)", async () => {
    const { app, base } = await boot({ admin: true });
    try {
      expect(((await (await fetch(`${base}/api/market/health`)).json()) as { admin: boolean }).admin).toBe(true);
      expect((await fetch(`${base}/api/market/sources`, JSON_POST)).status).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("외부에서 들어온 AF_MARKET_ADMIN=1 도 --admin 이 없으면 무시한다", async () => {
    const f = fixtures();
    const app = await startApp(
      { port: 0, host: "127.0.0.1", data: join(f.root, "data"), admin: false },
      { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: { AF_MARKET_ADMIN: "1" } },
    );
    try {
      expect((await fetch(`http://127.0.0.1:${app.address.port}/api/market/sources`, JSON_POST)).status).toBe(403);
    } finally {
      await app.close();
    }
  });

  it("종료하면 포트가 해제된다", async () => {
    const { app } = await boot();
    const { port } = app.address;
    await app.close();
    await new Promise<void>((resolve, reject) => {
      const s = netServer();
      s.once("error", reject);
      s.listen({ port, host: "127.0.0.1" }, () => s.close(() => resolve()));
    });
  });

  it("close 는 두 번 불러도 안전하다", async () => {
    const { app } = await boot();
    await app.close();
    await expect(app.close()).resolves.toBeUndefined();
  });

  it("이미 쓰는 포트면 기동이 거부된다", async () => {
    const { app } = await boot();
    try {
      await expect(boot({ port: app.address.port })).rejects.toThrow();
    } finally {
      await app.close();
    }
  });

  it("라이선스 파일을 읽어 AF_LICENSE 로 서버에 넘긴다 (T-811 연결 자리)", async () => {
    const f = fixtures();
    const licenseFile = join(f.root, "license.key");
    writeFileSync(licenseFile, "  AF1.x.y\n");
    const seen: Record<string, string | undefined> = {};
    const app = await startApp(
      { port: 0, host: "127.0.0.1", data: join(f.root, "data"), admin: false, licenseFile },
      { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: {}, onEnv: (e) => Object.assign(seen, e) },
    );
    await app.close();
    expect(seen["AF_LICENSE"]).toBe("AF1.x.y");
  });

  it("라이선스 파일이 없으면 LICENSE_FILE 오류", async () => {
    const f = fixtures();
    await expect(
      startApp({ port: 0, host: "127.0.0.1", data: join(f.root, "data"), admin: false, licenseFile: join(f.root, "none.key") }, { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: {} }),
    ).rejects.toMatchObject({ code: "LICENSE_FILE" });
  });
});
