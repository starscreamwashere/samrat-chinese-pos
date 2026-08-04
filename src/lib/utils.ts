import { startOfDay, endOfDay } from "date-fns";

/** Format a number as Indian Rupees, no decimals for whole amounts. */
export function formatINR(value: number): string {
  const n = Math.round(value * 100) / 100;
  const isWhole = Number.isInteger(n);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Coerce a Prisma Decimal | number | string to a JS number. */
export function toNum(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value.toString());
}

/** [start, end] Date pair covering the given day in the server's timezone. */
export function dayBounds(date: Date = new Date()): { gte: Date; lte: Date } {
  return { gte: startOfDay(date), lte: endOfDay(date) };
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
