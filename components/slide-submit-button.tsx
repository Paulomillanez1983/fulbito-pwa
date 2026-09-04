"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { LoaderCircle, ChevronRight, Lock } from "lucide-react";
import { triggerHaptic } from "@/lib/haptics";

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
  } catch {
    // Audio context fallback
  }
}

interface SlideSubmitButtonProps {
  idleText?: string;
  submittingText?: string;
  successText?: string;
  disabled?: boolean;
  onConfirm?: () => void;
  className?: string;
}

export function SlideSubmitButton({
  idleText = "Deslizá para confirmar",
  submittingText = "Confirmando...",
  successText = "¡Confirmado!",
  disabled = false,
  onConfirm,
  className = "",
}: SlideSubmitButtonProps) {
  const { pending } = useFormStatus();
  const [sliderPos, setSliderPos] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);

  const isLocked = disabled || pending || confirmed;

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isLocked) return;
    setIsDragging(true);
    triggerHaptic("light");
    const pageX = "touches" in e ? e.touches[0].pageX : e.pageX;
    startXRef.current = pageX - sliderPos;
  };

  const handleTouchMove = (e: TouchEvent | MouseEvent) => {
    if (!isDragging || isLocked || !trackRef.current) return;
    const pageX = "touches" in e ? e.touches[0].pageX : e.pageX;
    const maxOffset = trackRef.current.clientWidth - 52;
    let newPos = pageX - startXRef.current;
    if (newPos < 0) newPos = 0;
    if (newPos > maxOffset) newPos = maxOffset;

    if (newPos >= maxOffset && sliderPos < maxOffset) {
      triggerHaptic("medium");
    }
    setSliderPos(newPos);
  };

  const handleTouchEnd = () => {
    if (!isDragging || isLocked || !trackRef.current) return;
    setIsDragging(false);
    const maxOffset = trackRef.current.clientWidth - 52;
    if (sliderPos >= maxOffset * 0.85) {
      setSliderPos(maxOffset);
      setConfirmed(true);
      triggerHaptic("success");
      playGoalTap();
      if (onConfirm) onConfirm();
    } else {
      setSliderPos(0);
    }
  };

  useEffect(() => {
    if (isDragging) {
      const onMove = (e: TouchEvent | MouseEvent) => handleTouchMove(e);
      const onEnd = () => handleTouchEnd();
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onEnd);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onEnd);
      return () => {
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onEnd);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onEnd);
      };
    }
  }, [isDragging, sliderPos]);

  return (
    <div
      ref={trackRef}
      className={`relative w-full h-13 rounded-full bg-slate-950 border border-emerald-500/40 p-1 flex items-center overflow-hidden select-none shadow-inner ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${className}`}
    >
      {/* Background fill based on slide position */}
      <div
        className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-600/40 to-teal-500/60 transition-all"
        style={{ width: `${sliderPos + 48}px` }}
      />

      {/* Label text */}
      <span className="w-full text-center text-xs font-black uppercase tracking-wider text-emerald-300 pointer-events-none z-10">
        {pending ? submittingText : confirmed ? successText : idleText}
      </span>

      {/* Handle knob */}
      <div
        onMouseDown={handleTouchStart}
        onTouchStart={handleTouchStart}
        className={`absolute z-20 w-11 h-11 rounded-full flex items-center justify-center font-bold text-black transition-transform shadow-lg ${
          confirmed
            ? "bg-emerald-400 text-black scale-105"
            : pending
            ? "bg-amber-400 text-black animate-pulse"
            : "bg-gradient-to-br from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200"
        }`}
        style={{
          transform: `translateX(${sliderPos}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {pending ? (
          <LoaderCircle className="w-5 h-5 animate-spin" />
        ) : confirmed ? (
          <Lock className="w-5 h-5 text-black" />
        ) : (
          <ChevronRight className="w-6 h-6 text-black" />
        )}
      </div>
    </div>
  );
}
