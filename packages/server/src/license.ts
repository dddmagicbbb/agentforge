// LIC-01 서버 라이선스 조회: env AF_LICENSE > dataDir/license.key. 검증은 core verifyLicense. 키 원문은 응답·로그에 쓰지 않는다.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LICENSE_PUBLIC_KEYS, verifyLicense } from "@agentforge/core";

export interface LicenseView {
  tier: "free" | "pro" | "team";
  licensee?: string;
  seats?: number;
  expires?: string | null;
  code?: string;
}

export interface LicenseResolverOptions {
  dataDir: string;
  env: Record<string, string | undefined>;
  now: () => Date;
  logWarn: (msg: string) => void;
}

const HEX = /^[0-9a-fA-F]{64}$/;

/** 시험 공개 키는 NODE_ENV=test 또는 AF_ALLOW_TEST_LICENSE=1 일 때만 추가한다(운영 키 위조 경로 차단) */
export function createLicenseResolver(o: LicenseResolverOptions): () => Promise<LicenseView> {
  const publicKeys: Record<string, string> = { ...LICENSE_PUBLIC_KEYS };
  const testKey = o.env["AF_LICENSE_TEST_PUBKEY"];
  if (testKey) {
    if (o.env["NODE_ENV"] === "test" || o.env["AF_ALLOW_TEST_LICENSE"] === "1") {
      if (HEX.test(testKey)) publicKeys["test"] = testKey;
      else o.logWarn("AF_LICENSE_TEST_PUBKEY 형식이 올바르지 않아 무시합니다.");
    } else {
      o.logWarn("AF_LICENSE_TEST_PUBKEY 는 시험 환경(NODE_ENV=test 또는 AF_ALLOW_TEST_LICENSE=1)이 아니므로 무시합니다.");
    }
  }

  return async () => {
    let key = o.env["AF_LICENSE"]?.trim();
    if (!key) {
      try {
        key = (await readFile(join(o.dataDir, "license.key"), "utf8")).trim();
      } catch {
        key = undefined;
      }
    }
    if (!key) return { tier: "free" };
    const r = verifyLicense(key, { today: o.now().toISOString().slice(0, 10), publicKeys });
    if (!r.ok) return { tier: "free", code: r.code };
    return { tier: r.tier, licensee: r.licensee, seats: r.seats, expires: r.expires };
  };
}
