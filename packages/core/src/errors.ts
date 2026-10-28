// 오류는 코드와 인자만 가진다. 사용자 문장은 web(i18n)에서 만든다.
export type AppErrorParams = Readonly<Record<string, string | number | boolean>>;

export class AppError extends Error {
  readonly code: string;
  readonly params: AppErrorParams;

  constructor(code: string, params: AppErrorParams = {}) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.params = params;
  }
}

/** PH2 시그니처만 있는 API의 본문. 구현 단계(tasks.md)에서 교체한다. */
export function notImplemented(api: string, task: string): never {
  throw new AppError("NOT_IMPLEMENTED", { api, task });
}
