import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enCommon from "./locales/en/common.json";
import enErrors from "./locales/en/errors.json";
import enGenerator from "./locales/en/generator.json";
import enLogin from "./locales/en/login.json";
import enPwa from "./locales/en/pwa.json";
import enRecipe from "./locales/en/recipe.json";
import enRecipes from "./locales/en/recipes.json";
import enSettings from "./locales/en/settings.json";
import enShopping from "./locales/en/shopping.json";
import frCommon from "./locales/fr/common.json";
import frErrors from "./locales/fr/errors.json";
import frGenerator from "./locales/fr/generator.json";
import frLogin from "./locales/fr/login.json";
import frPwa from "./locales/fr/pwa.json";
import frRecipe from "./locales/fr/recipe.json";
import frRecipes from "./locales/fr/recipes.json";
import frSettings from "./locales/fr/settings.json";
import frShopping from "./locales/fr/shopping.json";

export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "preppr.locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "fr" || value === "en";
}

export function detectLocale(): AppLocale {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isAppLocale(stored)) return stored;
  }
  if (typeof navigator !== "undefined") {
    const primary = navigator.language?.slice(0, 2).toLowerCase();
    if (isAppLocale(primary)) return primary;
  }
  return "fr";
}

export function currentLocale(): AppLocale {
  const lang = i18n.resolvedLanguage ?? i18n.language ?? "fr";
  return lang.toLowerCase().startsWith("en") ? "en" : "fr";
}

function applyDocumentLang(locale: AppLocale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export function setAppLocale(locale: AppLocale) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, locale);
  }
  applyDocumentLang(locale);
  void i18n.changeLanguage(locale);
}

const locale = detectLocale();
applyDocumentLang(locale);

void i18n.use(initReactI18next).init({
  resources: {
    fr: {
      common: frCommon,
      login: frLogin,
      recipes: frRecipes,
      recipe: frRecipe,
      shopping: frShopping,
      settings: frSettings,
      generator: frGenerator,
      pwa: frPwa,
      errors: frErrors,
    },
    en: {
      common: enCommon,
      login: enLogin,
      recipes: enRecipes,
      recipe: enRecipe,
      shopping: enShopping,
      settings: enSettings,
      generator: enGenerator,
      pwa: enPwa,
      errors: enErrors,
    },
  },
  lng: locale,
  fallbackLng: "fr",
  ns: [
    "common",
    "login",
    "recipes",
    "recipe",
    "shopping",
    "settings",
    "generator",
    "pwa",
    "errors",
  ],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  applyDocumentLang(lng.toLowerCase().startsWith("en") ? "en" : "fr");
});

export default i18n;
