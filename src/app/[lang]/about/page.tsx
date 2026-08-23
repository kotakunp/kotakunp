import { notFound } from "next/navigation";
import { HeroVisual } from "@/components/hero-visual";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SocialLinks } from "@/components/social-links";
import { experience, skills } from "@/content/site";
import { getDictionary, isLocale } from "../dictionaries";

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = await getDictionary(lang);
  return <main id="top">
    <SiteHeader locale={lang} active="about" labels={copy.nav} />
    <section className="about-layout page-width">
      <div className="about-visual"><h1>{copy.aboutPage.title}</h1><HeroVisual large /></div>
      <div className="about-copy">
        <section><h2 className="section-title">{copy.aboutPage.bio}</h2><p>{copy.aboutPage.bioText}</p></section>
        <section><h2 className="section-title">{copy.aboutPage.philosophy}</h2><p>{copy.aboutPage.philosophyText}</p></section>
        <section><h2 className="section-title">{copy.aboutPage.skills}</h2><div className="skill-list">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section>
      </div>
    </section>
    <section className="about-lower page-width">
      <div><h2 className="section-title">{copy.aboutPage.experience}</h2><ol className="timeline">{experience.map((item) => <li key={item.period}><small>{item.period}</small><h3>{item.role}</h3><p>{item.description}</p></li>)}</ol></div>
      <div className="about-contact"><h2 className="section-title">{copy.aboutPage.contact}</h2><SocialLinks soonLabel={copy.footer.soon} /><p>hello@kotakunp.dev</p><p>youtube.com/@kotakunp</p><p>duu.to/kotakunp</p></div>
    </section>
    <SiteFooter locale={lang} labels={copy.nav} />
  </main>;
}
