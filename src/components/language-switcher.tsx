import Link from "next/link";
import type { Locale } from "@/app/[lang]/dictionaries";

const languageLabels: Record<Locale, string> = {
  en: "EN",
  ja: "日本語",
  mn: "MN",
};

export function LanguageSwitcher({ locale, path = "" }: { locale: Locale; path?: string }) {
  return (
    <nav className="language-switcher" aria-label="Language">
      {(Object.keys(languageLabels) as Locale[]).map((language, index) => (
        <span key={language}>
          {index > 0 ? <span aria-hidden="true"> / </span> : null}
          <Link
            href={`/${language}${path}`}
            hrefLang={language}
            aria-current={language === locale ? "page" : undefined}
          >
            {languageLabels[language]}
          </Link>
        </span>
      ))}
    </nav>
  );
}
