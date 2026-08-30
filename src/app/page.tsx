"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { AppShell } from "@/components/AppShell";
import { OrderComposer, type ComposerSubmit } from "@/components/OrderComposer";
import { usePrinter } from "@/components/PrinterProvider";
import { apiSend } from "@/lib/fetcher";

export default function OrderPage() {
  const { data: session } = useSession();
  const printer = usePrinter();

  async function saveOrder(payload: ComposerSubmit) {
    const res = await apiSend<{ order: { id: string; total: number } }>(
      "/api/orders",
      "POST",
      {
        orderType: payload.orderType,
        tableNo: payload.tableNo,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        items: payload.items,
      }
    );

    // Print the bill from what we just sent + the server's id/total. Fire and
    // forget: the order is already saved, so a printer hiccup must never undo
    // the save or block the next order. Does nothing if no printer is paired.
    printer.autoPrint({
      orderId: res.order.id,
      total: res.order.total,
      createdAt: new Date(),
      orderType: payload.orderType,
      tableNo: payload.tableNo,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      staffName: session?.user?.name ?? null,
      items: payload.items.map((it) => ({
        name: it.itemName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      })),
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
