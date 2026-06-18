import { useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/config/firebase-config";

export const useImageUpload = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadInlineImage = async (file: File, groupId: string): Promise<string> => {
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `inline/${groupId}/${Date.now()}.${ext}`;
      const snapshot = await uploadBytes(ref(storage, path), file);
      return await getDownloadURL(snapshot.ref);
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadInlineImage, isUploading };
};
