import Link from "next/link";
import { ArrowUp } from "lucide-react";
import type { Locale } from "@/app/[lang]/dictionaries";

export function SiteFooter({ locale, labels }: {
  locale: Locale;
  labels: { about: string; music: string; projects: string; journal: string; contact: string };
}) {
  return (
    <footer className="site-footer page-width">
      <span>© 2026 kotakunp</span>
      <nav aria-label="Footer navigation">
        <Link href={`/${locale}/about`}>{labels.about}</Link>
        <Link href={`/${locale}/music`}>{labels.music}</Link>
        <Link href={`/${locale}/projects`}>{labels.projects}</Link>
        <Link href={`/${locale}/journal`}>{labels.journal}</Link>
        <Link href={`/${locale}/contact`}>{labels.contact}</Link>
      </nav>
      <a href="#top" aria-label="Back to top"><ArrowUp aria-hidden="true" size={19} strokeWidth={1.7} /></a>
    </footer>
  );
}
