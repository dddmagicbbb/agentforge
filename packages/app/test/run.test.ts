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

  it("라이선스 파일을 읽어 AF_LICENSE 로 서버에 넘긴다", async () => {
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

  it("라이선스 파일이 없으면 안내 후 Free 로 계속(종료 아님), AF_LICENSE 는 비움", async () => {
    const f = fixtures();
    const warns: string[] = [];
    const seen: Record<string, string | undefined> = {};
    const app = await startApp(
      { port: 0, host: "127.0.0.1", data: join(f.root, "data"), admin: false, licenseFile: join(f.root, "none.key") },
      { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: { AF_LICENSE: "stale" }, onEnv: (e) => Object.assign(seen, e), onWarn: (m) => warns.push(m) },
    );
    try {
      const res = await fetch(`http://127.0.0.1:${app.address.port}/api/license`);
      expect(await res.json()).toEqual({ tier: "free" });
    } finally {
      await app.close();
    }
    expect(warns).toHaveLength(1);
    expect(warns[0]).not.toContain(f.root);
    expect(seen["AF_LICENSE"]).toBeUndefined();
  });

  it("라이선스 파일이 형식 오류면 /api/license 는 free+code", async () => {
    const f = fixtures();
    const licenseFile = join(f.root, "bad.key");
    writeFileSync(licenseFile, "AF1.x.y");
    const app = await startApp(
      { port: 0, host: "127.0.0.1", data: join(f.root, "data"), admin: false, licenseFile },
      { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: {} },
    );
    try {
      const res = await fetch(`http://127.0.0.1:${app.address.port}/api/license`);
      expect(await res.json()).toEqual({ tier: "free", code: "LICENSE_FORMAT" });
    } finally {
      await app.close();
    }
  });

  it("기본(운영) 빌드는 AF_LICENSE_TEST_PUBKEY·AF_ALLOW_TEST_LICENSE 를 넣어도 시험 키를 인정하지 않는다", async () => {
    const { generateKeyPairSync, sign } = await import("node:crypto");
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pub = Buffer.from(publicKey.export({ format: "jwk" }).x as string, "base64url").toString("hex");
    const payload = { v: 1, kid: "test", id: "i", tier: "pro", licensee: "X", seats: 1, issued: "2026-01-01", expires: null };
    const head = `AF1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
    const key = `${head}.${sign(null, Buffer.from(head), privateKey).toString("base64url")}`;
    const f = fixtures();
    const app = await startApp(
      { port: 0, host: "127.0.0.1", data: join(f.root, "data"), admin: false },
      { webDist: f.webDist, defaultSourcesFile: f.defaultSourcesFile, scan: scanSkillRisk, env: { NODE_ENV: "test", AF_ALLOW_TEST_LICENSE: "1", AF_LICENSE_TEST_PUBKEY: pub, AF_LICENSE: key } },
    );
    try {
      const res = await fetch(`http://127.0.0.1:${app.address.port}/api/license`);
      expect(await res.json()).toEqual({ tier: "free", code: "LICENSE_UNKNOWN_KID" });
    } finally {
      await app.close();
    }
  });
});
