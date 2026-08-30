/**
 * Web Bluetooth thermal-printer client for the SC588 (and similar cheap 58mm
 * BLE printers). This is the "real bill" counterpart to the on-screen probe in
 * `/printer-test`: it reuses the exact write path the probe proved works
 * (standard channel 000018f0 / 00002af1, 20-byte confirmed writes, a small
 * inter-packet delay) and adds an ESC/POS receipt builder.
 *
 * The connection lives at module scope so it survives client-side navigation —
 * pair the printer once, then every saved order can print without re-picking it
 * from the Bluetooth chooser (which the browser only allows during a tap).
 */

// Common BLE service UUIDs on cheap 58mm printers. They must be declared in
// `optionalServices` up-front or the browser hides them after connecting.
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

// The standard printer data channel the SC588 exposes (confirmed by the probe).
const PRINT_SERVICE = "000018f0-0000-1000-8000-00805f9b34fb";
const PRINT_CHAR = "00002af1-0000-1000-8000-00805f9b34fb";

const RECEIPT_WIDTH = 32; // characters per line on a 58mm roll
const enc = new TextEncoder();

/** Printed at the top/bottom of every bill. ASCII only — see `line()` below. */
export const RECEIPT_HEADER = {
  name: "Samrat Chinese",
  address: "Worli, Mumbai",
  phone: "8591929077",
  footer: "Thank you! Visit again",
};

/** Reasons `print`/`connect` can fail, so the UI can react (e.g. prompt to pair). */
export type PrinterErrorCode =
  | "unsupported"
  | "not_connected"
  | "no_characteristic"
  | "cancelled"
  | "write_failed";

export class PrinterError extends Error {
  code: PrinterErrorCode;
  constructor(code: PrinterErrorCode, message: string) {
    super(message);
    this.name = "PrinterError";
    this.code = code;
  }
}

// One order's worth of data, ready to render onto paper.
export type ReceiptData = {
  orderId: string;
  createdAt: Date;
  orderType: "dine_in" | "phone";
  tableNo?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  staffName?: string | null;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  total: number;
};

// Module-scoped connection. `any` mirrors the probe — the Web Bluetooth DOM
// types aren't in this project's lib, and we deliberately keep the same shape.
/* eslint-disable @typescript-eslint/no-explicit-any */
let device: any = null;
let characteristic: any = null;

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((fn) => fn());
}

/** Subscribe to connection-state changes; returns an unsubscribe fn. */
export function onPrinterChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!(navigator as any).bluetooth
  );
}

export function isConnected(): boolean {
  return !!characteristic && !!device?.gatt?.connected;
}

export function connectedName(): string | null {
  return device?.name ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Open the GATT connection and latch onto a writable characteristic. Prefers
// the standard printer channel, then falls back to the first writable char.
async function openGatt() {
  const server = await device.gatt.connect();
  try {
    const svc = await server.getPrimaryService(PRINT_SERVICE);
    characteristic = await svc.getCharacteristic(PRINT_CHAR);
  } catch {
    characteristic = null;
    const services = await server.getPrimaryServices();
    for (const s of services) {
      const chars = await s.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          characteristic = c;
          break;
        }
      }
      if (characteristic) break;
    }
  }
  if (!characteristic) {
    throw new PrinterError(
      "no_characteristic",
      "This printer has no writable channel."
    );
  }
}

/**
 * Open the Bluetooth chooser and pair a printer. Must be called from a user
 * gesture (a tap) — the browser blocks the chooser otherwise. Returns the
 * device name on success.
 */
export async function connect(): Promise<string> {
  if (!isSupported()) {
    throw new PrinterError(
      "unsupported",
      "This browser can't use Bluetooth. Use Chrome on Android."
    );
  }
  try {
    const bt = (navigator as any).bluetooth;
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_PRINTER_SERVICES,
    });
    device.addEventListener("gattserverdisconnected", () => {
      characteristic = null;
      emit();
    });
    await openGatt();
    emit();
    return device.name ?? "Printer";
  } catch (e) {
    if (e instanceof PrinterError) {
      device = null;
      characteristic = null;
      emit();
      throw e;
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancelled|user cancelled/i.test(msg)) {
      throw new PrinterError("cancelled", "No printer selected.");
    }
    device = null;
    characteristic = null;
    emit();
    throw new PrinterError("write_failed", msg);
  }
}

export function disconnect() {
  try {
    device?.gatt?.disconnect();
  } catch {
    /* ignore */
  }
  device = null;
  characteristic = null;
  emit();
}

// Re-open GATT if the printer dropped the link between prints (common on these
// cheap radios — they sleep aggressively).
async function ensureReady() {
  if (!device) {
    throw new PrinterError(
      "not_connected",
      "No printer paired. Connect one in More → Printer."
    );
  }
  if (!device.gatt?.connected || !characteristic) {
    characteristic = null;
    await openGatt();
    emit();
  }
}

async function writeChunks(data: Uint8Array) {
  const ch = characteristic;
  const size = 20; // safe BLE MTU payload
  const preferConfirmed = ch.properties.write;
  for (let i = 0; i < data.length; i += size) {
    const chunk = data.slice(i, i + size);
    if (preferConfirmed && ch.writeValueWithResponse) {
      await ch.writeValueWithResponse(chunk);
    } else if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) {
      await ch.writeValueWithoutResponse(chunk);
    } else if (ch.writeValue) {
      await ch.writeValue(chunk);
    }
    await sleep(40); // let the printer's buffer drain between packets
  }
}

/** Send raw ESC/POS bytes to the paired printer (reconnecting if needed). */
export async function printBytes(data: Uint8Array): Promise<void> {
  await ensureReady();
  try {
    await writeChunks(data);
  } catch (e) {
    // A stale handle throws — drop it so the next print reconnects cleanly.
    characteristic = null;
    emit();
    const msg = e instanceof Error ? e.message : String(e);
    throw new PrinterError("write_failed", msg);
  }
}

/** Build the ESC/POS bytes for a bill and print it. */
export async function printReceipt(data: ReceiptData): Promise<void> {
  await printBytes(buildReceipt(data));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Receipt rendering
//
// Deliberately conservative: the probe proved that `ESC @` + plain ASCII + line
// feeds prints cleanly, and that size/align commands can jam basic printers, so
// we lay everything out with spaces at a fixed 32-char width and stick to ASCII.
// ---------------------------------------------------------------------------

/** Rupees for a thermal roll: ASCII "Rs" (the ₹ glyph won't print). */
export function money(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const s = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `Rs ${s}`;
}

// Strip anything outside printable ASCII so the printer never gets a byte it
// renders as garbage (item names can contain stray unicode).
function ascii(s: string): string {
  return s.replace(/[^\x20-\x7e]/g, "").trim();
}

function center(s: string): string {
  const t = ascii(s).slice(0, RECEIPT_WIDTH);
  const pad = Math.max(0, Math.floor((RECEIPT_WIDTH - t.length) / 2));
  return " ".repeat(pad) + t;
}

// Left text + right text on one 32-char line; wraps the amount to its own
// right-aligned line when the label is too long to share the row.
function row(left: string, right: string): string[] {
  const l = ascii(left);
  const r = ascii(right);
  if (l.length + 1 + r.length <= RECEIPT_WIDTH) {
    const gap = RECEIPT_WIDTH - l.length - r.length;
    return [l + " ".repeat(gap) + r];
  }
  const truncated = l.slice(0, RECEIPT_WIDTH);
  const pad = Math.max(0, RECEIPT_WIDTH - r.length);
  return [truncated, " ".repeat(pad) + r];
}

function rule(): string {
  return "-".repeat(RECEIPT_WIDTH);
}

function fmtDate(d: Date): string {
  // e.g. "30 Aug, 8:14 PM" — kept ASCII and short.
  try {
    return d
      .toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(/ /g, " "); // some engines use a narrow no-break space
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/** Turn one order into the printable text of a bill. */
export function receiptText(data: ReceiptData): string {
  const lines: string[] = [];
  lines.push(center(RECEIPT_HEADER.name));
  lines.push(center(RECEIPT_HEADER.address));
  lines.push(center(RECEIPT_HEADER.phone));
  lines.push(rule());

  const where =
    data.orderType === "dine_in"
      ? data.tableNo
        ? `Dine-in  Table ${data.tableNo}`
        : "Dine-in"
      : "Phone / Takeaway";
  lines.push(...row(where, `#${shortId(data.orderId)}`));
  lines.push(fmtDate(data.createdAt));
  if (data.orderType === "phone") {
    const who = [data.customerName, data.customerPhone]
      .map((x) => (x ? ascii(x) : ""))
      .filter(Boolean)
      .join("  ");
    if (who) lines.push(who);
  }
  if (data.staffName) lines.push(`By: ${ascii(data.staffName)}`);
  lines.push(rule());

  let count = 0;
  for (const it of data.items) {
    count += it.quantity;
    const label = `${it.quantity}x ${it.name}`;
    lines.push(...row(label, money(it.unitPrice * it.quantity)));
  }

  lines.push(rule());
  lines.push(...row(`Items: ${count}`, `TOTAL  ${money(data.total)}`));
  lines.push(rule());
  lines.push(center(RECEIPT_HEADER.footer));
  return lines.join("\n");
}

/** Last 6 chars of an id, uppercased — a human-sized bill reference. */
export function shortId(id: string): string {
  return id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
}

/** ESC/POS byte stream for a bill: init + text + feed past the tear bar. */
export function buildReceipt(data: ReceiptData): Uint8Array {
  const parts: number[] = [];
  parts.push(0x1b, 0x40); // ESC @  (initialize)
  parts.push(...Array.from(enc.encode(receiptText(data))));
  parts.push(...Array.from(enc.encode("\n\n\n\n\n\n"))); // clear the tear bar
  return new Uint8Array(parts);
}
