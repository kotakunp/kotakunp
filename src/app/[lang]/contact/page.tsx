import { notFound } from "next/navigation";
import { HeroVisual } from "@/components/hero-visual";
import { ReachOut } from "@/components/reach-out";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, isLocale } from "../dictionaries";

export default async function ContactPage({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = await getDictionary(lang);
  return <main id="top">
    <SiteHeader locale={lang} active="contact" labels={copy.nav} />
    <section className="contact-hero inner-hero page-width"><div><h1>{copy.contactPage.title}</h1><p>{copy.contactPage.intro}</p><blockquote>{copy.contactPage.note}</blockquote></div><HeroVisual /></section>
    <section className="reach-page page-width"><div className="reach-page-head"><h2 className="section-title">{copy.reachOut.title}</h2><span>{copy.reachOut.publicNote}</span></div><ReachOut copy={copy.reachOut} locale={lang} /></section>
    <SiteFooter locale={lang} labels={copy.nav} />
  </main>;
}
