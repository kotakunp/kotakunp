import { notFound } from "next/navigation";
import { HeroVisual } from "@/components/hero-visual";
import { ProjectItem } from "@/components/project-item";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { projects } from "@/content/site";
import { getDictionary, isLocale } from "../dictionaries";

export default async function ProjectsPage({ params }: PageProps<"/[lang]/projects">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const copy = await getDictionary(lang);
  return <main id="top">
    <SiteHeader locale={lang} active="projects" labels={copy.nav} />
    <section className="inner-hero projects-hero page-width"><div><h1>{copy.projectsPage.title}</h1><p>{copy.projectsPage.intro}</p><blockquote>{copy.projectsPage.note}</blockquote></div><HeroVisual /></section>
    <section className="featured-project page-width"><ProjectItem project={projects[0]} /><div className="featured-project-description"><div className="tags">{projects[0].tags.map((tag) => <span key={tag}>{tag}</span>)}</div><p>{copy.projectsPage.description}</p></div><div className="featured-project-links"><span><i />active</span><a href="https://github.com/kotakunp">view on GitHub →</a><span className="pending">{copy.projectsPage.caseStudy} →</span></div></section>
    <section className="projects-index page-width">
      <div className="projects-filter"><nav className="filter-nav"><span className="active">{copy.projectsPage.all}</span><span className="pending">{copy.projectsPage.tools}</span><span className="pending">{copy.projectsPage.libraries}</span><span className="pending">{copy.projectsPage.plugins}</span><span className="pending">{copy.projectsPage.experiments}</span><span className="pending">{copy.projectsPage.utilities}</span></nav><span>{copy.projectsPage.count}</span></div>
      <div className="project-list-grid">{projects.map((project) => <ProjectItem key={project.name} project={project} />)}</div>
    </section>
    <SiteFooter locale={lang} labels={copy.nav} />
  </main>;
}
