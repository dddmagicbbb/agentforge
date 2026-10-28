import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ko from "./locales/ko.json";

// ko 원본. en 번역과 누락 키 CI 검사는 I18N-01(PH6).
void i18n.use(initReactI18next).init({
  lng: "ko",
  fallbackLng: "ko",
  resources: { ko: { translation: ko } },
  interpolation: { escapeValue: false },
});

export default i18n;
