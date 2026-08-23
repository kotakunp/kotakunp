"use client";

import { useState } from "react";
import { ReleaseCard } from "./release-card";
import type { PublishedReleaseView } from "@/lib/music/queries";

const types = ["all", "single", "ep", "album", "ost"] as const;

export function DiscographyFilter({
  releases,
  locale,
}: {
  releases: readonly PublishedReleaseView[];
  locale: string;
}) {
  const [active, setActive] = useState<(typeof types)[number]>("all");
  const visible = active === "all" ? releases : releases.filter((release) => release.type === active);
  const presentTypes = new Set(releases.map((release) => release.type));

  return (
    <>
      <nav className="filter-nav" aria-label="Filter by type">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            className={active === type ? "active" : ""}
            onClick={() => setActive(type)}
            disabled={!presentTypes.has(type as PublishedReleaseView["type"])}
          >
            {type}
          </button>
        ))}
      </nav>
      <div className="release-grid discography-grid">
        {visible.map((release) => (
          <ReleaseCard key={release.slug} release={release} detailed locale={locale} />
        ))}
      </div>
    </>
  );
}
