import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/api-auth";
import { menuItemUpdateSchema } from "@/lib/validators";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

// PATCH /api/menu/:id  — update a menu item (owner only).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = menuItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.menuItem.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.category !== undefined && {
          category: parsed.data.category,
        }),
        ...(parsed.data.halfPrice !== undefined && {
          halfPrice: parsed.data.halfPrice,
        }),
        ...(parsed.data.fullPrice !== undefined && {
          fullPrice: parsed.data.fullPrice,
        }),
        ...(parsed.data.isActive !== undefined && {
          isActive: parsed.data.isActive,
        }),
      },
    });

    return NextResponse.json({
      item: {
        id: item.id,
        name: item.name,
        category: item.category,
        halfPrice: item.halfPrice == null ? null : toNum(item.halfPrice),
        fullPrice: toNum(item.fullPrice),
        isActive: item.isActive,
      },
    });
  } catch {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }
}

// DELETE /api/menu/:id  — soft-delete by deactivating (owner only).
// (Hard delete is avoided so historical order_items keep their FK.)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  try {
    await prisma.menuItem.update({
      where: { id: params.id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
  }
}
