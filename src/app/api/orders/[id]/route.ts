import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-auth";
import { updateOrderSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

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

  try {
    const order = await prisma.order.update({
      where: { id: params.id },
      data: { orderType: parsed.data.orderType },
      select: { id: true, orderType: true },
    });
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
