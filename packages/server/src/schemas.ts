// 입력 검증(zod). 값은 모두 허용 패턴만 통과한다. 토큰 값 필드는 받지 않는다(strict).
import { GitBranch, HttpUrl, SkillName } from "@agentforge/core";
import { z } from "zod";

const Id = SkillName;
const Trust = z.enum(["official", "org", "community", "unverified"]);
/** 서버 환경 변수 이름. 다른 비밀 변수(PATH, 관리 설정 등)를 읽지 못하도록 AF_MARKET_TOKEN_ 접두만 허용 */
export const TOKEN_ENV_PREFIX = "AF_MARKET_TOKEN_";
const TokenEnv = z.string().regex(/^AF_MARKET_TOKEN_[A-Z0-9_]{1,40}$/);
/** 저장소 안 하위 경로: 상대, 세그먼트 [A-Za-z0-9._-], `.`·`..` 금지 */
const SubPath = z
  .string()
  .max(200)
  .regex(/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/)
  .refine((p) => p.split("/").every((s) => s !== "." && s !== ".."));

const common = { id: Id, trust: Trust.default("unverified"), tokenEnv: TokenEnv.optional(), ref: GitBranch.optional(), path: SubPath.optional() };

const GithubSource = z
  .object({
    kind: z.literal("github"),
    ...common,
    owner: z.string().regex(/^[A-Za-z0-9-]{1,39}$/),
    // repo 가 . 또는 .. 이면 /repos/o/../commits 처럼 API 경로를 벗어난다
    repo: z.string().regex(/^[A-Za-z0-9._-]{1,100}$/).refine((r) => r !== "." && r !== ".."),
    baseUrl: HttpUrl.optional(),
  })
  .strict()
  // 토큰을 보내는 소스는 https 만(Bearer 평문 전송 방지)
  .refine((v) => !v.tokenEnv || !v.baseUrl || v.baseUrl.startsWith("https://"), { path: ["baseUrl"] });

/** https:// 또는 file:/// (file 은 서버 환경에서 허용했을 때만, app 에서 추가 검사) */
const GitUrl = z
  .string()
  .max(300)
  .regex(/^(https:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~%/-]*)?|file:\/\/\/[A-Za-z0-9._~%:/-]+)$/);

const GitSource = z
  .object({ kind: z.literal("git"), ...common, url: GitUrl })
  .strict()
  .refine((v) => !v.tokenEnv || v.url.startsWith("https://"), { path: ["url"] });

export const SourceInput = z.discriminatedUnion("kind", [GithubSource, GitSource]);
export type SourceInputT = z.infer<typeof SourceInput>;

export const RefreshInput = z.object({ id: Id.optional() }).strict();
export const SearchQuery = z.object({ q: z.string().max(100).optional(), trust: Trust.optional() }).strict();
export const SkillParams = z.object({ sourceId: Id, skillId: Id });
export const SourceParams = z.object({ id: Id });
