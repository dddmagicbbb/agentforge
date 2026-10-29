import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ImportedSkillT } from "@agentforge/core";
import { riskText } from "../market/risk";
import { createMarketApi, MarketError, toImported, type MarketSource, type NewSource, type SearchHit, type SkillDetail, type Trust } from "../market/market-api";

interface Props {
  /** 마켓 서버 호출용 fetch(시험에서 주입). 기본은 전역 fetch */
  readonly fetchFn?: typeof fetch;
  readonly imported: readonly ImportedSkillT[];
  readonly onImport: (s: ImportedSkillT) => void;
}

const TRUSTS: readonly Trust[] = ["official", "org", "community", "unverified"];
const codeOf = (e: unknown) => (e instanceof MarketError ? e.code : "UNKNOWN");

/** 4단계 마켓(MKT-01·02). 서버가 없으면 비활성 안내만. 원문은 텍스트로만 출력한다(HTML 해석 금지). */
export function MarketPanel({ fetchFn, imported, onImport }: Props) {
  const { t } = useTranslation();
  const api = useMemo(() => createMarketApi(fetchFn ?? ((...a) => globalThis.fetch(...a))), [fetchFn]);
  const [avail, setAvail] = useState<boolean | null>(null);
  const [admin, setAdmin] = useState(false);
  const [sources, setSources] = useState<readonly MarketSource[]>([]);
  const [srcErr, setSrcErr] = useState<string | null>(null);
  const [refreshErr, setRefreshErr] = useState<Readonly<Record<string, string>>>({});
  const [form, setForm] = useState({ kind: "github", id: "", trust: "unverified", owner: "", repo: "", url: "", ref: "", path: "", baseUrl: "", tokenEnv: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [trust, setTrust] = useState("");
  const [hits, setHits] = useState<readonly SearchHit[] | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<SkillDetail | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);
  const importedIds = useMemo(() => new Set(imported.map((m) => m.id)), [imported]);
  // 가져오기 진행 중 id(같은 버튼 연타·중복 요청 방지)
  const inflight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const errText = (raw: string) => {
    const code = /^[A-Za-z_]+$/.test(raw) ? raw : "UNKNOWN";
    return t(`market.error.${code}`, { code, defaultValue: t("market.error.UNKNOWN", { code }) });
  };

  const loadSources = async () => {
    try {
      setSources(await api.sources());
      setSrcErr(null);
    } catch (e) {
      setSrcErr(codeOf(e));
    }
  };

  useEffect(() => {
    let alive = true;
    void api.health().then((h) => {
      if (!alive) return;
      setAvail(h !== null);
      setAdmin(h?.admin === true);
      if (h) void loadSources();
    });
    return () => { alive = false; };
  }, [api]);

  if (avail === null) return <p className="sub">{t("market.checking")}</p>;
  if (!avail) return <p className="sub">{t("market.unavailable")}</p>;

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (code: string | null, id?: string) => (code ? <p className="issues" role="alert" id={id}>{errText(code)}</p> : null);

  const register = async () => {
    const opt = (k: "ref" | "path" | "baseUrl" | "tokenEnv") => (form[k].trim() ? { [k]: form[k].trim() } : {});
    const body: NewSource =
      form.kind === "git"
        ? { kind: "git", id: form.id.trim(), trust: form.trust as Trust, url: form.url.trim(), ...opt("ref"), ...opt("path"), ...opt("tokenEnv") }
        : { kind: "github", id: form.id.trim(), trust: form.trust as Trust, owner: form.owner.trim(), repo: form.repo.trim(), ...opt("ref"), ...opt("path"), ...opt("baseUrl"), ...opt("tokenEnv") };
    try {
      await api.addSource(body);
      setFormErr(null);
      setForm((f) => ({ ...f, id: "", owner: "", repo: "", url: "", ref: "", path: "", baseUrl: "", tokenEnv: "" }));
      await loadSources();
    } catch (e) {
      setFormErr(codeOf(e));
    }
  };

  const remove = async (id: string) => {
    try {
      await api.removeSource(id);
      await loadSources();
    } catch (e) {
      setSrcErr(codeOf(e));
    }
  };

  const refresh = async (id?: string) => {
    try {
      const res = await api.refresh(id);
      setRefreshErr(Object.fromEntries(res.filter((r) => !r.ok && r.code).map((r) => [r.id, r.code!])));
      setSrcErr(null);
      await loadSources();
    } catch (e) {
      setSrcErr(codeOf(e));
    }
  };

  const search = async () => {
    try {
      setHits(await api.search(q.trim(), trust));
      setSearchErr(null);
    } catch (e) {
      setSearchErr(codeOf(e));
    }
  };

  const showPreview = async (h: SearchHit) => {
    try {
      setPreview(await api.skill(h.sourceId, h.id));
      setActErr(null);
    } catch (e) {
      setPreview(null);
      setActErr(codeOf(e));
    }
  };

  const doImport = async (h: SearchHit) => {
    if (inflight.current.has(h.id) || importedIds.has(h.id)) return;
    inflight.current.add(h.id);
    setPending(new Set(inflight.current));
    try {
      onImport(toImported(await api.skill(h.sourceId, h.id)));
      setActErr(null);
    } catch (e) {
      setActErr(codeOf(e));
    } finally {
      inflight.current.delete(h.id);
      setPending(new Set(inflight.current));
    }
  };

  const skillMd = preview?.files.find((f) => f.path === "SKILL.md");

  return (
    <section className="market" aria-label={t("market.region")}>
      <h4>{t("market.sources")}</h4>
      {err(srcErr)}
      <ul className="msrc">
        {sources.map((s) => {
          const code = refreshErr[s.id] ?? s.lastError;
          return (
            <li key={s.id}>
              <strong>{s.id}</strong> <span className="chip">{t(`market.trust.${s.trust}`)}</span>{" "}
              <code>{s.kind === "git" ? s.url : `${s.owner}/${s.repo}`}</code>
              {s.lastSha ? <span className="sub"> · {s.lastSha.slice(0, 7)}</span> : null}
              {code ? <span className="issues"> {errText(code)}</span> : null}{" "}
              {admin ? <button type="button" aria-label={t("market.removeSource", { id: s.id })} onClick={() => void remove(s.id)}>{t("market.remove")}</button> : null}
            </li>
          );
        })}
      </ul>
      {admin ? (
        <>
      <div className="row"><button type="button" onClick={() => void refresh()}>{t("market.refreshAll")}</button></div>

      <h4>{t("market.addTitle")}</h4>
      <div className="row">
        <label>{t("market.f.kind")}
          <select value={form.kind} onChange={set("kind")}><option value="github">github</option><option value="git">git</option></select>
        </label>
        <label>{t("market.f.id")}<input value={form.id} onChange={set("id")} aria-invalid={formErr ? true : undefined} aria-describedby={formErr ? "market-form-err" : undefined} /></label>
        <label>{t("market.f.trust")}
          <select value={form.trust} onChange={set("trust")}>{TRUSTS.map((x) => <option key={x} value={x}>{t(`market.trust.${x}`)}</option>)}</select>
        </label>
        {form.kind === "git" ? (
          <label>{t("market.f.url")}<input value={form.url} onChange={set("url")} placeholder="https://" /></label>
        ) : (
          <>
            <label>{t("market.f.owner")}<input value={form.owner} onChange={set("owner")} /></label>
            <label>{t("market.f.repo")}<input value={form.repo} onChange={set("repo")} /></label>
            <label>{t("market.f.baseUrl")}<input value={form.baseUrl} onChange={set("baseUrl")} placeholder="https://ghe.example.com/api/v3" /></label>
          </>
        )}
        <label>{t("market.f.ref")}<input value={form.ref} onChange={set("ref")} /></label>
        <label>{t("market.f.path")}<input value={form.path} onChange={set("path")} /></label>
        <label>{t("market.f.tokenEnv")}<input value={form.tokenEnv} onChange={set("tokenEnv")} autoComplete="off" /></label>
      </div>
      <p className="sub">{t("market.tokenEnvHint")}</p>
      {err(formErr, "market-form-err")}
      <div className="row"><button type="button" onClick={() => void register()}>{t("market.register")}</button></div>
        </>
) : <p className="sub">{t("market.adminOnly")}</p>}

      <h4>{t("market.searchTitle")}</h4>
      <div className="row">
        <label>{t("market.f.q")}<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <label>{t("market.f.trustFilter")}
          <select value={trust} onChange={(e) => setTrust(e.target.value)}>
            <option value="">{t("market.all")}</option>
            {TRUSTS.map((x) => <option key={x} value={x}>{t(`market.trust.${x}`)}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => void search()}>{t("market.search")}</button>
      </div>
      {err(searchErr)}
      {err(actErr)}
      {hits && hits.length === 0 ? <p className="sub">{t("market.noResult")}</p> : null}
      <ul className="mhits">
        {(hits ?? []).map((h) => {
          const blocked = Boolean(h.blocked);
          return (
            <li key={`${h.sourceId}/${h.id}`} data-testid={`hit-${h.id}`}>
              <code>{h.id}</code> <span className="chip">{t(`market.trust.${h.trust}`)}</span>{" "}
              <span>{h.description}</span> <span className="sub">{h.src} · {t("market.files", { count: h.fileCount })}</span>{" "}
              {h.flags.length > 0 ? <span className="chip warn">{t("market.flagCount", { count: h.flags.length })}</span> : null}
              {blocked ? <span className="issues"> {t("market.blocked")}{typeof h.blocked === "string" ? ` (${t(["tooLarge", "binary", "badPath"].includes(h.blocked) ? `market.blockedReason.${h.blocked}` : "market.blockedReason.unknown")})` : ""}</span> : null}{" "}
              <button type="button" onClick={() => void showPreview(h)}>{t("market.preview")}</button>{" "}
              <button type="button" disabled={blocked || importedIds.has(h.id) || pending.has(h.id)} onClick={() => void doImport(h)}>{t("market.import")}</button>
            </li>
          );
        })}
      </ul>

      {preview ? (
        <div className="mpreview" data-testid="market-preview">
          <h4>{t("market.previewTitle", { id: preview.id })}</h4>
          {preview.flags.length > 0 ? (
            <ul className="issues">{preview.flags.map((c) => <li key={c}>{riskText(t, c)}</li>)}</ul>
          ) : <p className="sub">{t("market.noRisk")}</p>}
          <p className="sub">{t("market.fileList")}</p>
          <ul>{preview.files.map((f) => <li key={f.path}><code>{f.path}</code></li>)}</ul>
          <pre data-testid="skill-md">{skillMd ? skillMd.content : t("market.noSkillMd")}</pre>
        </div>
      ) : null}
    </section>
  );
}
