"use client";

/**
 * Shared transport controls for AudioPilot.
 *
 * The Player, the Trimmer's live-preview player, and the Recorder's
 * post-capture preview all want the same set of buttons: play,
 * pause, stop, seek, volume, mute, playback speed. Putting the
 * chrome here keeps the surfaces consistent and lets the audio
 * engine live in one place per surface.
 */

import {
  Pause,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TransportProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onReset?: () => void;
  showReset?: boolean;
  className?: string;
  disabled?: boolean;
}

export function TransportControls({
  isPlaying,
  onTogglePlay,
  onStop,
  onReset,
  showReset = false,
  className,
  disabled = false,
}: TransportProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        size="sm"
        variant="default"
        className="h-8 w-8"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-8 w-8"
        onClick={onStop}
        disabled={disabled}
        aria-label="Stop"
      >
        <Square className="h-4 w-4" aria-hidden="true" />
      </Button>
      {showReset && onReset && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 w-8"
          onClick={onReset}
          disabled={disabled}
          aria-label="Reset"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

interface VolumeSliderProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (value: number) => void;
  onMuteToggle: () => void;
  disabled?: boolean;
}

export function VolumeSlider({
  volume,
  muted,
  onVolumeChange,
  onMuteToggle,
  disabled = false,
}: VolumeSliderProps) {
  const display = muted ? 0 : volume;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onMuteToggle}
        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
        aria-label={muted ? "Unmute" : "Mute"}
        disabled={disabled}
      >
        {muted || volume === 0 ? (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={display}
        onChange={(event) => onVolumeChange(Number(event.target.value))}
        className="h-1 w-24 cursor-pointer accent-primary disabled:opacity-50"
        disabled={disabled}
        aria-label="Volume"
      />
    </div>
  );
}

interface SpeedPickerProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function SpeedPicker({ value, onChange, disabled = false }: SpeedPickerProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 p-0.5 text-[11px]"
      role="group"
      aria-label="Playback speed"
    >
      {SPEEDS.map((speed) => (
        <button
          key={speed}
          type="button"
          onClick={() => onChange(speed)}
          disabled={disabled}
          className={cn(
            "rounded px-1.5 py-0.5 transition-colors disabled:opacity-50",
            value === speed
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {speed}x
        </button>
      ))}
    </div>
  );
}
