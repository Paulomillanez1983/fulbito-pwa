"use client";

import { MoveHorizontal, MoveVertical, Scan, Shapes, ZoomIn } from "lucide-react";
import type { CSSProperties } from "react";
import type { ImageFrameShape } from "@/lib/image-optimizer";

export type ImageFrameDraft = {
  shape: ImageFrameShape;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

type ImageFrameVariant = "crest" | "avatar" | "wide" | "square" | "venue" | "ad";

const shapeOptions: Array<{ value: ImageFrameShape; label: string }> = [
  { value: "shield", label: "Escudo" },
  { value: "circle", label: "Redondo" },
  { value: "hex", label: "Hexa" },
  { value: "rounded", label: "Marco" }
];

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function defaultImageFrame(variant: ImageFrameVariant): ImageFrameDraft {
  if (variant === "avatar") return { shape: "circle", zoom: 1.08, offsetX: 0, offsetY: 0 };
  if (variant === "wide" || variant === "venue") return { shape: "rounded", zoom: 1, offsetX: 0, offsetY: 0 };
  if (variant === "ad") return { shape: "rounded", zoom: 1, offsetX: 0, offsetY: 0 };
  if (variant === "square") return { shape: "rounded", zoom: 1, offsetX: 0, offsetY: 0 };
  return { shape: "shield", zoom: 1, offsetX: 0, offsetY: 0 };
}

export function framePreviewStyle(frame: ImageFrameDraft) {
  return {
    "--media-frame-zoom": String(frame.zoom),
    "--media-frame-x": `${frame.offsetX * 100}%`,
    "--media-frame-y": `${frame.offsetY * 100}%`
  } as CSSProperties;
}

export function FrameHiddenInputs({ name, frame }: { name: string; frame: ImageFrameDraft }) {
  return (
    <>
      <input name={`${name}FrameShape`} type="hidden" value={frame.shape} />
      <input name={`${name}FrameZoom`} type="hidden" value={frame.zoom} />
      <input name={`${name}FrameX`} type="hidden" value={frame.offsetX} />
      <input name={`${name}FrameY`} type="hidden" value={frame.offsetY} />
    </>
  );
}

export function ImageFrameTuner({
  frame,
  label = "Encuadre",
  onFrameChange,
  variant = "crest",
  allowNoShape = false
}: {
  frame: ImageFrameDraft;
  label?: string;
  onFrameChange: (frame: ImageFrameDraft) => void;
  variant?: ImageFrameVariant;
  allowNoShape?: boolean;
}) {
  const options = allowNoShape ? [{ value: "none" as ImageFrameShape, label: "Foto" }, ...shapeOptions] : shapeOptions;
  const update = (patch: Partial<ImageFrameDraft>) => onFrameChange({ ...frame, ...patch });

  return (
    <div className={`image-frame-tuner image-frame-tuner--${variant}`}>
      <div className="image-frame-tuner__title">
        <Scan size={14} />
        <span>{label}</span>
      </div>
      <div className="image-frame-shapes" aria-label="Forma del recorte">
        <Shapes size={14} />
        {options.map((option) => (
          <button
            aria-pressed={frame.shape === option.value}
            className={frame.shape === option.value ? "is-active" : ""}
            key={option.value}
            onClick={(event) => {
              event.preventDefault();
              update({ shape: option.value });
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <label>
        <span><ZoomIn size={13} /> Zoom</span>
        <input
          max="2.4"
          min="0.65"
          onChange={(event) => update({ zoom: clamp(Number(event.target.value), 0.65, 2.4) })}
          step="0.05"
          type="range"
          value={frame.zoom}
        />
      </label>
      <label>
        <span><MoveHorizontal size={13} /> Horizontal</span>
        <input
          max="0.35"
          min="-0.35"
          onChange={(event) => update({ offsetX: clamp(Number(event.target.value), -0.35, 0.35) })}
          step="0.01"
          type="range"
          value={frame.offsetX}
        />
      </label>
      <label>
        <span><MoveVertical size={13} /> Vertical</span>
        <input
          max="0.35"
          min="-0.35"
          onChange={(event) => update({ offsetY: clamp(Number(event.target.value), -0.35, 0.35) })}
          step="0.01"
          type="range"
          value={frame.offsetY}
        />
      </label>
    </div>
  );
}
