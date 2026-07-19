import i18n, { type InitOptions, type TOptions } from "i18next";
import { initReactI18next, useTranslation as useReactI18nextTranslation } from "react-i18next";

import { DEFAULT_LOCALE, i18nextResources, supportedLocales } from "./locales";

const LOCALE_STORAGE_KEY = "paperclip.locale";

function initialLocale() {
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && supportedLocales.includes(stored)) return stored;
  }
  return DEFAULT_LOCALE;
}

function syncDocumentLocale(locale: string) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

const i18nextOptions: InitOptions = {
  resources: i18nextResources,
  lng: initialLocale(),
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: supportedLocales,
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnObjects: false,
  initAsync: false,
};

void i18n.use(initReactI18next).init(i18nextOptions).catch((error: unknown) => {
  console.error("Failed to initialize i18next", error);
});

syncDocumentLocale(i18n.language || DEFAULT_LOCALE);

i18n.on("languageChanged", (locale) => {
  syncDocumentLocale(locale);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
});

export function t(key: string, options: TOptions = {}) {
  return i18n.t(key, options);
}

export const useTranslation = useReactI18nextTranslation;
export { i18n, LOCALE_STORAGE_KEY };
