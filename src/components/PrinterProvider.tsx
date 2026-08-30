"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle2, Loader2, Printer, XCircle } from "lucide-react";
import {
  connect as connectPrinter,
  connectedName,
  disconnect as disconnectPrinter,
  isConnected,
  isSupported,
  onPrinterChange,
  PrinterError,
  printReceipt,
  type ReceiptData,
} from "@/lib/printer";
import { cn } from "@/lib/utils";

type Toast = { kind: "info" | "success" | "error"; msg: string } | null;

type PrinterContextValue = {
  supported: boolean | null;
  connected: boolean;
  deviceName: string | null;
  connecting: boolean;
  /** Pair a printer via the Bluetooth chooser (must run in a tap handler). */
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Print a bill; resolves on success, rejects with a PrinterError. */
  print: (data: ReceiptData) => Promise<void>;
  /**
   * Print a bill without making the caller handle the outcome — shows a toast
   * and, when no printer is paired, stays silent. Used for auto-print on save.
   */
  autoPrint: (data: ReceiptData) => void;
};

const PrinterContext = createContext<PrinterContextValue | null>(null);

export function usePrinter(): PrinterContextValue {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error("usePrinter must be used within <PrinterProvider>");
  return ctx;
}

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Web Bluetooth is client-only; compute after mount to avoid a hydration
  // mismatch with the server-rendered HTML.
  useEffect(() => setSupported(isSupported()), []);

  // Keep local state in sync with the module-level connection (which can drop
  // on its own when the printer's radio sleeps).
  useEffect(() => {
    const sync = () => {
      setConnected(isConnected());
      setDeviceName(connectedName());
    };
    sync();
    return onPrinterChange(sync);
  }, []);

  const showToast = useCallback((t: Toast, ms = 3500) => {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const name = await connectPrinter();
      setConnected(true);
      setDeviceName(name);
      showToast({ kind: "success", msg: `Connected to ${name}` });
    } catch (e) {
      const msg =
        e instanceof PrinterError ? e.message : "Couldn't connect to the printer.";
      // A cancelled chooser isn't an error worth shouting about.
      if (!(e instanceof PrinterError && e.code === "cancelled")) {
        showToast({ kind: "error", msg });
      } else {
        setToast(null);
      }
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [showToast]);

  const disconnect = useCallback(() => {
    disconnectPrinter();
    setConnected(false);
    setDeviceName(null);
    showToast({ kind: "info", msg: "Printer disconnected" });
  }, [showToast]);

  const print = useCallback(
    async (data: ReceiptData) => {
      showToast({ kind: "info", msg: "Printing bill…" }, 10_000);
      try {
        await printReceipt(data);
        showToast({ kind: "success", msg: "Bill printed" });
      } catch (e) {
        const msg =
          e instanceof PrinterError ? e.message : "Printing failed.";
        showToast({ kind: "error", msg }, 5000);
        throw e;
      }
    },
    [showToast]
  );

  const autoPrint = useCallback(
    (data: ReceiptData) => {
      // No printer paired → nothing to do; the owner can print from the order
      // screen later. Only surface trouble when a print was actually attempted.
      if (!isConnected()) return;
      void print(data).catch(() => {
        /* toast already shown by print() */
      });
    },
    [print]
  );

  return (
    <PrinterContext.Provider
      value={{
        supported,
        connected,
        deviceName,
        connecting,
        connect,
        disconnect,
        print,
        autoPrint,
      }}
    >
      {children}
      <PrinterToast toast={toast} onClose={() => setToast(null)} />
    </PrinterContext.Provider>
  );
}

function PrinterToast({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  if (!toast) return null;
  const icon =
    toast.kind === "success" ? (
      <CheckCircle2 size={18} />
    ) : toast.kind === "error" ? (
      <XCircle size={18} />
    ) : (
      <Loader2 size={18} className="animate-spin" />
    );

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-50 flex justify-center px-4">
      <button
        onClick={onClose}
        className={cn(
          "pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg",
          toast.kind === "success" && "bg-money-positive",
          toast.kind === "error" && "bg-money-negative",
          toast.kind === "info" && "bg-ink"
        )}
      >
        <span className="shrink-0">
          {toast.kind === "info" ? <Printer size={18} /> : icon}
        </span>
        <span className="truncate">{toast.msg}</span>
      </button>
    </div>
  );
}
