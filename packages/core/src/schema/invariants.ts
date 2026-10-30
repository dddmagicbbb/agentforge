import type { z } from "zod";
import { parseSkillMd, scanSkillRisk, unquote } from "../market/risk.js";
import type { ProjectShape } from "./project.js";

// 필드 사이의 불변식(design.md 2.3). 위반은 code가 붙은 custom issue로 보고한다.

type Ctx = z.RefinementCtx;

/** 가져온 스킬 1개의 파일 내용 합계 상한(자) */
export const IMPORT_MAX_TOTAL = 512_000;

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

  // I6 위험 항목이 있는 가져온 스킬은 사용자 확인 필수.
  // files 가 있으면 입력 flags 를 믿지 않고 원문에서 다시 계산한다(조작 방지, ADR-0007).
  p.imported.forEach((m, i) => {
    const risky = m.files ? scanSkillRisk(m.files).length > 0 : m.flags.length > 0;
    if (risky && !m.acknowledged) report(ctx, "IMPORT_UNACKED", ["imported", i], { id: m.id });
    if (!m.files) return;
    const skillMd = m.files.find((f) => f.path === "SKILL.md");
    if (!skillMd) report(ctx, "IMPORT_NO_SKILL_MD", ["imported", i], { id: m.id });
    else {
      const name = parseSkillMd(skillMd.content).fm?.["name"];
      if (name === undefined || unquote(name) !== m.id) report(ctx, "IMPORT_NAME_MISMATCH", ["imported", i], { id: m.id });
    }
    const seen = new Set<string>();
    for (const f of m.files) {
      if (seen.has(f.path)) report(ctx, "IMPORT_DUP_PATH", ["imported", i], { id: m.id, path: f.path });
      seen.add(f.path);
    }
    const total = m.files.reduce((n, f) => n + f.content.length, 0);
    if (total > IMPORT_MAX_TOTAL) report(ctx, "IMPORT_TOO_LARGE", ["imported", i], { id: m.id, size: total, max: IMPORT_MAX_TOTAL });
  });
}
