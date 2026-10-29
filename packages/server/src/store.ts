// dataDir 저장: sources.json(등록 목록), index/<sourceId>.json(색인). 쓰기는 임시 파일 + rename, 변경은 직렬화한다.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SourceInput } from "./schemas.js";
import type { IndexFile, SourceRecord } from "./types.js";

export class Store {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private readonly dir: string) {}

  /** 변경 작업을 한 줄로 세운다(동시 등록·갱신으로 sources.json 이 깨지지 않게) */
  lock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => undefined);
    return next;
  }

  private get sourcesFile() {
    return join(this.dir, "sources.json");
  }

  /** 처음 시작 시 sources.json 이 없으면 기본 소스를 복사한다(있으면 건드리지 않는다) */
  async init(defaultFile: string): Promise<void> {
    await mkdir(join(this.dir, "index"), { recursive: true });
    try {
      await readFile(this.sourcesFile);
      return;
    } catch {
      /* 없음 -> 기본 소스 복사 */
    }
    let sources: SourceRecord[] = [];
    try {
      const raw = JSON.parse(await readFile(defaultFile, "utf8")) as { sources?: unknown[] };
      for (const s of raw.sources ?? []) {
        const p = SourceInput.safeParse(s);
        if (p.success) sources.push(p.data as SourceRecord);
      }
    } catch {
      sources = [];
    }
    await this.writeSources(sources);
  }

  async readSources(): Promise<SourceRecord[]> {
    const raw = JSON.parse(await readFile(this.sourcesFile, "utf8")) as { sources: SourceRecord[] };
    return raw.sources;
  }

  async writeSources(sources: SourceRecord[]): Promise<void> {
    await this.atomicWrite(this.sourcesFile, { sources });
  }

  /** id 는 호출 전에 SkillName 패턴으로 검증된 값이어야 한다 */
  async readIndex(id: string): Promise<IndexFile | null> {
    try {
      return JSON.parse(await readFile(join(this.dir, "index", `${id}.json`), "utf8")) as IndexFile;
    } catch {
      return null;
    }
  }

  async writeIndex(id: string, index: IndexFile): Promise<void> {
    await this.atomicWrite(join(this.dir, "index", `${id}.json`), index);
  }

  async deleteIndex(id: string): Promise<void> {
    await rm(join(this.dir, "index", `${id}.json`), { force: true });
  }

  private async atomicWrite(file: string, data: unknown): Promise<void> {
    const tmp = `${file}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmp, file);
  }
}
