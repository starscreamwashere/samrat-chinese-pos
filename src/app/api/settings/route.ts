import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireOwner } from "@/lib/api-auth";
import { getTableCount, setTableCount } from "@/lib/settings";
import { settingsSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// GET /api/settings — read settings (any logged-in user; order screen needs it).
export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;

  const tableCount = await getTableCount();
  return NextResponse.json({ tableCount });
}

// PUT /api/settings — update settings (owner only).
export async function PUT(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const tableCount = await setTableCount(parsed.data.tableCount);
  return NextResponse.json({ tableCount });
}
