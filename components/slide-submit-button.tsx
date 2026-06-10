"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

function playGoalTap() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;
    const master = audio.createGain();
    const compressor = audio.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, now);
    compressor.knee.setValueAtTime(18, now);
    compressor.ratio.setValueAtTime(4.2, now);
    compressor.attack.setValueAtTime(0.004, now);
    compressor.release.setValueAtTime(0.22, now);
    master.gain.setValueAtTime(0.92, now);
    master.connect(compressor);
    compressor.connect(audio.destination);

    const crowdBuffer = audio.createBuffer(1, Math.floor(audio.sampleRate * 1.5), audio.sampleRate);
    const crowdData = crowdBuffer.getChannelData(0);
    let pink = 0;
    for (let index = 0; index < crowdData.length; index += 1) {
      pink = pink * 0.96 + (Math.random() * 2 - 1) * 0.04;
      crowdData[index] = pink + (Math.random() * 2 - 1) * 0.18;
    }

    const crowd = audio.createBufferSource();
    crowd.buffer = crowdBuffer;
    const crowdFilter = audio.createBiquadFilter();
    crowdFilter.type = "bandpass";
    crowdFilter.frequency.setValueAtTime(760, now);
    crowdFilter.Q.setValueAtTime(0.72, now);
    const crowdGain = audio.createGain();
    crowdGain.gain.setValueAtTime(0.0001, now);
    crowdGain.gain.linearRampToValueAtTime(0.1, now + 0.14);
    crowdGain.gain.linearRampToValueAtTime(0.18, now + 0.44);
    crowdGain.gain.exponentialRampToValueAtTime(0.008, now + 1.48);
    crowd.connect(crowdFilter);
    crowdFilter.connect(crowdGain);
    crowdGain.connect(master);
    crowd.start(now);
    crowd.stop(now + 1.5);

    const kick = audio.createOscillator();
    kick.type = "sine";
    kick.frequency.setValueAtTime(108, now);
    kick.frequency.exponentialRampToValueAtTime(42, now + 0.18);
    const kickGain = audio.createGain();
    kickGain.gain.setValueAtTime(0.0001, now);
    kickGain.gain.exponentialRampToValueAtTime(0.36, now + 0.012);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    kick.connect(kickGain);
    kickGain.connect(master);
    kick.start(now);
    kick.stop(now + 0.3);

    const netSnap = audio.createBufferSource();
    netSnap.buffer = crowdBuffer;
    const snapFilter = audio.createBiquadFilter();
    snapFilter.type = "highpass";
    snapFilter.frequency.setValueAtTime(1800, now);
    const snapGain = audio.createGain();
    snapGain.gain.setValueAtTime(0.0001, now + 0.05);
    snapGain.gain.exponentialRampToValueAtTime(0.11, now + 0.075);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    netSnap.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(master);
    netSnap.start(now + 0.04);
    netSnap.stop(now + 0.2);

    const whistle = audio.createOscillator();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(1120, now + 0.16);
    whistle.frequency.linearRampToValueAtTime(1460, now + 0.34);
    const whistleGain = audio.createGain();
    whistleGain.gain.setValueAtTime(0.0001, now + 0.14);
    whistleGain.gain.exponentialRampToValueAtTime(0.12, now + 0.2);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    whistle.connect(whistleGain);
    whistleGain.connect(master);
    whistle.start(now + 0.14);
    whistle.stop(now + 0.5);

    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const shine = audio.createOscillator();
      shine.type = "triangle";
      shine.frequency.setValueAtTime(frequency, now + 0.28 + index * 0.035);
      const shineGain = audio.createGain();
      shineGain.gain.setValueAtTime(0.0001, now + 0.26 + index * 0.035);
      shineGain.gain.exponentialRampToValueAtTime(0.075, now + 0.3 + index * 0.035);
      shineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.94 + index * 0.035);
      shine.connect(shineGain);
      shineGain.connect(master);
      shine.start(now + 0.26 + index * 0.035);
      shine.stop(now + 1.0 + index * 0.035);
    });

    window.setTimeout(() => void audio.close(), 1800);
  } catch {
    // Browsers may block audio when user gesture rules are stricter.
  }
}

export function SlideSubmitButton({
  idle,
  pendingLabel,
  disabledLabel = "Adjunta comprobante",
  complete = false,
  completeLabel = "Enviado",
  disabled = false,
  submitting
}: {
  idle: string;
  pendingLabel: string;
  disabledLabel?: string;
  complete?: boolean;
  completeLabel?: string;
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
  const [mounted, setMounted] = useState(false);
  const isPending = submitting ?? formStatus.pending;
  const locked = disabled || isPending || complete;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locked) return;
    if (celebrating) return;
    setProgress(0);
    progressRef.current = 0;
    setDragging(false);
    draggingRef.current = false;
  }, [celebrating, locked]);

  function submitFromSlide() {
    if (locked) return;
    const form = trackRef.current?.form;
    if (!form) return;
    setProgress(1);
    progressRef.current = 1;
    setCelebrating(true);
    playGoalTap();
    window.setTimeout(() => setCelebrating(false), 1800);
    window.setTimeout(() => {
      setProgress(0);
      progressRef.current = 0;
    }, 1350);
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

  const stadiumConfetti = mounted
    ? createPortal(
        <span className={`slide-submit__stadium-confetti ${celebrating ? "is-active" : ""}`} aria-hidden="true">
          {Array.from({ length: 36 }).map((_, index) => <i key={index} />)}
        </span>,
        document.body
      )
    : null;

  return (
    <>
    <div
      className={`slide-submit ${dragging ? "is-dragging" : ""} ${celebrating ? "is-celebrating" : ""} ${complete ? "is-complete" : ""}`}
      style={{
        "--slide-shift": `${Math.round(progress * maxShift)}px`,
        "--ball-rotation": `${Math.round(progress * 720)}deg`
      } as CSSProperties & Record<string, string>}
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
          ) : complete ? (
            completeLabel
          ) : disabled ? (
            disabledLabel
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
    {stadiumConfetti}
    </>
  );
}
