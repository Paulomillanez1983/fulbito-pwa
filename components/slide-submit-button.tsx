"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

function playGoalTap() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, audio.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.34);

    const kick = audio.createOscillator();
    kick.type = "triangle";
    kick.frequency.setValueAtTime(150, audio.currentTime);
    kick.frequency.exponentialRampToValueAtTime(74, audio.currentTime + 0.12);
    kick.connect(gain);
    kick.start();
    kick.stop(audio.currentTime + 0.16);

    const whistle = audio.createOscillator();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(660, audio.currentTime + 0.1);
    whistle.frequency.exponentialRampToValueAtTime(980, audio.currentTime + 0.24);
    whistle.connect(gain);
    whistle.start(audio.currentTime + 0.1);
    whistle.stop(audio.currentTime + 0.34);

    window.setTimeout(() => void audio.close(), 520);
  } catch {
    // Browsers may block audio when user gesture rules are stricter.
  }
}

export function SlideSubmitButton({
  idle,
  pendingLabel,
  disabled = false,
  submitting
}: {
  idle: string;
  pendingLabel: string;
  disabled?: boolean;
  submitting?: boolean;
}) {
  const formStatus = useFormStatus();
  const trackRef = useRef<HTMLButtonElement | null>(null);
  const progressRef = useRef(0);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [maxShift, setMaxShift] = useState(240);
  const [celebrating, setCelebrating] = useState(false);
  const isPending = submitting ?? formStatus.pending;
  const locked = disabled || isPending;

  useEffect(() => {
    if (!locked) return;
    setProgress(0);
    progressRef.current = 0;
    setDragging(false);
    draggingRef.current = false;
  }, [locked]);

  function submitFromSlide() {
    if (locked) return;
    const form = trackRef.current?.form;
    if (!form) return;
    setProgress(1);
    progressRef.current = 1;
    setCelebrating(true);
    playGoalTap();
    window.setTimeout(() => setCelebrating(false), 1050);
    window.setTimeout(() => {
      setProgress(0);
      progressRef.current = 0;
    }, 780);
    form.requestSubmit();
  }

  function updateProgress(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const handle = 58;
    const nextMaxShift = Math.max(96, rect.width - handle - 8);
    setMaxShift(nextMaxShift);
    const next = Math.min(1, Math.max(0, (clientX - rect.left - handle / 2) / nextMaxShift));
    setProgress(next);
    progressRef.current = next;
  }

  return (
    <div
      className={`slide-submit ${dragging ? "is-dragging" : ""} ${celebrating ? "is-celebrating" : ""}`}
      style={{ "--slide-shift": `${Math.round(progress * maxShift)}px` } as CSSProperties & Record<string, string>}
    >
      <button
        aria-label={`Deslizar para ${idle.toLowerCase()}`}
        className="slide-submit__track"
        disabled={locked}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            submitFromSlide();
          }
        }}
        onPointerCancel={() => {
          setDragging(false);
          draggingRef.current = false;
          setProgress(0);
          progressRef.current = 0;
        }}
        onPointerDown={(event) => {
          if (locked) return;
          setDragging(true);
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateProgress(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current || locked) return;
          updateProgress(event.clientX);
        }}
        onPointerUp={(event) => {
          if (!draggingRef.current || locked) return;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setDragging(false);
          draggingRef.current = false;
          if (progressRef.current > 0.74) {
            submitFromSlide();
            return;
          }
          setProgress(0);
          progressRef.current = 0;
        }}
        ref={trackRef}
        type="button"
      >
        <span className="slide-submit__label">
          {isPending ? (
            <>
              <LoaderCircle className="button-spinner" size={16} />
              {pendingLabel}
            </>
          ) : disabled ? (
            "Adjunta comprobante"
          ) : (
            `Desliza para ${idle.toLowerCase()}`
          )}
        </span>
        <span className="slide-submit__boot" aria-hidden="true" />
        <span className="slide-submit__ball" aria-hidden="true">
          <i />
        </span>
        <span className="slide-submit__goal" aria-hidden="true">GOOL</span>
        <span className="slide-submit__confetti" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, index) => <i key={index} />)}
        </span>
      </button>
    </div>
  );
}
