"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bluetooth, Printer, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { cn } from "@/lib/utils";

/**
 * Web Bluetooth printer probe — answers one question: can this browser + this
 * printer talk over BLE? If the SC588 shows in the picker, it's BLE (good). It
 * then discovers a writable characteristic and sends an ESC/POS test slip.
 *
 * Everything is logged on-screen because this can only be tested on a real
 * Android phone against the real printer — paste the log back to tune it.
 */

// Common BLE service UUIDs used by cheap 58mm thermal printers. We must list
// these up-front (optionalServices) or the browser won't expose them.
const KNOWN_PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ffb0-0000-1000-8000-00805f9b34fb",
  "0000ff80-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip/ISSC transparent UART
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

const enc = new TextEncoder();

// Bare-minimum, maximally-compatible slip: init + plain ASCII + line feeds.
// No size/align/cut commands — those can jam basic printers.
function escposTestSlip(): Uint8Array {
  const parts: number[] = [];
  const text = (s: string) => parts.push(...Array.from(enc.encode(s)));
  parts.push(0x1b, 0x40); // ESC @  (initialize)
  text("\n");
  text("Samrat Chinese\n");
  text("Printer test OK\n");
  text("If you can read this,\n");
  text("printing works!\n");
  text("\n\n\n\n\n\n"); // feed so text clears the tear bar
  return new Uint8Array(parts);
}

// Standard BLE thermal-printer channel (the SC588 exposes service 000018f0).
const PRINT_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const PRINT_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function PrinterTestPage() {
  const router = useRouter();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<"unknown" | "ble" | "printed">(
    "unknown"
  );
  const logRef = useRef<HTMLTextAreaElement>(null);

  // Detect Web Bluetooth support after mount — `navigator` is client-only, so
  // computing it during render would mismatch the server HTML (hydration error).
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(
      typeof navigator !== "undefined" &&
        !!(navigator as unknown as { bluetooth?: unknown }).bluetooth
    );
  }, []);

  function add(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function writeChunks(
    ch: {
      properties: { write: boolean; writeWithoutResponse: boolean };
      writeValueWithoutResponse?: (d: BufferSource) => Promise<void>;
      writeValueWithResponse?: (d: BufferSource) => Promise<void>;
      writeValue?: (d: BufferSource) => Promise<void>;
    },
    data: Uint8Array
  ) {
    const size = 20; // safe default BLE MTU payload
    // Prefer a CONFIRMED write (write-with-response) so we know bytes landed;
    // fall back to write-without-response only if that's all the char supports.
    const preferConfirmed = ch.properties.write;
    let method = "none";
    for (let i = 0; i < data.length; i += size) {
      const chunk = data.slice(i, i + size);
      if (preferConfirmed && ch.writeValueWithResponse) {
        await ch.writeValueWithResponse(chunk);
        method = "write-with-response";
      } else if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) {
        await ch.writeValueWithoutResponse(chunk);
        method = "write-without-response";
      } else if (ch.writeValue) {
        await ch.writeValue(chunk);
        method = "writeValue";
      }
      await sleep(40); // give the printer's buffer time between packets
    }
    return method;
  }

  async function run() {
    setLog([]);
    setVerdict("unknown");
    setBusy(true);
    try {
      const bt = (navigator as unknown as { bluetooth: any }).bluetooth;
      add("Opening Bluetooth picker… choose your SC588 printer.");
      const device = await bt.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      // Reaching here means the device is a BLE device shown by the browser.
      setVerdict("ble");
      add(`✅ Selected: "${device.name ?? "(no name)"}" — id ${device.id}`);
      add("This printer is visible over BLE — the good case.");

      add("Connecting to GATT server…");
      const server = await device.gatt.connect();
      add("Connected. Discovering services…");

      // Log the full service/characteristic map (diagnostics), and pick the
      // first writable char as a generic fallback.
      const services = await server.getPrimaryServices();
      add(`Found ${services.length} service(s):`);
      let fallback: any = null;
      for (const s of services) {
        const chars = await s.getCharacteristics();
        for (const c of chars) {
          const p = c.properties;
          const flags =
            [
              p.write && "write",
              p.writeWithoutResponse && "writeNoResp",
              p.read && "read",
              p.notify && "notify",
            ]
              .filter(Boolean)
              .join(",") || "none";
          add(`  ${s.uuid.slice(0, 8)} / ${c.uuid.slice(0, 8)} [${flags}]`);
          if (!fallback && (p.write || p.writeWithoutResponse)) fallback = c;
        }
      }

      // Prefer the standard printer data characteristic; else the fallback.
      let target: any = null;
      try {
        const svc = await server.getPrimaryService(PRINT_SERVICE);
        target = await svc.getCharacteristic(PRINT_CHAR);
        add("→ Using standard printer channel 00002af1.");
      } catch {
        target = fallback;
        if (target) add(`→ Using fallback channel ${target.uuid.slice(0, 8)}.`);
      }

      if (!target) {
        add("⚠ No writable characteristic found. Paste this log back to me.");
        return;
      }

      const bytes = escposTestSlip();
      add(`Sending ${bytes.length} bytes…`);
      const method = await writeChunks(target, bytes);
      add(`📄 Sent via ${method}. Watch the printer for paper.`);
      setVerdict("printed");
    } catch (e) {
      const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      add(`❌ ${msg}`);
      if (/cancelled|User cancelled/i.test(msg)) {
        add("(You closed the picker — tap the button and pick the printer.)");
      } else if (/globally disabled|not found|no devices/i.test(msg)) {
        add(
          "If the printer never appears here but DOES appear in Android's own " +
            "Bluetooth settings, it's Classic/SPP — a web app can't use it."
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function copyLog() {
    const text = log.join("\n");
    navigator.clipboard?.writeText(text).catch(() => {
      logRef.current?.select();
      document.execCommand("copy");
    });
  }

  return (
    <AppShell
      title="Printer test"
      right={
        <button
          onClick={() => router.push("/more")}
          className="flex items-center gap-1 text-sm text-ink/50 hover:text-ink"
          aria-label="Back to more"
        >
          <ArrowLeft size={16} /> More
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Bluetooth size={18} className="text-brand" />
            <h2 className="text-sm font-semibold">Bluetooth printer probe</h2>
          </div>
          <p className="text-sm text-ink/60">
            Open this on the <b>Android phone</b>, turn the SC588 on, then tap
            below and pick it from the list. This tells us if the printer works
            over BLE and prints a test slip.
          </p>

          {supported === false && (
            <p className="mt-3 rounded-lg bg-money-negative/5 p-3 text-sm font-medium text-money-negative">
              This browser doesn’t support Web Bluetooth. Use <b>Chrome on
              Android</b> (not iPhone, not desktop Safari).
            </p>
          )}

          <button
            onClick={run}
            disabled={supported === false || busy}
            className="btn-primary mt-4 w-full py-3 text-base"
          >
            <Printer size={18} />
            {busy ? "Working…" : "Connect printer & print test"}
          </button>
        </div>

        {verdict !== "unknown" && (
          <div
            className={cn(
              "card p-4 text-sm font-semibold",
              verdict === "printed"
                ? "text-money-positive"
                : "text-money-positive"
            )}
          >
            {verdict === "printed"
              ? "✅ Test slip sent. If it printed, we can build the real bill."
              : "✅ Printer is BLE-visible. If nothing printed, the log below tells me why."}
          </div>
        )}

        {log.length > 0 && (
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink/60">Log</h3>
              <button
                onClick={copyLog}
                className="flex items-center gap-1 text-xs text-brand"
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <textarea
              ref={logRef}
              readOnly
              value={log.join("\n")}
              className="h-64 w-full resize-none rounded-lg bg-black/[0.03] p-2 font-mono text-xs leading-relaxed"
            />
            <p className="mt-2 text-xs text-ink/50">
              Paste this log back to me — especially the service/char lines and
              any ❌ error.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
