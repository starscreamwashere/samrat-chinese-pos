"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
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
import { useToast } from "@/components/ToastProvider";

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
  const toast = useToast();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const name = await connectPrinter();
      setConnected(true);
      setDeviceName(name);
      toast.success(`Connected to ${name}`);
    } catch (e) {
      // A cancelled chooser isn't an error worth shouting about.
      if (!(e instanceof PrinterError && e.code === "cancelled")) {
        toast.error(
          e instanceof PrinterError ? e.message : "Couldn't connect to the printer."
        );
      }
      throw e;
    } finally {
      setConnecting(false);
    }
  }, [toast]);

  const disconnect = useCallback(() => {
    disconnectPrinter();
    setConnected(false);
    setDeviceName(null);
    toast.info("Printer disconnected");
  }, [toast]);

  const print = useCallback(
    async (data: ReceiptData) => {
      toast.info("Printing bill…");
      try {
        await printReceipt(data);
        toast.success("Bill printed");
      } catch (e) {
        toast.error(e instanceof PrinterError ? e.message : "Printing failed.");
        throw e;
      }
    },
    [toast]
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
    </PrinterContext.Provider>
  );
}
