import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { todayIso, type LicenseCode, type LicenseState, type VerifyFn } from "./license";

interface Props {
  readonly verify: VerifyFn;
  readonly onApply: (s: LicenseState) => void;
  readonly onClose: () => void;
}

/** 라이선스 키 입력. 키는 이 컴포넌트의 지역 상태에만 있고, 닫으면 사라진다(저장·draft·URL 금지). */
export default function LicenseDialog({ verify, onApply, onClose }: Props) {
  const { t } = useTranslation();
  const [key, setKey] = useState("");
  const [failure, setFailure] = useState<LicenseCode | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const running = useRef(false);

  useEffect(() => input.current?.focus(), []);

  const apply = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const r = await verify(key, { today: todayIso() });
      if (!r.ok) {
        setFailure(r.code);
        return;
      }
      // 키 원문은 넘기지 않는다. 등급 정보만 올린다
      onApply({ tier: r.tier, licensee: r.licensee, seats: r.seats, expires: r.expires });
    } catch {
      // 검증 함수의 예외는 원문을 노출하지 않고 형식 오류로 본다
      setFailure("LICENSE_FORMAT");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="license-title" onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
        <h2 id="license-title">{t("license.title")}</h2>
        <p className="lead">{t("license.lead")}</p>
        <label>{t("license.keyLabel")}
          <textarea ref={input} rows={4} value={key} autoComplete="off" spellCheck={false} className="mono" onChange={(e) => { setKey(e.target.value); setFailure(null); }} />
        </label>
        {failure ? <p className="issues lv-error" role="alert">{t(`license.error.${failure}`)}</p> : null}
        <div className="row">
          <button type="button" className="primary" disabled={key.trim() === "" || busy} onClick={() => void apply()}>{t("license.apply")}</button>
          <button type="button" onClick={onClose}>{t("license.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
