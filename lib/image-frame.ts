export type StoredImageFrameShape = "none" | "circle" | "shield" | "hex" | "rounded";

export type StoredImageFrameTransform = {
  shape: StoredImageFrameShape;
  zoom: number;
  offsetX: number;
  offsetY: number;
};

const storedImageFrameShapes = new Set<StoredImageFrameShape>(["none", "circle", "shield", "hex", "rounded"]);

function readFrameSource(frame: unknown) {
  return frame && typeof frame === "object"
    ? (frame as { shape?: unknown; zoom?: unknown; offsetX?: unknown; offsetY?: unknown })
    : {};
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, numericValue));
}

export function storedImageFrameShape(frame: unknown, fallback: StoredImageFrameShape = "shield"): StoredImageFrameShape {
  const source = readFrameSource(frame);
  return typeof source.shape === "string" && storedImageFrameShapes.has(source.shape as StoredImageFrameShape)
    ? (source.shape as StoredImageFrameShape)
    : fallback;
}

export function storedImageFrameTransform(frame: unknown, fallbackShape: StoredImageFrameShape = "shield"): StoredImageFrameTransform {
  const source = readFrameSource(frame);
  return {
    shape: storedImageFrameShape(source, fallbackShape),
    zoom: clampNumber(source.zoom, 1, 0.65, 2.4),
    offsetX: clampNumber(source.offsetX, 0, -0.35, 0.35),
    offsetY: clampNumber(source.offsetY, 0, -0.35, 0.35)
  };
}

export function storedImageFrameCssVars(frame: unknown, fallbackShape: StoredImageFrameShape = "shield") {
  const transform = storedImageFrameTransform(frame, fallbackShape);
  return {
    "--image-frame-zoom": String(transform.zoom),
    "--image-frame-x": `${transform.offsetX * 100}%`,
    "--image-frame-y": `${transform.offsetY * 100}%`
  };
}
