"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

export function JournalAudio({ src, title }: { src: string; title?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = ref.current;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  return (
    <div className="audio-preview">
      <button type="button" onClick={toggle} aria-label={playing ? "Stop" : "Play"}>
        {playing ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </button>
      <span className="audio-preview-label">{title ?? "audio"}</span>
      <audio ref={ref} src={src} preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
}
