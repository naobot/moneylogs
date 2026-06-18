import { PropsWithChildren } from "react";
import { useToast } from "@/hooks/useToast";
import { Snackbar } from "@/components/ToastContainer";
import { ToastContext } from "./toastContextValue";

export const ToastProvider = ({ children }: PropsWithChildren) => {
  const { toasts, showToast, removeToast } = useToast();

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Snackbar toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};
