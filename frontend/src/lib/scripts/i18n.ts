import i18next, { type i18n as I18nType } from "i18next";

import { getContext, setContext } from "svelte";
import { get, type Writable } from "svelte/store";
import { createI18nStore } from "svelte-i18next";

import en from "../../../messages/en-US.json";
import owo from "../../../messages/owo.json";


i18next.init({
  resources: {
    en_US: {
      translation: en,
    },
    owo: {
      translation: owo,
    },
  },
  lng: "en_US",
  fallbackLng: 'en_US',
  interpolation: {
    escapeValue: false, // not needed for svelte as it escapes by default
  }
});

const getI18nStore = () => createI18nStore(i18next);
export const setI18n = () => setContext("i18n", getI18nStore());
export const i18n = () => get(getContext<Writable<I18nType>>("i18n"));
export type i18nT = I18nType[`t`];

// typescript support
declare module "i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof en;
    };
  }
}