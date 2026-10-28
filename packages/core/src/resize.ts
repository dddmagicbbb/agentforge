import { AppError } from "./errors.js";
import { MAX_DEVELOPERS, type ProjectInput } from "./schema/index.js";

type DevInput = ProjectInput["devs"][number];

function emptyDev(): DevInput {
  return { domain: "", paths: [], dev: { provider: "claude", model: "sonnet" }, review: { provider: "claude", model: "sonnet" } };
}

/** 개발자 수 변경(PoC syncDevs). 원본은 수정하지 않는다. 범위는 1~6. */
export function resizeDevs(draft: ProjectInput, n: number): ProjectInput {
  if (!Number.isInteger(n) || n < 1 || n > MAX_DEVELOPERS) {
    throw new AppError("DEV_COUNT_RANGE", { n: Number.isFinite(n) ? n : String(n), min: 1, max: MAX_DEVELOPERS });
  }
  const devs = draft.devs.slice(0, n).map((d) => structuredClone(d));
  while (devs.length < n) devs.push(emptyDev());
  return { ...draft, developerCount: n, devs };
}
