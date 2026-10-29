import { z } from "zod";

// 사용자 입력이 셸·YAML·JSON·Markdown에 들어가므로 허용 패턴으로만 받는다(design.md 2.2).

/** 폴더명·tmux 세션명. 위반 시 진행 불가(REQ-02). */
export const ProjectName = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, { error: "PROJECT_NAME" });

/** 개발자 도메인. 스킬명 `devN-<domain>`이 항상 유효하도록 영문 소문자만 허용(PoC 결함 D3). */
export const Domain = z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/, { error: "DOMAIN" });

/** 모델 ID. claude는 빈 값 허용(기본 sonnet). 첫 글자는 영문·숫자(YAML 예약 문자 @ : 와 옵션 모양 - 방지, T-503). */
export const ModelId = z.string().regex(/^(?:[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127})?$/, { error: "MODEL_ID" });

const PATH_PREFIX = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*\/?$/;

/**
 * 담당 폴더 접두어. 저장소 루트 기준 상대 경로만, `.`·`..` 세그먼트 금지.
 * 정규화: 끝에 `/`를 붙여 `src/order`가 `src/orders`와 겹치지 않게 한다(PoC 결함 D4).
 */
export const PathPrefix = z
  .string()
  .regex(PATH_PREFIX, { error: "PATH_PREFIX" })
  .refine((p) => p.split("/").every((seg) => seg !== "." && seg !== ".."), { error: "PATH_DOT_SEGMENT" })
  .transform((p) => (p.endsWith("/") ? p : `${p}/`));

/** 설치·테스트·E2E 명령. 한 줄, 제어문자 금지. */
// eslint-disable-next-line no-control-regex
export const Command = z.string().min(1).max(200).regex(/^[^\u0000-\u001f\u007f]+$/, { error: "COMMAND" });

/** 제공자 주소. bash가 source 하는 env 파일에 들어가므로 userinfo·따옴표·`$`·공백 금지(PoC 결함 D6). */
export const HttpUrl = z
  .string()
  .max(200)
  .regex(/^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?(\/[A-Za-z0-9._~%/-]*)?$/, { error: "HTTP_URL" });

/** 스킬 폴더명 = frontmatter name. */
export const SkillName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/, { error: "SKILL_NAME" });
