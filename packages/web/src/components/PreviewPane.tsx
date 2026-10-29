import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RenderedFile } from "@agentforge/core";

/** 우측 미리보기: 파일 트리(AI·755 표시) + 선택 파일 내용 */
export function PreviewPane({ files }: { files: readonly RenderedFile[] }) {
  const { t } = useTranslation();
  const [sel, setSel] = useState("CLAUDE.md");
  const cur = files.find((f) => f.path === sel) ?? files[0];
  return (
    <section className="preview">
      <h2>{t("preview.title")} <small>{t("preview.count", { count: files.length })}</small></h2>
      {files.length === 0 ? <p className="sub">{t("preview.none")}</p> : null}
      <div className="tree">
        {files.map((f) => (
          <button type="button" key={f.path} aria-current={f.path === cur?.path} onClick={() => setSel(f.path)}>
            <span>{f.path}</span>
            <span>
              {f.author === "ai-fill" ? <b className="ai">{t("preview.ai")}</b> : null}
              {f.mode === 0o755 ? <b className="x">{t("preview.exec")}</b> : null}
            </span>
          </button>
        ))}
      </div>
      <pre>{cur ? cur.content || t("preview.empty") : ""}</pre>
    </section>
  );
}
