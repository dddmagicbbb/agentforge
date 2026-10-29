import type { RenderContext } from "./context.js";
import { text } from "./text.js";

// README.md: 받은 뒤 실행 순서(RTN-01: UI/UX 단계는 토글을 따른다). 문구는 text.ts(I18N-01).

export function renderReadme(c: RenderContext): string {
  const { p, slug } = c;
  const t = text(p.language);
  const steps = t.readmeSteps(slug, p.uiDesign).map((s, i) => `${i + 1}. \`${s}\``).join("\n");
  return t.readmeBody(slug, t.readmeRoutine(p.uiDesign), steps, (p.devcontainer === true ? t.readmeDevNote : "") + (p.imported.length > 0 ? t.readmeImportedNote : ""));
}
