import { useEffect, useMemo, useState } from "react";
import enUS from "./en-US.json";
import zhCN from "./zh-CN.json";

export type LocaleCode = "zh-CN" | "en-US";
export type CreatorMessageKey = keyof typeof zhCN;
export type CreatorTranslator = (
  key: CreatorMessageKey,
  variables?: Record<string, string | number>,
) => string;

export const CREATOR_UI_LOCALE_STORAGE_KEY = "hualala.creator.ui-locale";

export const messages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const satisfies Record<LocaleCode, typeof zhCN>;

function normalizeLocale(locale: string | null | undefined): LocaleCode | null {
  if (!locale) {
    return null;
  }

  if (locale === "zh-CN" || locale.toLowerCase().startsWith("zh")) {
    return "zh-CN";
  }

  if (locale === "en-US" || locale.toLowerCase().startsWith("en")) {
    return "en-US";
  }

  return null;
}

export function resolveInitialLocale(
  storage: Pick<Storage, "getItem"> | null | undefined = globalThis.localStorage,
  navigatorLanguage: string | undefined = globalThis.navigator?.language,
): LocaleCode {
  const storedLocale = normalizeLocale(storage?.getItem(CREATOR_UI_LOCALE_STORAGE_KEY));
  if (storedLocale) {
    return storedLocale;
  }

  return normalizeLocale(navigatorLanguage) ?? "zh-CN";
}

export function createTranslator(locale: LocaleCode): CreatorTranslator {
  return (key, variables = {}) => {
    const template = messages[locale][key] ?? key;
    return Object.entries(variables).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      template,
    );
  };
}

export function useLocaleState() {
  const [locale, setLocale] = useState<LocaleCode>(() => resolveInitialLocale());

  useEffect(() => {
    globalThis.localStorage?.setItem(CREATOR_UI_LOCALE_STORAGE_KEY, locale);
  }, [locale]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  return {
    locale,
    setLocale,
    t,
  };
}
