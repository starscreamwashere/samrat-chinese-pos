import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { updateOrderSchema } from "@/lib/validators";
import { serializeOrder } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/orders/:id  — a single order with its items.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, createdByUser: { select: { name: true } } },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order: serializeOrder(order) });
}

// PATCH /api/orders/:id  — update an order's type (dine_in / phone).
// Fixes the common counter slip: saving a phone order as dine-in (or vice versa).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = updateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderType, tableNo, customerName, customerPhone } = parsed.data;
  const data: {
    orderType?: "dine_in" | "phone";
    tableNo?: number | null;
    customerName?: string | null;
    customerPhone?: string | null;
  } = {};

  if (orderType !== undefined) {
    data.orderType = orderType;
    // Keep metadata consistent with the type: clear the irrelevant side.
    if (orderType === "dine_in") {
      data.customerName = null;
      data.customerPhone = null;
    } else {
      data.tableNo = null;
    }
  }
  if (tableNo !== undefined) data.tableNo = tableNo;
  if (customerName !== undefined) data.customerName = customerName;
  if (customerPhone !== undefined) data.customerPhone = customerPhone;

  try {
    const order = await prisma.order.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        orderType: true,
        tableNo: true,
        customerName: true,
        customerPhone: true,
      },
    });
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
