import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { serializeOrder } from "@/lib/serialize";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

// DELETE /api/orders/:id/items/:itemId — remove a single line item (e.g. a
// cancelled dish) from an order and recompute the order total. Removing the
// last remaining item is blocked — deleting the whole order is the right action
// there, and it keeps orders from becoming empty ₹0 ghosts.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({
        where: { id: params.itemId },
      });
      // Item must exist and belong to this order.
      if (!item || item.orderId !== params.id) return "not_found" as const;

      const count = await tx.orderItem.count({ where: { orderId: params.id } });
      if (count <= 1) return "last_item" as const;

      await tx.orderItem.delete({ where: { id: params.itemId } });

      // Recompute the order total from the remaining items.
      const remaining = await tx.orderItem.findMany({
        where: { orderId: params.id },
      });
      const total = remaining.reduce(
        (sum, it) => sum + toNum(it.unitPrice) * it.quantity,
        0
      );

      return tx.order.update({
        where: { id: params.id },
        data: { total },
        include: { items: true, createdByUser: { select: { name: true } } },
      });
    });

    if (result === "not_found") {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    if (result === "last_item") {
      return NextResponse.json(
        { error: "Can't remove the last item — delete the order instead." },
        { status: 400 }
      );
    }

    return NextResponse.json({ order: serializeOrder(result) });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
