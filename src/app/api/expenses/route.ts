import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/api-auth";
import { expenseSchema } from "@/lib/validators";
import { toNum } from "@/lib/utils";

export const dynamic = "force-dynamic";

function serialize(e: {
  id: string;
  type: string;
  amount: unknown;
  note: string;
  spentOn: Date;
  createdAt: Date;
}) {
  return {
    id: e.id,
    type: e.type,
    amount: toNum(e.amount),
    note: e.note,
    spentOn: e.spentOn.toISOString().slice(0, 10),
    createdAt: e.createdAt.toISOString(),
  };
}

// GET /api/expenses  — all expenses, newest first (owner only).
export async function GET(_req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const expenses = await prisma.expense.findMany({
    orderBy: { spentOn: "desc" },
  });

  return NextResponse.json({ expenses: expenses.map(serialize) });
}

// POST /api/expenses  — log an expense (owner only).
export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const expense = await prisma.expense.create({
    data: {
      type: parsed.data.type,
      amount: parsed.data.amount,
      note: parsed.data.note ?? "",
      spentOn: new Date(parsed.data.spentOn),
      createdBy: auth.user.id,
    },
  });

  return NextResponse.json({ expense: serialize(expense) }, { status: 201 });
}
