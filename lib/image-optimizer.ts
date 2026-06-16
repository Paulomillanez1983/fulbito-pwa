"use client";

export type UploadImagePreset =
  | "team_badge"
  | "team_badge_card"
  | "player_photo"
  | "player_avatar"
  | "player_card"
  | "venue_photo"
  | "venue_logo"
  | "venue_marker"
  | "venue_card"
  | "venue_cover"
  | "ad_logo"
  | "payment_proof";

type FitMode = "cover" | "contain" | "inside";
export type ImageFrameShape = "none" | "circle" | "shield" | "hex" | "rounded";

export type ImageFrameOptions = {
  shape?: ImageFrameShape;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
};

type ImageTarget = {
  width: number;
  height: number;
  quality: number;
  minQuality: number;
  minScale: number;
  maxBytes: number;
  fit: FitMode;
  padding?: number;
  background?: string;
  fallbackName: string;
};

const imageTargets: Record<UploadImagePreset, ImageTarget> = {
  team_badge: {
    width: 512,
    height: 512,
    quality: 0.82,
    minQuality: 0.56,
    minScale: 0.7,
    maxBytes: 120 * 1024,
    fit: "contain",
    padding: 0.08,
    fallbackName: "escudo"
  },
  team_badge_card: {
    width: 640,
    height: 640,
    quality: 0.78,
    minQuality: 0.5,
    minScale: 0.58,
    maxBytes: 120 * 1024,
    fit: "contain",
    padding: 0.08,
    fallbackName: "escudo-card"
  },
  player_photo: {
    width: 640,
    height: 640,
    quality: 0.8,
    minQuality: 0.56,
    minScale: 0.66,
    maxBytes: 170 * 1024,
    fit: "cover",
    fallbackName: "jugador"
  },
  player_avatar: {
    width: 320,
    height: 320,
    quality: 0.76,
    minQuality: 0.52,
    minScale: 0.56,
    maxBytes: 78 * 1024,
    fit: "cover",
    fallbackName: "avatar"
  },
  player_card: {
    width: 640,
    height: 760,
    quality: 0.78,
    minQuality: 0.52,
    minScale: 0.6,
    maxBytes: 160 * 1024,
    fit: "cover",
    fallbackName: "jugador-card"
  },
  venue_photo: {
    width: 1280,
    height: 720,
    quality: 0.76,
    minQuality: 0.52,
    minScale: 0.68,
    maxBytes: 430 * 1024,
    fit: "cover",
    fallbackName: "cancha"
  },
  venue_logo: {
    width: 512,
    height: 512,
    quality: 0.78,
    minQuality: 0.48,
    minScale: 0.58,
    maxBytes: 96 * 1024,
    fit: "contain",
    padding: 0.08,
    fallbackName: "cancha-logo"
  },
  venue_marker: {
    width: 256,
    height: 256,
    quality: 0.74,
    minQuality: 0.44,
    minScale: 0.52,
    maxBytes: 46 * 1024,
    fit: "cover",
    fallbackName: "cancha-pin"
  },
  venue_card: {
    width: 640,
    height: 420,
    quality: 0.74,
    minQuality: 0.46,
    minScale: 0.58,
    maxBytes: 140 * 1024,
    fit: "cover",
    fallbackName: "cancha-card"
  },
  venue_cover: {
    width: 1280,
    height: 720,
    quality: 0.74,
    minQuality: 0.5,
    minScale: 0.64,
    maxBytes: 300 * 1024,
    fit: "cover",
    fallbackName: "cancha-portada"
  },
  ad_logo: {
    width: 512,
    height: 512,
    quality: 0.78,
    minQuality: 0.42,
    minScale: 0.5,
    maxBytes: 70 * 1024,
    fit: "contain",
    padding: 0.1,
    fallbackName: "sponsor"
  },
  payment_proof: {
    width: 1400,
    height: 1400,
    quality: 0.8,
    minQuality: 0.58,
    minScale: 0.62,
    maxBytes: 520 * 1024,
    fit: "inside",
    background: "#ffffff",
    fallbackName: "comprobante"
  }
};

function basename(file: File, fallback: string) {
  return (file.name.replace(/\.[^.]+$/, "") || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || fallback;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", Number(quality.toFixed(2)));
  });
}

async function readBitmap(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image", resizeQuality: "high" });
  } catch {
    return createImageBitmap(file);
  }
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function normalizeImageFrameOptions(options?: ImageFrameOptions | null): Required<ImageFrameOptions> {
  const allowedShapes = new Set<ImageFrameShape>(["none", "circle", "shield", "hex", "rounded"]);
  const shape = options?.shape && allowedShapes.has(options.shape) ? options.shape : "none";
  return {
    shape,
    zoom: clampNumber(Number(options?.zoom ?? 1), 0.55, 2.8, 1),
    offsetX: clampNumber(Number(options?.offsetX ?? 0), -0.45, 0.45, 0),
    offsetY: clampNumber(Number(options?.offsetY ?? 0), -0.45, 0.45, 0)
  };
}

export function readImageFrameOptions(formData: FormData, fieldName: string, fallback?: ImageFrameOptions): Required<ImageFrameOptions> {
  return normalizeImageFrameOptions({
    shape: String(formData.get(`${fieldName}FrameShape`) || fallback?.shape || "none") as ImageFrameShape,
    zoom: Number(formData.get(`${fieldName}FrameZoom`) || fallback?.zoom || 1),
    offsetX: Number(formData.get(`${fieldName}FrameX`) || fallback?.offsetX || 0),
    offsetY: Number(formData.get(`${fieldName}FrameY`) || fallback?.offsetY || 0)
  });
}

function roundRectPath(context: CanvasRenderingContext2D, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(safeRadius, 0);
  context.lineTo(width - safeRadius, 0);
  context.quadraticCurveTo(width, 0, width, safeRadius);
  context.lineTo(width, height - safeRadius);
  context.quadraticCurveTo(width, height, width - safeRadius, height);
  context.lineTo(safeRadius, height);
  context.quadraticCurveTo(0, height, 0, height - safeRadius);
  context.lineTo(0, safeRadius);
  context.quadraticCurveTo(0, 0, safeRadius, 0);
  context.closePath();
}

function applyClipPath(context: CanvasRenderingContext2D, width: number, height: number, shape: ImageFrameShape) {
  if (shape === "none") return;
  context.beginPath();
  if (shape === "circle") {
    const radius = Math.min(width, height) / 2;
    context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  } else if (shape === "shield") {
    context.moveTo(width * 0.5, height * 0.015);
    context.lineTo(width * 0.88, height * 0.12);
    context.lineTo(width * 0.98, height * 0.43);
    context.lineTo(width * 0.78, height * 0.78);
    context.lineTo(width * 0.5, height * 0.99);
    context.lineTo(width * 0.22, height * 0.78);
    context.lineTo(width * 0.02, height * 0.43);
    context.lineTo(width * 0.12, height * 0.12);
  } else if (shape === "hex") {
    context.moveTo(width * 0.5, 0);
    context.lineTo(width * 0.94, height * 0.25);
    context.lineTo(width * 0.94, height * 0.75);
    context.lineTo(width * 0.5, height);
    context.lineTo(width * 0.06, height * 0.75);
    context.lineTo(width * 0.06, height * 0.25);
  } else {
    roundRectPath(context, width, height, Math.min(width, height) * 0.18);
  }
  context.closePath();
  context.clip();
}

function resolveDrawRect(bitmap: ImageBitmap, width: number, height: number, target: ImageTarget, frame: Required<ImageFrameOptions>) {
  if (target.fit === "cover") {
    const baseScale = Math.max(width / bitmap.width, height / bitmap.height);
    const scale = baseScale * frame.zoom;
    const drawWidth = Math.max(1, bitmap.width * scale);
    const drawHeight = Math.max(1, bitmap.height * scale);
    return { drawWidth, drawHeight };
  }

  const padding = Math.max(0, Math.min(0.3, target.padding ?? 0));
  const availableWidth = width * (1 - padding * 2);
  const availableHeight = height * (1 - padding * 2);
  const baseScale = Math.min(
    availableWidth / bitmap.width,
    availableHeight / bitmap.height,
    target.fit === "inside" ? 1 : Number.POSITIVE_INFINITY
  );
  const scale = baseScale * frame.zoom;
  const drawWidth = Math.max(1, bitmap.width * scale);
  const drawHeight = Math.max(1, bitmap.height * scale);
  return { drawWidth, drawHeight };
}

function clampOffset(center: number, drawSize: number, canvasSize: number, normalizedOffset: number) {
  const proposed = center + normalizedOffset * canvasSize;
  if (drawSize <= canvasSize) {
    const min = Math.min(0, canvasSize - drawSize);
    const max = Math.max(0, canvasSize - drawSize);
    return Math.min(max, Math.max(min, proposed));
  }
  return Math.min(0, Math.max(canvasSize - drawSize, proposed));
}

function drawImage(
  context: CanvasRenderingContext2D,
  bitmap: ImageBitmap,
  width: number,
  height: number,
  target: ImageTarget,
  frameOptions?: ImageFrameOptions | null
) {
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const frame = normalizeImageFrameOptions(frameOptions);

  if (target.background) {
    context.fillStyle = target.background;
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }

  context.save();
  applyClipPath(context, width, height, frame.shape);
  const { drawWidth, drawHeight } = resolveDrawRect(bitmap, width, height, target, frame);
  const drawX = clampOffset((width - drawWidth) / 2, drawWidth, width, frame.offsetX);
  const drawY = clampOffset((height - drawHeight) / 2, drawHeight, height, frame.offsetY);
  context.drawImage(bitmap, drawX, drawY, drawWidth, drawHeight);
  context.restore();
}

export async function optimizeImageForUpload(file: File, preset: UploadImagePreset, frameOptions?: ImageFrameOptions | null) {
  if (file.type === "image/svg+xml") {
    throw new Error("Subi PNG, JPG o WebP. Fulbito convierte la imagen a WebP liviano antes de guardarla.");
  }
  if (!file.type.startsWith("image/")) return file;

  const target = imageTargets[preset];
  const bitmap = await readBitmap(file);
  let bestBlob: Blob | null = null;
  let scale = 1;

  while (scale >= target.minScale) {
    const width = Math.max(220, Math.round(target.width * scale));
    const height = Math.max(220, Math.round(target.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: !target.background });
    if (!context) break;

    drawImage(context, bitmap, width, height, target, frameOptions);

    for (let quality = target.quality; quality >= target.minQuality; quality -= 0.07) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      if (!bestBlob || blob.size < bestBlob.size) bestBlob = blob;
      if (blob.size <= target.maxBytes) {
        bitmap.close();
        return new File([blob], `${basename(file, target.fallbackName)}.webp`, { type: "image/webp" });
      }
    }

    scale *= 0.84;
  }

  bitmap.close();
  if (!bestBlob) return file;
  return new File([bestBlob], `${basename(file, imageTargets[preset].fallbackName)}.webp`, { type: "image/webp" });
}
