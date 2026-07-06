import { createContext } from "react";
import type { ToastVariant } from "@/hooks/useToast";

export interface ToastContextValue {
  showToast: (message?: string, variant?: ToastVariant) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);
