"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDuration } from "@/lib/format-duration";

type ReleaseState = {
  id: string;
  title: string;
  englishTitle: string;
  slug: string;
  type: "single" | "ep" | "album" | "ost" | null;
  descriptionMarkdown: string;
  status: "draft" | "published";
  coverMediaId: string | null;
  releaseDate: string;
  duuToUrl: string | null;
  youtubeUrl: string | null;
  spotifyUrl: string | null;
  appleMusicUrl: string | null;
};

type TrackState = {
  id: string;
  position: number;
  title: string;
  lyricsMarkdown: string;
  audioMediaId: string | null;
  audioKind: "none" | "preview" | "full";
  durationMs: number | null;
};

type MediaRow = {
  id: string;
  kind: "image" | "audio";
  originalName: string;
  publicPath: string;
  durationMs: number | null;
};

export function ReleaseEditor({
  release,
  initialTracks,
  initialCoverAlt,
}: {
  release: ReleaseState;
  initialTracks: TrackState[];
  initialCoverAlt: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState(release);
  const [tracks, setTracks] = useState(initialTracks);
  const [coverAlt, setCoverAlt] = useState(initialCoverAlt ?? "");
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const dirtyRef = useRef(false);
  const stateRef = useRef({ state, tracks, coverAlt });

  useEffect(() => {
    stateRef.current = { state, tracks, coverAlt };
  }, [state, tracks, coverAlt]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/studio/media");
      if (cancelled) return;
      const body = (await response.json()) as { data: { media: MediaRow[] } };
      if (!cancelled) setMedia(body.data.media);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;
    setSaveState("saving");
    const current = stateRef.current;
    const response = await fetch(`/api/studio/releases/${current.state.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: current.state.title || undefined,
        englishTitle: current.state.englishTitle || undefined,
        slug: current.state.slug || undefined,
        type: current.state.type || undefined,
        descriptionMarkdown: current.state.descriptionMarkdown || undefined,
        coverMediaId: current.state.coverMediaId,
        coverAlt: current.state.coverMediaId ? current.coverAlt : undefined,
        releaseDate: current.state.releaseDate || null,
        duuToUrl: current.state.duuToUrl || null,
        youtubeUrl: current.state.youtubeUrl || null,
        spotifyUrl: current.state.spotifyUrl || null,
        appleMusicUrl: current.state.appleMusicUrl || null,
      }),
    });
    if (response.ok) {
      dirtyRef.current = false;
      setSaveState("saved");
    } else {
      setSaveState("failed");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void save(), 1500);
    return () => window.clearInterval(timer);
  }, [save]);

  function update(patch: Partial<ReleaseState>) {
    dirtyRef.current = true;
    setState((current) => ({ ...current, ...patch }));
  }

  async function uploadFile(file: File): Promise<MediaRow | null> {
    const body = await file.arrayBuffer();
    const response = await fetch("/api/studio/media", {
      method: "POST",
      headers: {
        "x-file-kind": file.type.startsWith("audio/") ? "audio" : "image",
        "x-file-name": file.name,
        "Content-Type": "application/octet-stream",
      },
      body,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data: { media: MediaRow } };
    setMedia((current) => [payload.data.media, ...current]);
    return payload.data.media;
  }

  async function addTrack() {
    const title = window.prompt("Track title:");
    if (!title) return;
    const response = await fetch(`/api/studio/releases/${release.id}/tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!response.ok) return;
    const body = (await response.json()) as { data: { track: TrackState } };
    setTracks((current) => [...current, { ...body.data.track, lyricsMarkdown: "" }]);
    dirtyRef.current = true;
    setTimeout(() => void save(), 0);
  }

  async function patchTrack(trackId: string, patch: Record<string, unknown>) {
    await fetch(`/api/studio/releases/${release.id}/tracks/${trackId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function move(trackId: string, direction: -1 | 1) {
    const ordered = [...tracks].sort((a, b) => a.position - b.position);
    const index = ordered.findIndex((track) => track.id === trackId);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= ordered.length) return;
    [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];
    setTracks(ordered.map((track, position) => ({ ...track, position: position + 1 })));
    await fetch(`/api/studio/releases/${release.id}/tracks/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackIds: ordered.map((track) => track.id) }),
    });
  }

  async function removeTrack(trackId: string) {
    await fetch(`/api/studio/releases/${release.id}/tracks/${trackId}`, {
      method: "DELETE",
    });
    setTracks((current) =>
      current
        .filter((track) => track.id !== trackId)
        .map((track, index) => ({ ...track, position: index + 1 })),
    );
    if (release.status === "published") {
      dirtyRef.current = true;
      setTimeout(() => void save(), 0);
    }
  }

  async function attachAudio(trackId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "audio/mpeg,audio/mp4,.mp3,.m4a";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const uploaded = await uploadFile(file);
      if (!uploaded) return;
      await patchTrack(trackId, { audioMediaId: uploaded.id, audioKind: "preview" });
      setTracks((current) =>
        current.map((track) =>
          track.id === trackId
            ? { ...track, audioMediaId: uploaded.id, audioKind: "preview", durationMs: uploaded.durationMs }
            : track,
        ),
      );
    };
    input.click();
  }

  async function setStatus(status: "draft" | "published") {
    if (
      status === "published" &&
      !window.confirm(
        "Publish this release? Attached audio becomes publicly downloadable/playable immediately.",
      )
    ) {
      return;
    }
    update({ status });
    dirtyRef.current = true;
    setTimeout(() => void save(), 0);
  }

  async function removeRelease() {
    if (!window.confirm(`Delete "${state.title}"?`)) return;
    const confirmTitle = window.prompt("Type the exact release title to confirm:");
    if (confirmTitle !== release.title) return;
    const response = await fetch(`/api/studio/releases/${release.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmTitle: release.title }),
    });
    if (response.ok) router.push("/studio");
  }

  return (
    <div className="studio-page studio-editor">
      <header className="studio-head">
        <h1>{state.title}</h1>
        <span className={state.status === "published" ? "studio-status published" : "studio-status"}>
          {state.status}
        </span>
        <span aria-live="polite">{saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "failed" ? "save failed" : ""}</span>
      </header>

      <div className="studio-grid">
        <label>Title<input value={state.title} onChange={(event) => update({ title: event.target.value })} /></label>
        <label>English title<input value={state.englishTitle} onChange={(event) => update({ englishTitle: event.target.value })} /></label>
        <label>Slug<input value={state.slug} onChange={(event) => update({ slug: event.target.value })} /></label>
        <label>
          Type
          <select value={state.type ?? ""} onChange={(event) => update({ type: (event.target.value || null) as ReleaseState["type"] })}>
            <option value="">—</option>
            {["single", "ep", "album", "ost"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label>Release date<input type="date" value={state.releaseDate} onChange={(event) => update({ releaseDate: event.target.value })} /></label>
        <label>
          Cover
          <select value={state.coverMediaId ?? ""} onChange={(event) => update({ coverMediaId: event.target.value || null })}>
            <option value="">none</option>
            {media.filter((item) => item.kind === "image").map((item) => (
              <option key={item.id} value={item.id}>{item.originalName}</option>
            ))}
          </select>
        </label>
        <label>Cover alt text<input value={coverAlt} onChange={(event) => setCoverAlt(event.target.value)} /></label>
        <label>duu.to URL<input placeholder="https://duu.to/..." value={state.duuToUrl ?? ""} onChange={(event) => update({ duuToUrl: event.target.value || null })} /></label>
        <label>YouTube URL<input value={state.youtubeUrl ?? ""} onChange={(event) => update({ youtubeUrl: event.target.value || null })} /></label>
        <label>Spotify URL<input value={state.spotifyUrl ?? ""} onChange={(event) => update({ spotifyUrl: event.target.value || null })} /></label>
        <label>Apple Music URL<input value={state.appleMusicUrl ?? ""} onChange={(event) => update({ appleMusicUrl: event.target.value || null })} /></label>
        <label className="studio-span2">Description (markdown)<textarea rows={4} value={state.descriptionMarkdown} onChange={(event) => update({ descriptionMarkdown: event.target.value })} /></label>
      </div>

      <section className="studio-section">
        <div className="studio-section-head">
          <h2>Tracks</h2>
          <button type="button" className="studio-new" onClick={() => void addTrack()}>add track</button>
        </div>
        {[...tracks]
          .sort((a, b) => a.position - b.position)
          .map((track, index) => (
            <div className="studio-track" key={track.id}>
              <strong>{String(index + 1).padStart(2, "0")}</strong>
              <input
                value={track.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setTracks((current) => current.map((t) => (t.id === track.id ? { ...t, title } : t)));
                }}
                onBlur={(event) => void patchTrack(track.id, { title: event.target.value })}
              />
              <textarea
                rows={2}
                placeholder="lyrics (markdown)"
                value={track.lyricsMarkdown}
                onChange={(event) => {
                  const lyricsMarkdown = event.target.value;
                  setTracks((current) => current.map((t) => (t.id === track.id ? { ...t, lyricsMarkdown } : t)));
                }}
                onBlur={(event) => void patchTrack(track.id, { lyricsMarkdown: event.target.value })}
              />
              <select
                value={track.audioKind}
                onChange={(event) => {
                  const audioKind = event.target.value as TrackState["audioKind"];
                  setTracks((current) => current.map((t) => (t.id === track.id ? { ...t, audioKind } : t)));
                  void patchTrack(track.id, { audioKind });
                }}
              >
                <option value="none">no audio</option>
                <option value="preview">preview</option>
                <option value="full">full</option>
              </select>
              <button type="button" onClick={() => void attachAudio(track.id)}>
                {track.audioMediaId ? `audio (${formatDuration(track.durationMs)})` : "attach audio"}
              </button>
              <button type="button" onClick={() => void move(track.id, -1)} aria-label="Move up">↑</button>
              <button type="button" onClick={() => void move(track.id, 1)} aria-label="Move down">↓</button>
              <button type="button" className="danger" onClick={() => void removeTrack(track.id)}>remove</button>
            </div>
          ))}
      </section>

      <div className="studio-actions">
        {state.status === "published" ? (
          <button type="button" onClick={() => void setStatus("draft")}>unpublish</button>
        ) : (
          <button type="button" onClick={() => void setStatus("published")}>publish</button>
        )}
        <button type="button" onClick={() => void save()}>save now</button>
        <button type="button" className="danger" onClick={() => void removeRelease()}>delete</button>
      </div>
    </div>
  );
}
