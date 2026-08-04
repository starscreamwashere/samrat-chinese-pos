import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeDailySummary,
  formatSummaryMessage,
} from "@/lib/daily-summary";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";
// Cron and DB work — never cache.

/**
 * Protected cron endpoint. Vercel Cron calls this with
 *   Authorization: Bearer <CRON_SECRET>
 * It computes today's totals, upserts a daily_summaries row, and sends the
 * owner a WhatsApp message. Retries the send once on failure; the summary
 * remains viewable on the Dashboard regardless.
 */
async function handle(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const summary = await computeDailySummary(now);

  // Upsert the daily_summaries row (unique on summary_date).
  const summaryDate = startOfDay(now);
  await prisma.dailySummary.upsert({
    where: { summaryDate },
    update: {
      totalRevenue: summary.totalRevenue,
      orderCount: summary.orderCount,
      topItems: summary.topItems,
      sentAt: new Date(),
    },
    create: {
      summaryDate,
      totalRevenue: summary.totalRevenue,
      orderCount: summary.orderCount,
      topItems: summary.topItems,
    },
  });

  // Send WhatsApp, retry once on failure.
  const owner = process.env.OWNER_WHATSAPP_NUMBER;
  const message = formatSummaryMessage(summary);

  let sendResult: Awaited<ReturnType<typeof sendWhatsAppText>> = {
    ok: false,
    error: "OWNER_WHATSAPP_NUMBER not configured",
  };

  if (owner) {
    sendResult = await sendWhatsAppText(owner, message);
    if (!sendResult.ok) {
      sendResult = await sendWhatsAppText(owner, message); // one retry
    }
  }

  if (!sendResult.ok) {
    console.error("Daily summary WhatsApp send failed:", sendResult.error);
  }

  return NextResponse.json({
    ok: true,
    summary: {
      totalRevenue: summary.totalRevenue,
      orderCount: summary.orderCount,
      topItems: summary.topItems,
    },
    whatsapp: sendResult.ok
      ? { sent: true, id: sendResult.id }
      : { sent: false, error: sendResult.error },
  });
}

// Vercel Cron issues GET; POST supported for manual testing.
export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
