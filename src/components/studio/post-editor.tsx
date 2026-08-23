"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { JournalMarkdown } from "@/components/journal-markdown";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

type PostState = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  type: string;
  bodyMarkdown: string;
  status: "draft" | "published";
  coverMediaId: string | null;
};

type MediaRow = {
  id: string;
  kind: "image" | "audio";
  originalName: string;
  publicPath: string;
};

export function PostEditor({
  post,
  initialTags,
  initialCoverAlt,
}: {
  post: PostState;
  initialTags: { name: string; slug: string }[];
  initialCoverAlt: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState(post);
  const [tags, setTags] = useState(initialTags);
  const [coverAlt, setCoverAlt] = useState(initialCoverAlt ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [media, setMedia] = useState<MediaRow[]>([]);
  const saveSequence = useRef(0);
  const previewMediaMap = new Map<string, { publicPath: string; kind: "image" | "audio" }>(
    media.map((item) => [item.id, { publicPath: item.publicPath, kind: item.kind }]),
  );
  const dirtyRef = useRef(false);
  const stateRef = useRef({ state, tags, coverAlt });

  useEffect(() => {
    stateRef.current = { state, tags, coverAlt };
  }, [state, tags, coverAlt]);

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
    const sequence = ++saveSequence.current;
    setSaveState("saving");
    const current = stateRef.current;
    const response = await fetch(`/api/studio/posts/${current.state.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: current.state.title || undefined,
        slug: current.state.slug || undefined,
        excerpt: current.state.excerpt || undefined,
        type: current.state.type || undefined,
        bodyMarkdown: current.state.bodyMarkdown || undefined,
        coverMediaId: current.state.coverMediaId,
        coverAlt: current.state.coverMediaId ? current.coverAlt : undefined,
        ...(current.state.status === "published"
          ? {}
          : { status: current.state.status }),
        tags: current.tags.length > 0 ? current.tags : undefined,
      }),
    });
    if (sequence !== saveSequence.current) return;
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

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        dirtyRef.current = true;
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);

  function update(patch: Partial<PostState>) {
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

  async function setStatus(status: "draft" | "published") {
    if (
      status === "published" &&
      state.status !== "published" &&
      !window.confirm("Publish this post? It becomes publicly visible immediately.")
    ) {
      return;
    }
    update({ status });
    dirtyRef.current = true;
    setTimeout(() => void save(), 0);
  }

  async function removePost() {
    if (!window.confirm(`Delete "${state.title}"? Type its title to confirm.`)) return;
    const confirmTitle = window.prompt("Type the exact post title to confirm:");
    if (confirmTitle !== post.title) return;
    const response = await fetch(`/api/studio/posts/${post.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmTitle: post.title }),
    });
    if (response.ok) router.push("/studio");
  }

  return (
    <div className="studio-page studio-editor">
      <header className="studio-head">
        <h1>{state.title || "Untitled draft"}</h1>
        <span className={state.status === "published" ? "studio-status published" : "studio-status"}>
          {state.status}
        </span>
        <span aria-live="polite">{saveState === "saving" ? "saving…" : saveState === "saved" ? "saved" : saveState === "failed" ? "save failed" : ""}</span>
      </header>

      <div className="studio-grid">
        <label>Title<input value={state.title} onChange={(event) => update({ title: event.target.value })} /></label>
        <label>Slug<input value={state.slug} onChange={(event) => update({ slug: event.target.value })} /></label>
        <label>Excerpt<textarea rows={2} maxLength={320} value={state.excerpt} onChange={(event) => update({ excerpt: event.target.value })} /></label>
        <label>Type<input placeholder="studio note" value={state.type} onChange={(event) => update({ type: event.target.value })} /></label>
        <label>
          Tags (comma separated)
          <input
            value={tags.map((tag) => tag.name).join(", ")}
            onChange={(event) =>
              setTags(
                event.target.value
                  .split(",")
                  .map((name) => name.trim())
                  .filter(Boolean)
                  .map((name) => ({ name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-") })),
              )
            }
          />
        </label>
        <label>
          Cover
          <select
            value={state.coverMediaId ?? ""}
            onChange={(event) => update({ coverMediaId: event.target.value || null })}
          >
            <option value="">none</option>
            {media
              .filter((item) => item.kind === "image")
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.originalName}
                </option>
              ))}
          </select>
        </label>
        <label>Cover alt text<input value={coverAlt} onChange={(event) => setCoverAlt(event.target.value)} /></label>
      </div>

      <div
        className="studio-editor-columns"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          const file = event.dataTransfer.files?.[0];
          if (!file) return;
          event.preventDefault();
          const uploaded = await uploadFile(file);
          if (uploaded?.kind === "image") {
            update({ bodyMarkdown: `${state.bodyMarkdown}\n\n![image](/media/${uploaded.id}/${uploaded.originalName})\n` });
          } else if (uploaded) {
            update({ bodyMarkdown: `${state.bodyMarkdown}\n\n::audio[${file.name}]{id="${uploaded.id}"}\n` });
          }
        }}
      >
        <label className="studio-editor-pane">
          Body (markdown)
          <CodeMirror
            value={state.bodyMarkdown}
            height="420px"
            extensions={[]}
            basicSetup={{ lineNumbers: false }}
            onChange={(value: string) => update({ bodyMarkdown: value })}
          />
        </label>
        <div className="studio-editor-pane">
          Preview
          <div className="mdx-content studio-preview">
            <JournalMarkdown markdown={state.bodyMarkdown} mediaMap={previewMediaMap} />
          </div>
        </div>
      </div>

      <div className="studio-actions">
        {state.status === "published" ? (
          <button type="button" onClick={() => void setStatus("draft")}>unpublish</button>
        ) : (
          <button type="button" onClick={() => void setStatus("published")}>publish</button>
        )}
        <button type="button" onClick={() => void save()}>save now</button>
        <button type="button" className="danger" onClick={() => void removePost()}>delete</button>
      </div>

      <p className="media-hint">
        Drop image/audio files onto the editor to upload and insert them. Manage files at{" "}
        <Link href="/studio/media">/studio/media</Link>.
      </p>
    </div>
  );
}
