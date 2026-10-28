/** 셸 작은따옴표 인용: a'b → 'a'\''b' */
export function shQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

// 따옴표 없이도 단어 하나로 해석되는 문자만(틸드·글롭·변수·공백 제외)
const SAFE_WORD = /^[A-Za-z0-9._:/@%+=,-]+$/;

/** 안전한 단어는 그대로, 아니면 shQuote. 스키마 패턴과 함께 이중 방어(PoC 결함 D5·D6). */
export function shWord(value: string): string {
  return SAFE_WORD.test(value) ? value : shQuote(value);
}
