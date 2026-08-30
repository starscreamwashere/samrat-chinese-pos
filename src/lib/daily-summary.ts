import { prisma } from "@/lib/prisma";
import { dayBounds, formatINR, toNum } from "@/lib/utils";
import { format } from "date-fns";

export type TopItem = { name: string; quantity: number; revenue: number };

export type SummaryData = {
  date: Date;
  totalRevenue: number;
  orderCount: number;
  topItems: TopItem[];
};

/** Compute the revenue / order-count / top-items summary for a given day. */
export async function computeDailySummary(
  date: Date = new Date()
): Promise<SummaryData> {
  const bounds = dayBounds(date);

  const orders = await prisma.order.findMany({
    where: { createdAt: bounds },
    include: { items: true },
  });

  const totalRevenue = orders.reduce((sum, o) => sum + toNum(o.total), 0);
  const orderCount = orders.length;

  // Aggregate top items by snapshot name.
  const agg = new Map<string, { quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const key = item.itemName;
      const prev = agg.get(key) ?? { quantity: 0, revenue: 0 };
      prev.quantity += item.quantity;
      prev.revenue += toNum(item.unitPrice) * item.quantity;
      agg.set(key, prev);
    }
  }

  const topItems: TopItem[] = [...agg.entries()]
    .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return { date, totalRevenue, orderCount, topItems };
}

/** Human-friendly WhatsApp message body for a summary. */
export function formatSummaryMessage(s: SummaryData): string {
  const dateLabel = format(s.date, "EEE, dd MMM yyyy");
  const lines = [
    `🍜 *Samrat Chinese — Daily Summary*`,
    `📅 ${dateLabel}`,
    ``,
    `💰 Revenue: *${formatINR(s.totalRevenue)}*`,
    `🧾 Orders: *${s.orderCount}*`,
  ];

  if (s.topItems.length > 0) {
    lines.push(``, `🔥 Top items:`);
    s.topItems.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.name} — ${t.quantity}× (${formatINR(t.revenue)})`);
    });
  } else {
    lines.push(``, `No orders recorded today.`);
  }

  return lines.join("\n");
}

/**
 * Parameters for the approved WhatsApp *template* (the reliable nightly push).
 * Order matches the template's body placeholders:
 *   {{1}} date · {{2}} revenue · {{3}} order count · {{4}} top items (one line)
 *
 * Top items are flattened to a single comma-separated line because template
 * parameters can't contain newlines. See README "WhatsApp setup" for the exact
 * template body to register in Meta.
 */
export function summaryTemplateParams(s: SummaryData): string[] {
  const dateLabel = format(s.date, "EEE, dd MMM yyyy");
  const topItems =
    s.topItems.length > 0
      ? s.topItems
          .map(
            (t, i) =>
              `${i + 1}) ${t.name} x${t.quantity} (${formatINR(t.revenue)})`
          )
          .join(", ")
      : "No orders recorded today";

  return [
    dateLabel,
    formatINR(s.totalRevenue),
    String(s.orderCount),
    topItems,
  ];
}
