"use client";

import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Lecteur audio habillé sur les jetons de la charte.
 *
 * Le `<audio controls>` natif est laid et varie d'un navigateur à l'autre : ici
 * un bouton lecture épicéa, une barre de progression cliquable (un `input
 * range` teinté `.accent-primary`, donc accessible au clavier) et le temps.
 * `playing` suit les vrais événements `play`/`pause`, pas un état manuel.
 */
export function AudioPlayer({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Lecture"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" />
        )}
      </button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step="any"
        value={Math.min(current, duration || 0)}
        aria-label="Position de lecture"
        onChange={(e) => {
          const el = ref.current;
          if (!el) return;
          el.currentTime = Number(e.target.value);
          setCurrent(el.currentTime);
        }}
        className="accent-primary h-1.5 min-w-0 flex-1 cursor-pointer"
      />

      <span className="shrink-0 text-xs tabular-nums text-muted">
        {formatTime(current)} / {formatTime(duration)}
      </span>

      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        className="hidden"
      />
    </div>
  );
}
