import type { z } from "zod";
import type { ProjectShape } from "./project.js";

// 필드 사이의 불변식(design.md 2.3). 위반은 code가 붙은 custom issue로 보고한다.

type Ctx = z.RefinementCtx;

function report(ctx: Ctx, code: string, path: (string | number)[], params: Record<string, string | number> = {}): void {
  ctx.addIssue({ code: "custom", message: code, path, params: { code, ...params } });
}

/** dev가 준비됐는지(domain·paths 모두 채움). 준비 안 된 dev는 /forge-agents에 위임한다. */
export function devReady(d: { domain: string; paths: readonly string[] }): boolean {
  return d.domain !== "" && d.paths.length > 0;
}

export function invariants(p: ProjectShape, ctx: Ctx): void {
  // I1 개발자 수와 devs 길이 일치
  if (p.developerCount !== p.devs.length) {
    report(ctx, "DEV_COUNT_MISMATCH", ["developerCount"], { developerCount: p.developerCount, devs: p.devs.length });
  }

  p.devs.forEach((d, i) => {
    // I3 domain·paths는 둘 다 채우거나 둘 다 비움(부분 생성 금지)
    if ((d.domain === "") !== (d.paths.length === 0)) {
      report(ctx, "DEV_PARTIAL", ["devs", i], { dev: i + 1 });
    }
    // I5 비 Claude 제공자는 모델 ID 필수
    for (const role of ["dev", "review"] as const) {
      if (d[role].provider !== "claude" && d[role].model === "") {
        report(ctx, "MODEL_MISSING", ["devs", i, role, "model"], { agent: `${role}-${i + 1}` });
      }
    }
  });

  for (const [id, a] of Object.entries(p.agents)) {
    if (a.provider !== "claude" && a.model === "") {
      report(ctx, "MODEL_MISSING", ["agents", id, "model"], { agent: id });
    }
  }

  // I4 서로 다른 개발자의 담당 폴더 접두어가 겹치지 않음(정규화된 "dir/" 기준)
  const all = p.devs.flatMap((d, i) => d.paths.map((path) => ({ dev: i + 1, path })));
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      const x = all[a]!;
      const y = all[b]!;
      if (x.dev !== y.dev && (x.path.startsWith(y.path) || y.path.startsWith(x.path))) {
        report(ctx, "PATH_OVERLAP", ["devs"], { devA: x.dev, pathA: x.path, devB: y.dev, pathB: y.path });
      }
    }
  }

  // I6 위험 항목이 있는 가져온 스킬은 사용자 확인 필수
  p.imported.forEach((m, i) => {
    if (m.flags.length > 0 && !m.acknowledged) {
      report(ctx, "IMPORT_UNACKED", ["imported", i], { id: m.id });
    }
  });
}
