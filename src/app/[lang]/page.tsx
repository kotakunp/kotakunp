import Link from "next/link";
import { notFound } from "next/navigation";
import { HeroVisual } from "@/components/hero-visual";
import { ProjectItem } from "@/components/project-item";
import { ReleaseCard } from "@/components/release-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { SocialLinks } from "@/components/social-links";
import { projects } from "@/content/site";
import { listPublishedReleases } from "@/lib/music/queries";
import { getDictionary, isLocale } from "./dictionaries";

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = await getDictionary(lang);
  const releases = (await listPublishedReleases()).slice(0, 3);

  return <main id="top">
    <SiteHeader locale={lang} active="home" labels={copy.nav} />
    <section className="home-hero page-width">
      <div className="home-hero-copy">
        <h1>kotakunp</h1>
        <p className="lead">{copy.home.role}</p>
        <span className="dash">---</span>
        <p>{copy.home.line1}<br />{copy.home.line2}</p>
        <SocialLinks soonLabel={copy.footer.soon} />
      </div>
      <HeroVisual />
    </section>

    <section className="home-about page-width ruled-section">
      <h2 className="section-title">{copy.home.about}</h2>
      <p>{copy.home.aboutText}</p>
      <Link className="text-link" href={`/${lang}/about`}>{copy.home.learnMore} →</Link>
    </section>

    <section className="home-showcase page-width ruled-section">
      <div className="showcase-column">
        <div className="section-head"><h2 className="section-title">{copy.nav.music}</h2><Link href={`/${lang}/music`}>{copy.home.viewMusic} →</Link></div>
        <div className="release-grid home-release-grid">{releases.slice(0, 3).map((release) => <ReleaseCard key={release.slug} release={release} locale={lang} />)}</div>
      </div>
      <div className="showcase-column">
        <div className="section-head"><h2 className="section-title">{copy.nav.projects}</h2><Link href={`/${lang}/projects`}>{copy.home.viewProjects} →</Link></div>
        <div className="project-card-grid">{projects.slice(0, 3).map((project) => <ProjectItem key={project.name} project={project} card />)}</div>
      </div>
    </section>
    <SiteFooter locale={lang} labels={copy.nav} />
  </main>;
}
