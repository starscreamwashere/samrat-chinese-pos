import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/menu/popular?limit=8
 * The most-ordered active items, in popularity order — powers the "Popular"
 * quick-add row on the order screen so the dishes sold most often are one tap
 * away, no scrolling or typing.
 */
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const raw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 20) : 8;

  // Rank menu items by total quantity ever ordered.
  const grouped = await prisma.orderItem.groupBy({
    by: ["menuItemId"],
    where: { menuItemId: { not: null } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 3, // over-fetch: some may now be inactive or deleted
  });

  const ids = grouped
    .map((g) => g.menuItemId)
    .filter((x): x is string => x != null);

  if (ids.length === 0) return NextResponse.json({ items: [] });

  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids }, isActive: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  // Keep popularity order, drop inactive/missing, cap at limit.
  const ordered = ids
    .map((id) => byId.get(id))
    .filter((i): i is NonNullable<typeof i> => i != null)
    .slice(0, limit)
    .map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      halfPrice: i.halfPrice == null ? null : toNum(i.halfPrice),
      fullPrice: toNum(i.fullPrice),
      isActive: i.isActive,
    }));

  return NextResponse.json({ items: ordered });
}
