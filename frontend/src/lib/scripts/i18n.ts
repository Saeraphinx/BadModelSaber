import i18next, { type i18n as I18nType } from "i18next";

import { getContext, setContext } from "svelte";
import { get, type Writable } from "svelte/store";
import { createI18nStore } from "svelte-i18next";

import en from "../../../messages/en-us.json";
import owo from "../../../messages/owo.json";


i18next.init({
  resources: {
    "en-us": {
      translation: en,
    },
    owo: {
      translation: owo,
    },
  },
  lng: "en-us",
  fallbackLng: 'en-us',
  // keeps resolved locale codes lowercase so they match our lowercase resource keys (e.g. "en-us"), since i18next otherwise canonicalizes to "en-US" and misses the bundle
  lowerCaseLng: true,
  interpolation: {
    escapeValue: false, // not needed for svelte as it escapes by default
  }
});

const getI18nStore = () => createI18nStore(i18next);
export const setI18n = () => setContext("i18n", getI18nStore());
export const i18n = () => get(getContext<Writable<I18nType>>("i18n"));
// i18next instance itself, usable outside component lifecycle (e.g. `load` functions) where getContext is unavailable
export const i18nInstance = i18next;
export type i18nT = I18nType[`t`];
// typescript support
declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof en;
    };
  }
}