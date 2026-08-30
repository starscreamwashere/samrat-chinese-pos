import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeDailySummary,
  formatSummaryMessage,
  summaryTemplateParams,
} from "@/lib/daily-summary";
import {
  sendWhatsAppTemplate,
  sendWhatsAppText,
  type WhatsAppResult,
} from "@/lib/whatsapp";
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
  //
  // Prefer the approved template when one is configured — it's the only thing
  // Meta delivers for an unprompted 7pm push. Plain text is used only when no
  // template is set (e.g. local testing inside the 24h window).
  const owner = process.env.OWNER_WHATSAPP_NUMBER;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en";

  let sendResult: WhatsAppResult = {
    ok: false,
    error: "OWNER_WHATSAPP_NUMBER not configured",
  };

  if (owner) {
    const send = templateName
      ? () =>
          sendWhatsAppTemplate(
            owner,
            templateName,
            templateLang,
            summaryTemplateParams(summary)
          )
      : () => sendWhatsAppText(owner, formatSummaryMessage(summary));

    sendResult = await send();
    if (!sendResult.ok) sendResult = await send(); // one retry
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
