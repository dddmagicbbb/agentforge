import { generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { makeServer, tmpDir } from "./helpers.js";

// 시험 키 쌍(kid "test")과 발급기
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const PUB_HEX = Buffer.from(publicKey.export({ format: "jwk" }).x as string, "base64url").toString("hex");
function issue(over: Record<string, unknown> = {}, signer = privateKey): string {
  const payload = { v: 1, kid: "test", id: "id-1", tier: "pro", licensee: "ACME", seats: 5, issued: "2026-01-01", expires: "2027-01-01", ...over };
  const head = `AF1.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  return `${head}.${sign(null, Buffer.from(head), signer).toString("base64url")}`;
}
const TEST_ENV = {};
const PUBKEYS = { test: PUB_HEX };
const NOW = () => new Date("2026-06-01T12:00:00Z");

async function get(env: Record<string, string>, extra: Record<string, unknown> = {}) {
  const { app, dataDir } = await makeServer({ env, now: NOW, publicKeys: PUBKEYS, ...extra });
  return { app, dataDir, res: await app.inject({ method: "GET", url: "/api/license", headers: { host: "localhost" } }) };
}

describe("T-811 GET /api/license", () => {
  it("키가 없으면 free", async () => {
    const { res } = await get({});
    expect(res.json()).toEqual({ tier: "free" });
  });

  it("env AF_LICENSE 로 pro 검증, 키 원문은 응답에 없다", async () => {
    const key = issue();
    const { res } = await get({ ...TEST_ENV, AF_LICENSE: key });
    expect(res.json()).toEqual({ tier: "pro", licensee: "ACME", seats: 5, expires: "2027-01-01" });
    expect(res.body).not.toContain(key.split(".")[1]!);
  });

  it("dataDir/license.key 파일에서도 읽고, env 가 파일보다 우선한다", async () => {
    const dataDir = tmpDir("af-lic-");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "license.key"), issue({ tier: "team", licensee: "FILE" }) + "\n");
    const a = await makeServer({ env: TEST_ENV, now: NOW, dataDir, publicKeys: PUBKEYS });
    expect((await a.app.inject({ url: "/api/license", headers: { host: "localhost" } })).json()).toMatchObject({ tier: "team", licensee: "FILE" });
    const b = await makeServer({ env: { ...TEST_ENV, AF_LICENSE: issue({ licensee: "ENV" }) }, now: NOW, dataDir, publicKeys: PUBKEYS });
    expect((await b.app.inject({ url: "/api/license", headers: { host: "localhost" } })).json()).toMatchObject({ tier: "pro", licensee: "ENV" });
  });

  it("만료는 now 기준 free+LICENSE_EXPIRED (만료일 당일은 유효)", async () => {
    const key = issue({ expires: "2026-05-31" });
    expect((await get({ ...TEST_ENV, AF_LICENSE: key })).res.json()).toEqual({ tier: "free", code: "LICENSE_EXPIRED" });
    const same = issue({ expires: "2026-06-01" });
    expect((await get({ ...TEST_ENV, AF_LICENSE: same })).res.json()).toMatchObject({ tier: "pro" });
  });

  it("위조·형식 오류는 free+code", async () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    expect((await get({ ...TEST_ENV, AF_LICENSE: issue({}, other) })).res.json()).toEqual({ tier: "free", code: "LICENSE_SIGNATURE" });
    expect((await get({ ...TEST_ENV, AF_LICENSE: "garbage" })).res.json()).toEqual({ tier: "free", code: "LICENSE_FORMAT" });
  });

  it("env 로는 시험 공개 키를 받지 않는다(NODE_ENV=test·AF_ALLOW_TEST_LICENSE=1 이어도 무시)", async () => {
    const env = { NODE_ENV: "test", AF_ALLOW_TEST_LICENSE: "1", AF_LICENSE_TEST_PUBKEY: PUB_HEX, AF_LICENSE: issue() };
    const { app } = await makeServer({ env, now: NOW });
    const res = await app.inject({ url: "/api/license", headers: { host: "localhost" } });
    expect(res.json()).toEqual({ tier: "free", code: "LICENSE_UNKNOWN_KID" });
  });

  it("로그·오류에 키 원문이 없다", async () => {
    const key = issue();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { res } = await get({ AF_LICENSE: key });
    expect(JSON.stringify(spy.mock.calls) + res.body).not.toContain(key);
    spy.mockRestore();
  });

  it("health.license 는 등급", async () => {
    const { app } = await makeServer({ env: { ...TEST_ENV, AF_LICENSE: issue() }, now: NOW, publicKeys: PUBKEYS });
    expect((await app.inject({ url: "/api/market/health", headers: { host: "localhost" } })).json()).toMatchObject({ ok: true, license: "pro" });
    const f = await makeServer({ env: {}, now: NOW });
    expect((await f.app.inject({ url: "/api/market/health", headers: { host: "localhost" } })).json()).toMatchObject({ license: "free" });
  });
});
