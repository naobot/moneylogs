import { useState, useCallback } from "react";

interface Toast {
  id: string;
  message: string;
  timestamp: Date;
}

const DISMISS_MS = 4000;

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string = "An error has occurred") => {
    const id = Date.now().toString();
    setToasts([{ id, message, timestamp: new Date() }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DISMISS_MS);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
};
