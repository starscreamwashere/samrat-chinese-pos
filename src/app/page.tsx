"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { OrderComposer, type ComposerSubmit } from "@/components/OrderComposer";
import { apiSend } from "@/lib/fetcher";

export default function OrderPage() {
  const { data: session } = useSession();

  async function saveOrder(payload: ComposerSubmit) {
    await apiSend("/api/orders", "POST", {
      orderType: payload.orderType,
      items: payload.items,
    });
  }

  return (
    <AppShell
      title="New Order"
      footerSpace
      right={
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1 text-sm text-ink/50 hover:text-ink"
          aria-label="Log out"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">
            {session?.user?.name ?? "Logout"}
          </span>
        </button>
      }
    >
      <OrderComposer
        submitLabel="Save Order"
        onSubmit={saveOrder}
        showOrderType
        resetOrderTypeOnSuccess
        emptyHint="Tap items to start an order"
      />
    </AppShell>
  );
}
