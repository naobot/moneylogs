import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase-config";

const UPLOAD_TIMEOUT_MS = 15_000;

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Upload timed out")), ms),
  );
  return Promise.race([promise, timeout]);
};

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadInlineImage = async (file: File, groupId: string): Promise<string> => {
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `inline/${groupId}/${Date.now()}.${ext}`;
      const snapshot = await withTimeout(uploadBytes(ref(storage, path), file), UPLOAD_TIMEOUT_MS);
      return await withTimeout(getDownloadURL(snapshot.ref), UPLOAD_TIMEOUT_MS);
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadInlineImage, isUploading };
};
