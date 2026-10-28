import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/*.generated.ts", "docs/**", "templates/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // core 는 순수 함수만: I/O·시간·난수·환경 변수 금지(ADR-0001)
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["node:*", "fs", "fs/*", "path", "os", "child_process", "http", "https", "net", "crypto"], message: "core 는 I/O 를 할 수 없습니다(ADR-0001)." }] }],
      "no-restricted-globals": ["error", { name: "process", message: "core 는 환경 변수를 읽지 않습니다." }, { name: "fetch", message: "core 는 네트워크를 쓰지 않습니다." }, { name: "localStorage", message: "core 는 저장소를 쓰지 않습니다." }],
      "no-restricted-syntax": [
        "error",
        { selector: "NewExpression[callee.name='Date']", message: "core 는 현재 시각을 쓰지 않습니다(날짜는 인자로 주입)." },
        { selector: "MemberExpression[object.name='Date'][property.name='now']", message: "core 는 현재 시각을 쓰지 않습니다." },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: "core 는 난수를 쓰지 않습니다(결정적 출력)." },
      ],
    },
  },
  {
    files: ["tools/**/*.mjs", "eslint.config.js"],
    languageOptions: { globals: { process: "readonly", console: "readonly", URL: "readonly" } },
  },
);
