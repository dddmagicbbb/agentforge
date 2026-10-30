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
  publicKeys?: Record<string, string> | undefined;
}

/** 운영 공개 키에 호출자가 주입한 키(단위 시험·시험 빌드용)를 더한다. 환경 변수로는 키를 받지 않는다 */
export function createLicenseResolver(o: LicenseResolverOptions): () => Promise<LicenseView> {
  const publicKeys: Record<string, string> = { ...LICENSE_PUBLIC_KEYS, ...o.publicKeys };

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
