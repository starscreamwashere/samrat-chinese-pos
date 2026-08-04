import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireOwner } from "@/lib/api-auth";
import { menuItemSchema } from "@/lib/validators";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

function serialize(item: {
  id: string;
  name: string;
  category: string;
  halfPrice: unknown;
  fullPrice: unknown;
  isActive: boolean;
}) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    halfPrice: item.halfPrice == null ? null : toNum(item.halfPrice),
    fullPrice: toNum(item.fullPrice),
    isActive: item.isActive,
  };
}

// GET /api/menu?activeOnly=true  — list menu items (any logged-in user).
export async function GET(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const activeOnly = req.nextUrl.searchParams.get("activeOnly") === "true";

  const items = await prisma.menuItem.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ items: items.map(serialize) });
}

// POST /api/menu  — create a menu item (owner only).
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = menuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const item = await prisma.menuItem.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      halfPrice: parsed.data.halfPrice ?? null,
      fullPrice: parsed.data.fullPrice,
      isActive: parsed.data.isActive,
    },
  });

  return NextResponse.json({ item: serialize(item) }, { status: 201 });
}
