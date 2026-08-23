"use client";

import { useEffect, useState } from "react";

type MediaRow = {
  id: string;
  kind: "image" | "audio";
  originalName: string;
  publicPath: string;
  byteSize: number;
};

export default function StudioMediaPage() {
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/studio/media");
    if (response.ok) {
      const body = (await response.json()) as { data: { media: MediaRow[] } };
      setMedia(body.data.media);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch("/api/studio/media");
      if (cancelled || !response.ok) return;
      const body = (await response.json()) as { data: { media: MediaRow[] } };
      if (!cancelled) setMedia(body.data.media);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function upload(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const body = await file.arrayBuffer();
      await fetch("/api/studio/media", {
        method: "POST",
        headers: {
          "x-file-kind": file.type.startsWith("audio/") ? "audio" : "image",
          "x-file-name": file.name,
          "Content-Type": "application/octet-stream",
        },
        body,
      });
    }
    setUploading(false);
    await load();
  }

  return (
    <div className="studio-page">
      <header className="studio-head">
        <h1>Media</h1>
      </header>
      <label
        className="studio-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={async (event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length > 0) await upload(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,.mp3,.m4a"
          onChange={async (event) => {
            if (event.target.files?.length) await upload(event.target.files);
          }}
        />
        {uploading ? "Uploading…" : "Drop images or MP3/M4A files here, or click to choose"}
      </label>
      <div className="studio-media-grid">
        {media.map((item) => (
          <div key={item.id} className="studio-media-item">
            {item.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.publicPath} alt={item.originalName} />
            ) : (
              <span className="studio-media-kind">audio</span>
            )}
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(item.publicPath).then(() => {
                  setCopied(item.id);
                  window.setTimeout(() => setCopied(null), 1500);
                });
              }}
            >
              {copied === item.id ? "copied!" : "copy URL"}
            </button>
            <small>{item.originalName}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
