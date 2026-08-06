import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { createOrderSchema } from "@/lib/validators";
import { serializeOrder } from "@/lib/serialize";
import { dayBounds, toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/orders  — today's orders (default) with items, newest first.
export async function GET(_req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const orders = await prisma.order.findMany({
    where: { createdAt: dayBounds() },
    include: {
      items: true,
      createdByUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized = orders.map(serializeOrder);
  const dailyTotal = serialized.reduce((s, o) => s + o.total, 0);

  return NextResponse.json({ orders: serialized, dailyTotal });
}

// POST /api/orders  — create an order. Total is recomputed server-side.
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items, orderType, tableNo, customerName, customerPhone } =
    parsed.data;
  const total = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  const order = await prisma.order.create({
    data: {
      total,
      orderType,
      // Table only for dine-in; customer only for phone.
      tableNo: orderType === "dine_in" ? tableNo ?? null : null,
      customerName: orderType === "phone" ? customerName ?? null : null,
      customerPhone: orderType === "phone" ? customerPhone ?? null : null,
      createdBy: auth.user.id,
      items: {
        create: items.map((it) => ({
          menuItemId: it.menuItemId ?? null,
          itemName: it.itemName,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
        })),
      },
    },
    include: { items: true },
  });

  return NextResponse.json(
    { order: { id: order.id, total: toNum(order.total) } },
    { status: 201 }
  );
}
