import { useTranslation } from "react-i18next";
import type { STEP_KEYS } from "../components/StepNav";

/** 3·5·6단계 자리표시(T-423·T-425·T-426은 다음 라운드) */
export function StepPlaceholder({ stepKey }: { stepKey: (typeof STEP_KEYS)[number] }) {
  const { t } = useTranslation();
  return (
    <>
      <h2>{t(`steps.${stepKey}`)}</h2>
      <p className="note">{t("placeholder.soon")}</p>
    </>
  );
}
