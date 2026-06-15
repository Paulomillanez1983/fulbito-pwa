"use client";

export type UploadImagePreset =
  | "team_badge"
  | "player_photo"
  | "venue_photo"
  | "ad_logo"
  | "payment_proof";

type FitMode = "cover" | "contain" | "inside";

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
  venue_photo: {
    width: 1280,
    height: 720,
    quality: 0.76,
    minQuality: 0.52,
    minScale: 0.68,
    maxBytes: 430 * 1024,
    fit: "contain",
    padding: 0.02,
    background: "#071018",
    fallbackName: "cancha"
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

function drawImage(context: CanvasRenderingContext2D, bitmap: ImageBitmap, width: number, height: number, target: ImageTarget) {
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (target.background) {
    context.fillStyle = target.background;
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }

  if (target.fit === "cover") {
    const sourceRatio = bitmap.width / bitmap.height;
    const targetRatio = width / height;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = bitmap.width;
    let sourceHeight = bitmap.height;

    if (sourceRatio > targetRatio) {
      sourceWidth = bitmap.height * targetRatio;
      sourceX = (bitmap.width - sourceWidth) / 2;
    } else if (sourceRatio < targetRatio) {
      sourceHeight = bitmap.width / targetRatio;
      sourceY = (bitmap.height - sourceHeight) / 2;
    }

    context.drawImage(bitmap, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
    return;
  }

  const padding = Math.max(0, Math.min(0.3, target.padding ?? 0));
  const availableWidth = width * (1 - padding * 2);
  const availableHeight = height * (1 - padding * 2);
  const scale = Math.min(availableWidth / bitmap.width, availableHeight / bitmap.height, target.fit === "inside" ? 1 : Number.POSITIVE_INFINITY);
  const drawWidth = Math.max(1, bitmap.width * scale);
  const drawHeight = Math.max(1, bitmap.height * scale);
  context.drawImage(bitmap, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

export async function optimizeImageForUpload(file: File, preset: UploadImagePreset) {
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

    drawImage(context, bitmap, width, height, target);

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
