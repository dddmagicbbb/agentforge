import { useTranslation } from "react-i18next";

const LANGS = ["ko", "en"] as const;

// 화면 언어 전환. 선택은 저장하지 않는다(새로 열면 ko). 생성물 언어(language 입력)와 무관.
export function LangSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <div role="group" aria-label={t("lang.switch")} className="lang-switch">
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} aria-pressed={i18n.resolvedLanguage === l} onClick={() => void i18n.changeLanguage(l)}>
          {t(`lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
