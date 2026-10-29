import type { Issue } from "./api.js";
import { scanSkillRisk, type SkillFileLike } from "./market/risk.js";
import { provider } from "./providers/index.js";
import { PROVIDER_IDS, type ProjectInput, type ProviderIdT } from "./schema/index.js";

// 화면 경고(PRV-04). PoC checks() 와 같은 조건·순서. 검증 전 입력도 받으므로 어떤 값이 와도 throw 하지 않는다.

const KNOWN = new Set<string>(PROVIDER_IDS);
const REQ_MIN = 30;

interface Agent {
  provider: string;
  model: string;
}
interface DevView {
  domain: string;
  paths: string[];
  dev: Agent;
  review: Agent;
}
type Path = (string | number)[];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function fileList(v: unknown): SkillFileLike[] | null {
  if (!Array.isArray(v)) return null;
  const out: SkillFileLike[] = [];
  for (const f of v) {
    if (!isObj(f) || typeof f["path"] !== "string" || typeof f["content"] !== "string") return null;
    out.push({ path: f["path"], content: f["content"] });
  }
  return out;
}

function agentOf(v: unknown): Agent {
  const o = isObj(v) ? v : {};
  return { provider: str(o["provider"]), model: str(o["model"]) };
}

function devOf(v: unknown): DevView {
  const o = isObj(v) ? v : {};
  const raw = Array.isArray(o["paths"]) ? o["paths"] : [];
  // D4: 끝에 "/" 를 붙여 비교한다
  const paths = raw.filter((p): p is string => typeof p === "string" && p.trim() !== "").map((p) => (p.endsWith("/") ? p : `${p}/`));
  return { domain: str(o["domain"]).trim(), paths, dev: agentOf(o["dev"]), review: agentOf(o["review"]) };
}

const via = (a: Agent) => (KNOWN.has(a.provider) ? provider(a.provider as ProviderIdT).via : undefined);

export function checks(input: ProjectInput): Issue[] {
  const out: Issue[] = [];
  const add = (level: Issue["level"], code: string, path: Path = [], params: Issue["params"] = {}) => {
    out.push({ level, code, path, params });
  };
  const p: Record<string, unknown> = isObj(input) ? input : {};

  const name = str(p["name"]).trim();
  // slug: PoC slug() 와 같은 변환(화면이 "이렇게 바뀝니다" 로 보여 줄 제안값)
  const slug = name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "my-project";
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) add("error", "NAME_INVALID", ["name"], { name, slug });

  const reqLen = str(p["requirement"]).trim().length;
  if (reqLen < REQ_MIN) add("warn", "REQ_SHORT", ["requirement"], { length: reqLen, min: REQ_MIN });

  const devs = (Array.isArray(p["devs"]) ? p["devs"] : []).map(devOf);
  const all = devs.flatMap((d, i) => d.paths.map((path) => ({ dev: i + 1, path })));
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      const x = all[a]!;
      const y = all[b]!;
      if (x.dev !== y.dev && (x.path.startsWith(y.path) || y.path.startsWith(x.path))) {
        add("error", "PATH_OVERLAP", ["devs"], { devA: x.dev, pathA: x.path, devB: y.dev, pathB: y.path });
      }
    }
  }

  devs.forEach((d, i) => {
    if (!(d.domain !== "" && d.paths.length > 0)) add("info", "DEV_DEFERRED", ["devs", i], { dev: i + 1 });
  });

  // render 의 allAgents 와 같은 순서: 순차(ux-designer 는 uiDesign 일 때만) → dev/review 쌍 → integrator
  const ag = isObj(p["agents"]) ? p["agents"] : {};
  const seq = ["planner", "analyst", ...(p["uiDesign"] === false ? [] : ["ux-designer"]), "architect", "common-dev"];
  const agents: { name: string; path: Path; a: Agent }[] = [
    ...seq.map((id) => ({ name: id, path: ["agents", id, "model"], a: agentOf(ag[id]) })),
    ...devs.flatMap((d, i) => [
      { name: `dev-${i + 1}`, path: ["devs", i, "dev", "model"], a: d.dev },
      { name: `review-${i + 1}`, path: ["devs", i, "review", "model"], a: d.review },
    ]),
    { name: "integrator", path: ["agents", "integrator", "model"], a: agentOf(ag["integrator"]) },
  ];
  for (const e of agents) {
    if (e.a.provider !== "claude" && e.a.model.trim() === "") add("error", "MODEL_MISSING", e.path, { agent: e.name });
  }

  devs.forEach((d, i) => {
    if (d.dev.provider === "claude" && d.review.provider !== "claude") add("warn", "REVIEW_WEAKER", ["devs", i, "review"], { dev: i + 1 });
  });

  const free = agents.filter((e) => e.a.provider === "openrouter" && /:free$/.test(e.a.model)).length;
  if (free > 0) add("warn", "OPENROUTER_FREE_LIMIT", [], { count: free });

  if (agents.some((e) => via(e.a) === "litellm")) add("info", "GATEWAY_REQUIRED");
  if (agents.some((e) => via(e.a) === "vllm")) add("info", "VLLM_TOOL_PARSER");

  (Array.isArray(p["imported"]) ? p["imported"] : []).forEach((m, i) => {
    const o = isObj(m) ? m : {};
    // files 가 올바른 형태면 invariants 와 같이 원문에서 다시 계산, 아니면 입력 flags 기준
    const files = fileList(o["files"]);
    const risky = files ? scanSkillRisk(files).length > 0 : Array.isArray(o["flags"]) && o["flags"].length > 0;
    // 위험 코드를 화면에 알린다(불변식 위반은 validate 가 보고하므로 여기서 중복하지 않는다)
    const codes = files ? scanSkillRisk(files) : Array.isArray(o["flags"]) ? o["flags"].filter((f): f is string => typeof f === "string") : [];
    if (codes.length > 0) add("info", "IMPORT_RISK", ["imported", i], { id: str(o["id"]), codes: codes.join(",") });
    if (risky && o["acknowledged"] !== true) {
      add("error", "IMPORT_UNACKED", ["imported", i], { id: str(o["id"]) });
    }
  });

  if (p["uiDesign"] === false) add("info", "UI_OFF", ["uiDesign"]);
  if (p["devcontainer"] === true) add("info", "DEVCONTAINER_CLOSED_NET", ["devcontainer"]);

  if (!out.some((i) => i.level === "error" || i.level === "warn")) out.unshift({ level: "ok", code: "ALL_OK", path: [], params: {} });
  return out;
}

/** 오류(error) 항목이 없을 때만 내보내기 가능. */
export function canExport(issues: readonly Issue[]): boolean {
  return !issues.some((i) => i.level === "error");
}
