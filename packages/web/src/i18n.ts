import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ko from "./locales/ko.json";
import en from "./locales/en.json";

// ko 원본, en 번역. 선택은 저장하지 않으므로 새로 열면 항상 ko.
void i18n.use(initReactI18next).init({
  lng: "ko",
  fallbackLng: "ko",
  resources: { ko: { translation: ko }, en: { translation: en } },
  interpolation: { escapeValue: false },
});

export default i18n;
