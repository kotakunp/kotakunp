"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { formatDuration } from "@/lib/format-duration";
import type { ReleaseTrackView } from "@/lib/music/queries";

export function ReleaseTrackPlayer({
  tracks,
}: {
  tracks: ReleaseTrackView[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  function toggle(track: ReleaseTrackView) {
    const audio = audioRef.current;
    if (!audio || !track.audioPath) return;
    if (currentId === track.id && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      setCurrentId(null);
      return;
    }
    audio.src = track.audioPath;
    void audio.play();
    setCurrentId(track.id);
  }

  const playable = tracks.filter((track) => track.audioPath !== null);
  if (playable.length === 0) return null;

  return (
    <div className="release-track-player">
      {playable.map((track) => (
        <div className="track-list" key={track.id}>
          <div>
            <span>
              <button
                type="button"
                className="inline-play"
                onClick={() => toggle(track)}
                aria-label={currentId === track.id ? "Stop" : "Play"}
              >
                {currentId === track.id ? (
                  <Square size={12} fill="currentColor" />
                ) : (
                  <Play size={12} fill="currentColor" />
                )}
              </button>
            </span>
            <b>
              {track.title}
              {track.audioKind === "preview" ? <small> · preview</small> : null}
            </b>
            <time>{formatDuration(track.durationMs)}</time>
          </div>
        </div>
      ))}
      <audio ref={audioRef} preload="metadata" onPause={() => setCurrentId(null)} onEnded={() => setCurrentId(null)} />
    </div>
  );
}
