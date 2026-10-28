import JSZip from "jszip";
import { AppError, type RenderedFile } from "@agentforge/core";

// 같은 입력이면 같은 ZIP 바이트가 나오도록 항목 시각을 고정한다(ZIP 날짜는 1980년 이후만 표현 가능).
const FIXED_DATE = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));

/**
 * RenderedFile[] → ZIP. 모든 항목은 `<root>/<path>`, 실행 권한은 UNIX 외부 속성(755/644)으로 보존한다.
 * 내용과 mode 는 바꾸지 않는다(ADR-0001).
 */
export async function toZip(files: readonly RenderedFile[], root: string): Promise<Uint8Array> {
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(root)) throw new AppError("ZIP_ROOT_INVALID", { root });
  const seen = new Set<string>();
  const zip = new JSZip();
  for (const f of files) {
    if (seen.has(f.path)) throw new AppError("ZIP_DUPLICATE_PATH", { path: f.path });
    if (f.path.startsWith("/") || f.path.split("/").includes("..")) throw new AppError("ZIP_PATH_INVALID", { path: f.path });
    seen.add(f.path);
    zip.file(`${root}/${f.path}`, f.content, { unixPermissions: f.mode, date: FIXED_DATE, createFolders: false });
  }
  return zip.generateAsync({ type: "uint8array", platform: "UNIX", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
