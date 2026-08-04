import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/api-auth";
import { dayBounds, toNum } from "@/lib/utils";
import { subDays, startOfDay, endOfDay, format } from "date-fns";

export const dynamic = "force-dynamic";

// GET /api/dashboard  — finance + analytics snapshot (owner only).
export async function GET(_req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const now = new Date();

  // Today's revenue + order count.
  const todayOrders = await prisma.order.findMany({
    where: { createdAt: dayBounds(now) },
    select: { total: true },
  });
  const todayRevenue = todayOrders.reduce((s, o) => s + toNum(o.total), 0);
  const todayOrderCount = todayOrders.length;

  // All-time revenue and all-time expenses (net position).
  const [revenueAgg, expenseAgg, expensesByType] = await Promise.all([
    prisma.order.aggregate({ _sum: { total: true } }),
    prisma.expense.aggregate({ _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ["type"],
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = toNum(revenueAgg._sum.total);
  const totalExpenses = toNum(expenseAgg._sum.amount);
  const netPosition = totalRevenue - totalExpenses;

  const expenseBreakdown = expensesByType.map((e) => ({
    type: e.type,
    amount: toNum(e._sum.amount),
  }));

  // Revenue for the last 14 days (chart).
  const days = 14;
  const rangeStart = startOfDay(subDays(now, days - 1));
  const rangeOrders = await prisma.order.findMany({
    where: { createdAt: { gte: rangeStart, lte: endOfDay(now) } },
    select: { total: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = format(subDays(now, days - 1 - i), "yyyy-MM-dd");
    buckets.set(d, 0);
  }
  for (const o of rangeOrders) {
    const key = format(o.createdAt, "yyyy-MM-dd");
    buckets.set(key, (buckets.get(key) ?? 0) + toNum(o.total));
  }
  const revenueSeries = [...buckets.entries()].map(([date, revenue]) => ({
    date,
    label: format(new Date(date), "dd MMM"),
    revenue,
  }));

  return NextResponse.json({
    today: { revenue: todayRevenue, orderCount: todayOrderCount },
    finance: {
      totalRevenue,
      totalExpenses,
      netPosition,
      expenseBreakdown,
    },
    revenueSeries,
  });
}
