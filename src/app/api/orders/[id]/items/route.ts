import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { orderItemSchema } from "@/lib/validators";
import { serializeOrder } from "@/lib/serialize";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

const addItemsSchema = z.object({
  items: z.array(orderItemSchema).min(1, "Add at least one item"),
});

// POST /api/orders/:id/items  — append follow-up items to an existing order.
// Used when a customer orders more after their first round; the new items land
// on the same bill and the order total is recomputed from all its items.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = addItemsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items } = parsed.data;

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Ensure the order exists (throws -> caught -> 404).
      await tx.order.findUniqueOrThrow({ where: { id: params.id } });

      await tx.orderItem.createMany({
        data: items.map((it) => ({
          orderId: params.id,
          menuItemId: it.menuItemId ?? null,
          itemName: it.itemName,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      });

      // Recompute total from the full set of items.
      const all = await tx.orderItem.findMany({
        where: { orderId: params.id },
      });
      const total = all.reduce(
        (sum, it) => sum + toNum(it.unitPrice) * it.quantity,
        0
      );

      return tx.order.update({
        where: { id: params.id },
        data: { total },
        include: { items: true, createdByUser: { select: { name: true } } },
      });
    });

    return NextResponse.json({ order: serializeOrder(order) });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
