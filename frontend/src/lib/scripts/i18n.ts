import i18next, { type i18n as I18nType } from "i18next";

import { getContext, setContext } from "svelte";
import { createI18nStore } from "svelte-i18next";

import en from "../../../messages/en.json";


i18next.init({
  resources: {
    en: {
      translation: en,
    },
  },
  lng: "en",
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // not needed for svelte as it escapes by default
  }
});

const getI18nStore = () => createI18nStore(i18next);
export const setI18n = () => setContext("i18n", getI18nStore());
export const i18n = () => (getContext<I18nType>("i18n"));

// typescript support
declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof en;
    };
  }
}