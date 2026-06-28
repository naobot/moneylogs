import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase-config";

const UPLOAD_TIMEOUT_MS = 15_000;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIMENSION = 1200;

export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Upload timed out")), ms),
  );
  return Promise.race([promise, timeout]);
};

// Returns the original File if already within MAX_DIMENSION, otherwise a resized JPEG Blob.
// Inline images bypass the Cloud Function pipeline, so we resize client-side.
const resizeImageIfNeeded = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;

      if (w <= MAX_DIMENSION && h <= MAX_DIMENSION) {
        resolve(file);
        return;
      }

      const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to encode resized image"));
        },
        "image/jpeg",
        0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image file"));
    };

    img.src = objectUrl;
  });

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadInlineImage = async (file: File, groupId: string): Promise<string> => {
    const maxMB = MAX_FILE_SIZE_BYTES / 1024 / 1024;
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`Image is too large. Maximum size is ${maxMB}MB.`);
    }

    setIsUploading(true);
    try {
      const blob = await resizeImageIfNeeded(file);
      // If the blob was resized it is no longer the original File — output is JPEG
      const ext = blob instanceof File ? (file.name.split(".").pop() ?? "jpg") : "jpg";
      const path = `inline/${groupId}/${Date.now()}.${ext}`;
      const snapshot = await withTimeout(uploadBytes(ref(storage, path), blob), UPLOAD_TIMEOUT_MS);
      return await withTimeout(getDownloadURL(snapshot.ref), UPLOAD_TIMEOUT_MS);
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadInlineImage, isUploading };
};
