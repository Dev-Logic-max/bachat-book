"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastMessage = {
  id: string;
  type: "success" | "error" | "info";
  title: string;
  description?: string;
};

type ToastContextType = {
  showToast: (msg: Omit<ToastMessage, "id">) => void;
};

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback((msg: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...msg, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "bg-navy-900 border-border text-on-navy flex w-80 items-start gap-3 rounded-card border p-4 shadow-xl transition-all",
              "animate-in slide-in-from-bottom-5 duration-200",
            )}
          >
            {toast.type === "success" && (
              <CheckCircle2 size={18} className="text-gain shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <AlertCircle size={18} className="text-loss shrink-0 mt-0.5" />
            )}
            {toast.type === "info" && (
              <Info size={18} className="text-brass shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold">{toast.title}</p>
              {toast.description && (
                <p className="text-on-navy-muted mt-0.5 text-[11px]">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-on-navy-muted hover:text-on-navy shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
