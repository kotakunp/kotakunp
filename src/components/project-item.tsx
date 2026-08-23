import {
  AudioWaveform,
  Braces,
  CircleDashed,
  Code2,
  Grid3X3,
  PlugZap,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { projects } from "@/content/site";

type Project = (typeof projects)[number];

const projectIcons: Record<Project["icon"], LucideIcon> = {
  braces: Braces,
  sliders: SlidersHorizontal,
  wrench: Wrench,
  waveform: AudioWaveform,
  grid: Grid3X3,
  scan: CircleDashed,
  plug: PlugZap,
  code: Code2,
};

export function ProjectItem({ project, card = false }: { project: Project; card?: boolean }) {
  const Icon = projectIcons[project.icon];
  return (
    <article className={`project-item${card ? " project-card" : ""}`}>
      <div className="project-icon" aria-hidden="true"><Icon strokeWidth={1.6} /></div>
      <div className="project-copy">
        <h3>{project.name}</h3>
        <p>{project.description}</p>
        <div className="tags">{project.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
      </div>
      <div className="project-meta"><span><i />{project.status}</span><a href="https://github.com/kotakunp" target="_blank" rel="noreferrer">view on GitHub →</a></div>
    </article>
  );
}
