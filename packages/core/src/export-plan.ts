import type { RenderedFile } from "./api.js";
import { AppError } from "./errors.js";

export interface GithubTreeEntry {
  path: string;
  mode: "100755" | "100644";
  content: string;
}

/** GitHub tree 계획(EXP-02). 모드는 RenderedFile.mode 를 따른다(ZIP 과 동일). ZIP 과 같은 RenderedFile[] 에서 만든다. `env.local` 경로가 있으면 거부한다. */
export function planGithubTree(files: readonly RenderedFile[]): GithubTreeEntry[] {
  return files.map((f) => {
    if (/(^|\/)env\.local$/.test(f.path)) throw new AppError("EXPORT_SECRET_PATH", { path: f.path });
    return { path: f.path, mode: f.mode === 0o755 ? "100755" : "100644", content: f.content };
  });
}
