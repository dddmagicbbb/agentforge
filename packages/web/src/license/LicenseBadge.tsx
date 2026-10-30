import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "../components/ErrorBoundary";
import type { LicenseState, VerifyFn } from "./license";

// 대화상자는 열 때만 불러온다(첫 화면 번들 축소)
const LicenseDialog = lazy(() => import("./LicenseDialog"));

interface Props {
  readonly state: LicenseState;
  readonly verify: VerifyFn;
  readonly onChange: (s: LicenseState | null) => void;
}

/** 상단 등급 배지(Free·Pro·Team + licensee) + 키 입력/해제. 서버가 판정했으면 입력 버튼이 없다. */
export function LicenseBadge({ state, verify, onChange }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const tierLabel = t(`license.tier.${state.tier}`);

  // 서버 결과가 확정되면 열린 대화상자를 닫는다(경쟁 방지)
  useEffect(() => {
    if (state.fromServer) setOpen(false);
  }, [state.fromServer]);
  // 닫히면 열기 버튼으로 포커스를 돌린다
  useEffect(() => {
    if (!open && wasOpen.current) opener.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div className="license" data-testid="license-badge" role="group" aria-label={t("license.badge")}>
      <span className={`tier tier-${state.tier}`}>{tierLabel}</span>
      {state.licensee ? <span className="sub">{state.licensee}</span> : null}
      {state.code ? <span className="sub">{t(`license.error.${state.code}`)}</span> : null}
      {!state.fromServer && state.tier === "free" ? <button ref={opener} type="button" onClick={() => setOpen(true)}>{t("license.enter")}</button> : null}
      {!state.fromServer && state.tier !== "free" ? <button type="button" onClick={() => onChange(null)}>{t("license.remove")}</button> : null}
      {open && !state.fromServer ? (
        <ErrorBoundary fallback={<p className="issues lv-error" role="alert">{t("license.loadFailed")}</p>}>
          <Suspense fallback={null}>
            <LicenseDialog verify={verify} onApply={(s) => { onChange(s); setOpen(false); }} onClose={() => setOpen(false)} />
          </Suspense>
        </ErrorBoundary>
      ) : null}
    </div>
  );
}
