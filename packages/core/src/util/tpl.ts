import { AppError } from "../errors.js";

// PoC 템플릿 자리표시({{KEY}}) 치환(ADR-0002). 값의 `$` 등이 특수 패턴으로 해석되지 않게 split/join 사용.

/** 모든 {{KEY}} 를 치환한다. */
export function fillAll(tpl: string, key: string, value: string): string {
  return tpl.split(`{{${key}}}`).join(value);
}

/** 첫 {{KEY}} 하나만 치환한다(PoC String.prototype.replace 와 같은 동작). */
export function fillFirst(tpl: string, key: string, value: string): string {
  const token = `{{${key}}}`;
  const i = tpl.indexOf(token);
  return i < 0 ? tpl : tpl.slice(0, i) + value + tpl.slice(i + token.length);
}

/** 앱이 치환해야 하는 템플릿에 자리표시가 남았는지 확인한다. */
export function assertFilled(name: string, out: string): string {
  const left = out.match(/\{\{[A-Z_]+\}\}/);
  if (left) throw new AppError("TPL_UNFILLED", { template: name, placeholder: left[0] });
  return out;
}
