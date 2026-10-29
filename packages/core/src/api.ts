import type { z } from "zod";
import { mergeClaudeMdImpl } from "./merge-claude-md.js";
import { renderProject } from "./render/index.js";
import { MAX_DEVELOPERS, ProjectSchema, type Project, type ProjectInput } from "./schema/index.js";
import { shQuote as quote } from "./util/sh.js";

// core 공개 API(design.md 3장).

export type IssueLevel = "error" | "warn" | "info" | "ok";
export interface Issue {
  readonly level: IssueLevel;
  readonly code: string;
  readonly path: readonly (string | number)[];
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

export interface RenderedFile {
  readonly path: string;
  readonly content: string;
  readonly mode: 0o644 | 0o755;
  /** template = 결정적 렌더, ai-fill = 사용자 Claude Code가 채우거나 보완하는 파일 */
  readonly author: "template" | "ai-fill";
}

export interface ValidateOptions {
  /** 등급별 개발자 상한(LIC-01). 기본 6. */
  readonly tierLimit?: number;
}

export interface ValidateResult {
  readonly project?: Project;
  readonly issues: readonly Issue[];
}

const SAMPLE_REQUIREMENT = `사내 주문 관리 포털을 만든다.
- 영업 담당자가 주문을 등록·조회·수정한다(주문 상태: 접수 → 출고 → 완료).
- 결제 수단별 결제 내역을 조회하고 월별 정산 리포트를 엑셀로 내려받는다.
- 관리자는 사용자·권한·공통 코드를 관리한다.
- 사내 폐쇄망에서 운영, 기존 Oracle 19c 주문 테이블을 그대로 사용한다.
- 화면은 React, 서버는 Node(TypeScript). 동시 사용자 200명.`;

/** 화면 첫 상태. PoC DEF()(v6)와 같은 값. */
export function defaultDraft(): ProjectInput {
  return {
    schemaVersion: 1,
    name: "order-portal",
    language: "ko",
    requirement: SAMPLE_REQUIREMENT,
    uiDesign: true,
    commands: { install: "npm ci", test: "npm test", e2e: "npm run e2e" },
    maxRejects: 3,
    agents: {
      planner: { provider: "claude", model: "opus" },
      analyst: { provider: "claude", model: "opus" },
      "ux-designer": { provider: "claude", model: "opus" },
      architect: { provider: "claude", model: "opus" },
      "common-dev": { provider: "claude", model: "sonnet" },
      integrator: { provider: "claude", model: "sonnet" },
    },
    developerCount: 3,
    devs: [
      { domain: "order", paths: ["src/order/", "tests/order/"], dev: { provider: "vllm", model: "exaone-32b" }, review: { provider: "claude", model: "sonnet" } },
      { domain: "payment", paths: ["src/payment/", "tests/payment/"], dev: { provider: "vllm", model: "exaone-32b" }, review: { provider: "claude", model: "sonnet" } },
      { domain: "admin", paths: ["src/admin/", "tests/admin/"], dev: { provider: "openrouter", model: "qwen/qwen3-coder:free" }, review: { provider: "claude", model: "sonnet" } },
    ],
    skills: { conventions: true, tdd: true },
    imported: [],
    connections: { vllmUrl: "http://10.0.0.5:8000", ollamaUrl: "http://localhost:11434" },
  };
}

function toIssue(i: z.core.$ZodIssue): Issue {
  const path = i.path.map((p) => (typeof p === "symbol" ? String(p) : p));
  const custom = i.code === "custom" ? (i as z.core.$ZodIssueCustom).params : undefined;
  if (custom && typeof custom["code"] === "string") {
    const { code, ...params } = custom as Record<string, string | number | boolean>;
    return { level: "error", code: String(code), path, params };
  }
  // 패턴 오류는 schema/patterns.ts 의 { error: "PROJECT_NAME" } 코드를 그대로 쓴다
  if (/^[A-Z][A-Z0-9_]+$/.test(i.message)) return { level: "error", code: i.message, path, params: {} };
  return { level: "error", code: "SCHEMA_INVALID", path, params: { reason: i.message, zodCode: i.code } };
}

/** 입력 → 검증된 Project + 오류 목록. 오류가 하나라도 있으면 project는 없다. */
export function validate(input: unknown, opts: ValidateOptions = {}): ValidateResult {
  const tierLimit = opts.tierLimit ?? MAX_DEVELOPERS;
  const r = ProjectSchema.safeParse(input);
  const issues: Issue[] = r.success ? [] : r.error.issues.map(toIssue);
  // I2 등급 상한(LIC-01에서 주입). 스키마 상한(6)과 별개로 검사한다.
  const n = (input as { developerCount?: unknown } | null)?.developerCount;
  if (typeof n === "number" && n > tierLimit) {
    issues.push({ level: "error", code: "DEV_COUNT_OVER_TIER", path: ["developerCount"], params: { developerCount: n, tierLimit } });
  }
  return issues.length === 0 && r.success ? { project: r.data, issues } : { issues };
}

// T-401: 개발자 수 변경(PoC syncDevs)
export { resizeDevs } from "./resize.js";

// T-405: 화면 경고(PRV-04)와 내보내기 가능 여부
export { canExport, checks } from "./checks.js";

/** 생성 파일 전체. 같은 입력이면 같은 출력(design.md 4장). */
export function render(project: Project): RenderedFile[] {
  return renderProject(project);
}

/** 셸 작은따옴표 인용: a'b → 'a'''b' */
export function shQuote(value: string): string {
  return quote(value);
}

/** CLAUDE.md 재생성 병합: 마커 구간만 교체, PROJECT 구간은 old 보존. — DOC-03 */
export function mergeClaudeMd(oldMd: string, nextMd: string): string {
  return mergeClaudeMdImpl(oldMd, nextMd);
}
