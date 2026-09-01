"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * App-wide toast notifications. One surface for every "it worked" / "it failed"
 * message — order saved, items added, order deleted, printer status, etc.
 * Toasts stack, auto-dismiss, and can be tapped to dismiss early.
 */
type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; msg: string };

type ToastApi = {
  show: (kind: ToastKind, msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, msg: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, kind, msg }]);
      // Errors linger a little longer so they can be read.
      const ttl = kind === "error" ? 5000 : 3000;
      setTimeout(() => remove(id), ttl);
    },
    [remove]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show("success", m),
      error: (m) => show("error", m),
      info: (m) => show("info", m),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Sits just above the bottom nav (64px). */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[80px] z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => remove(t.id)}
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg",
              t.kind === "success" && "bg-money-positive",
              t.kind === "error" && "bg-money-negative",
              t.kind === "info" && "bg-ink"
            )}
          >
            <span className="shrink-0">
              {t.kind === "success" ? (
                <CheckCircle2 size={18} />
              ) : t.kind === "error" ? (
                <XCircle size={18} />
              ) : (
                <Info size={18} />
              )}
            </span>
            <span className="truncate">{t.msg}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
