// 시험 빌드 전용: 환경 변수의 시험 공개 키를 읽는다. 기본(운영) 빌드에서는 호출 분기가 컴파일 시점에 제거된다(run.ts 의 __AF_TEST_LICENSE__).
const HEX = /^[0-9a-fA-F]{64}$/;

export function loadTestKeys(env: Record<string, string | undefined>, warn: (msg: string) => void): Record<string, string> | undefined {
  const v = env["AF_LICENSE_TEST_PUBKEY"];
  if (!v) return undefined;
  if (!HEX.test(v)) {
    warn("AF_LICENSE_TEST_PUBKEY 형식이 올바르지 않아 무시합니다.");
    return undefined;
  }
  return { test: v };
}
