"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";

export function AudioPreview({ src, duration }: { src: string; duration: string }) {
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
    if (audio.paused) {
      void audio.play(); // rejection surfaces via error event; state stays honest
    } else {
      audio.pause();
      audio.currentTime = 0; // the button shows a STOP square — actually stop, don't just pause
    }
  }

  return (
    <div className="audio-preview">
      <button type="button" onClick={toggle} aria-label={playing ? "Stop preview" : "Play preview"}>
        {playing ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
      </button>
      <span className="audio-preview-label">preview</span>
      <time>{duration}</time>
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
