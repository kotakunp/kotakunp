import "server-only";

const dictionaries = {
  en: () => import("@/messages/en.json").then((module) => module.default),
  ja: () => import("@/messages/ja.json").then((module) => module.default),
  mn: () => import("@/messages/mn.json").then((module) => module.default),
};

export type Locale = keyof typeof dictionaries;
export type Dictionary = Awaited<ReturnType<(typeof dictionaries)["en"]>>;

export const locales = Object.keys(dictionaries) as Locale[];

export function isLocale(value: string): value is Locale {
  return value in dictionaries;
}

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}
