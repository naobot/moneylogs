import { useCallback, useEffect, useRef, useState } from "react";

import { useToastContext } from "@/hooks/useToastContext";
import { reportError } from "@/utils/reportError";

import { MAX_CARD_PHOTOS } from "./renderCard";

/**
 * Photos picked for a share card. They live only in this tab's memory: decoded, shrunk and
 * drawn into the card, never uploaded, stored or remembered. Closing the modal drops them.
 */

export type SharePhoto = {
  id: string;
  /** The (downscaled) pixels the card draws from. */
  source: HTMLCanvasElement;
  width: number;
  height: number;
  /** A small preview for the modal's thumbnails (an object URL; revoke on release). */
  thumb: string;
};

/** Longest edge a photo keeps: a card tile is never bigger, so more is wasted memory. */
export const MAX_PHOTO_EDGE = 1600;
const THUMB_EDGE = 160;

/** The size to draw a `width`×`height` image at so its long edge is at most `max`. */
export const fitWithin = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

/** Decode a picked file, upright (EXIF orientation applied). */
const decode = async (file: Blob): Promise<ImageBitmap | HTMLImageElement> => {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Some WebViews can't decode every format here; an <img> may still manage it.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const draw = (image: CanvasImageSource, width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D isn't available");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
};

const toBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode a thumbnail"))),
      "image/jpeg",
      0.8,
    ),
  );

let nextId = 0;

/** Read a picked image file into a SharePhoto. */
export const loadSharePhoto = async (file: Blob): Promise<SharePhoto> => {
  const image = await decode(file);
  const natural =
    "naturalWidth" in image
      ? { width: image.naturalWidth, height: image.naturalHeight }
      : { width: image.width, height: image.height };
  const size = fitWithin(natural.width, natural.height, MAX_PHOTO_EDGE);
  const source = draw(image, size.width, size.height);
  if ("close" in image) image.close();
  const thumbSize = fitWithin(size.width, size.height, THUMB_EDGE);
  const thumb = URL.createObjectURL(await toBlob(draw(source, thumbSize.width, thumbSize.height)));
  return { id: `photo-${++nextId}`, source, ...size, thumb };
};

/** Let go of a photo's thumbnail URL (its canvas is freed once nothing holds it). */
const releasePhoto = (photo: SharePhoto) => URL.revokeObjectURL(photo.thumb);

/** Up to `max` photos for a card: add from a file picker, remove one, all freed on unmount. */
export const useSharePhotos = (max = MAX_CARD_PHOTOS) => {
  const { showToast } = useToastContext();
  const [photos, setPhotos] = useState<SharePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  // The photos as of the last commit, for the callbacks and the unmount cleanup.
  const live = useRef<SharePhoto[]>([]);
  useEffect(() => {
    live.current = photos;
  }, [photos]);
  useEffect(() => () => live.current.forEach(releasePhoto), []);

  const add = useCallback(
    async (files: ReadonlyArray<File>) => {
      const room = max - live.current.length;
      const picked = files.filter((f) => f.type.startsWith("image/") || !f.type).slice(0, room);
      if (files.length > room) showToast(`Up to ${max} photos on a card.`);
      if (!picked.length) return;
      setLoading(true);
      const results = await Promise.allSettled(picked.map(loadSharePhoto));
      setLoading(false);
      const loaded = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length) {
        reportError(failed[0].reason, { feature: "share_card", action: "load_photo" });
        showToast("Couldn't open that photo. Please try another.");
      }
      setPhotos((current) => {
        const kept = [...current, ...loaded];
        kept.slice(max).forEach(releasePhoto);
        return kept.slice(0, max);
      });
    },
    [max, showToast],
  );

  const remove = useCallback((id: string) => {
    setPhotos((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone) releasePhoto(gone);
      return current.filter((p) => p.id !== id);
    });
  }, []);

  return { photos, loading, add, remove, isFull: photos.length >= max };
};
