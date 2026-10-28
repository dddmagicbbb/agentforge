import { useTranslation } from "react-i18next";

export const STEP_KEYS = ["requirement", "routine", "developers", "skills", "connection", "generate"] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;

interface Props {
  readonly step: StepIndex;
  readonly onStep: (s: StepIndex) => void;
}

/** 상단 단계 바(클릭 이동) */
export function StepBar({ step, onStep }: Props) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("nav.label")}>
      <ol className="steps">
        {STEP_KEYS.map((k, i) => (
          <li key={k}>
            <button type="button" aria-current={i === step ? "step" : undefined} onClick={() => onStep(i as StepIndex)}>
              {`${i + 1} ${t(`steps.${k}`)}`}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** 하단 이전/다음 */
export function StepButtons({ step, onStep }: Props) {
  const { t } = useTranslation();
  return (
    <div className="nav-btns">
      <button type="button" disabled={step === 0} onClick={() => onStep((step - 1) as StepIndex)}>{t("nav.prev")}</button>
      <button type="button" className="primary" disabled={step === STEP_KEYS.length - 1} onClick={() => onStep((step + 1) as StepIndex)}>{t("nav.next")}</button>
    </div>
  );
}
