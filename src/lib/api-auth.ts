import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type SessionUser = { id: string; role: string; email?: string | null };

/**
 * Returns the authenticated user or a 401 response. Usage in a route:
 *   const auth = await requireUser();
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 */
export async function requireUser(): Promise<
  { user: SessionUser } | NextResponse
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user: session.user as SessionUser };
}

/** Like requireUser, but also enforces the owner role (finance/expenses). */
export async function requireOwner(): Promise<
  { user: SessionUser } | NextResponse
> {
  const auth = await requireUser();
  if (auth instanceof NextResponse) return auth;
  if (auth.user.role !== "owner") {
    return NextResponse.json(
      { error: "Forbidden — owner access only" },
      { status: 403 }
    );
  }
  return auth;
}
