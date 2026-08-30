import { prisma } from "@/lib/prisma";
import { dayBounds, formatINR, toNum } from "@/lib/utils";
import { format } from "date-fns";

export type TopItem = { name: string; quantity: number; revenue: number };

export type SummaryData = {
  date: Date;
  totalRevenue: number; // today's income (order revenue)
  orderCount: number;
  topItems: TopItem[];
  todayExpenses: number; // spent today — expenses dated (spent_on) today
  todayProfit: number; // today's income − today's spent
  allTimeProfit: number; // lifetime net position (all revenue − all expenses)
};

/** Compute the day's income/spent/profit + top items, plus all-time profit. */
export async function computeDailySummary(
  date: Date = new Date()
): Promise<SummaryData> {
  const bounds = dayBounds(date);

  const [orders, todayExpenseAgg, revenueAllAgg, expenseAllAgg] =
    await Promise.all([
      prisma.order.findMany({
        where: { createdAt: bounds },
        include: { items: true },
      }),
      // "Spent today" is keyed on the date the money applies to (spent_on),
      // not when the row was typed — so a rent entry lands on its own day.
      prisma.expense.aggregate({ _sum: { amount: true }, where: { spentOn: bounds } }),
      prisma.order.aggregate({ _sum: { total: true } }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
    ]);

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

  const todayExpenses = toNum(todayExpenseAgg._sum.amount);
  const todayProfit = totalRevenue - todayExpenses;
  const allTimeProfit =
    toNum(revenueAllAgg._sum.total) - toNum(expenseAllAgg._sum.amount);

  return {
    date,
    totalRevenue,
    orderCount,
    topItems,
    todayExpenses,
    todayProfit,
    allTimeProfit,
  };
}

/** Human-friendly WhatsApp message body for a summary. */
export function formatSummaryMessage(s: SummaryData): string {
  const dateLabel = format(s.date, "EEE, dd MMM yyyy");
  const lines = [
    `🍜 *Samrat Chinese — Daily Summary*`,
    `📅 ${dateLabel}`,
    ``,
    `💰 Income: *${formatINR(s.totalRevenue)}*`,
    `💸 Spent: *${formatINR(s.todayExpenses)}*`,
    `📈 Profit: *${formatINR(s.todayProfit)}*`,
    ``,
    `🧾 Orders: *${s.orderCount}*`,
  ];

  if (s.topItems.length > 0) {
    lines.push(`🔥 Top items:`);
    s.topItems.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.name} — ${t.quantity}× (${formatINR(t.revenue)})`);
    });
  } else {
    lines.push(`No orders recorded today.`);
  }

  lines.push(``, `🏦 All-time profit: *${formatINR(s.allTimeProfit)}*`);

  return lines.join("\n");
}

/**
 * Parameters for the approved WhatsApp *template* (the reliable nightly push).
 * Order matches the template's 7 body placeholders:
 *   {{1}} date · {{2}} income · {{3}} spent · {{4}} profit ·
 *   {{5}} order count · {{6}} top items (one line) · {{7}} all-time profit
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
    formatINR(s.todayExpenses),
    formatINR(s.todayProfit),
    String(s.orderCount),
    topItems,
    formatINR(s.allTimeProfit),
  ];
}
