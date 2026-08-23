import Link from "next/link";
import type { Locale } from "@/app/[lang]/dictionaries";
import { LanguageSwitcher } from "./language-switcher";

type PageName = "home" | "about" | "music" | "projects" | "journal" | "contact";

const paths: Record<PageName, string> = {
  home: "",
  about: "/about",
  music: "/music",
  projects: "/projects",
  journal: "/journal",
  contact: "/contact",
};

export function SiteHeader({ locale, active, labels }: {
  locale: Locale;
  active: PageName;
  labels: { about: string; music: string; projects: string; journal: string; contact: string };
}) {
  return (
    <header className="site-header page-width">
      <Link className="wordmark" href={`/${locale}`}>kotakunp</Link>
      <nav className="primary-nav" aria-label="Primary navigation">
        {(["about", "music", "projects", "journal", "contact"] as const).map((item) => (
          <Link key={item} className={active === item ? "active" : ""} href={`/${locale}${paths[item]}`}>
            {labels[item]}
          </Link>
        ))}
      </nav>
      <LanguageSwitcher locale={locale} path={paths[active]} />
    </header>
  );
}
