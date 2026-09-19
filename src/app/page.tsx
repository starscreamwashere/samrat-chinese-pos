"use client";

import { useState } from "react";
import { AlertTriangle, LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { OrderComposer, type ComposerSubmit } from "@/components/OrderComposer";
import { usePrinter } from "@/components/PrinterProvider";
import { useToast } from "@/components/ToastProvider";
import { Spinner } from "@/components/ui";
import { apiSend } from "@/lib/fetcher";

export default function OrderPage() {
  const { data: session } = useSession();
  const printer = usePrinter();
  const toast = useToast();
  const qc = useQueryClient();

  // Orders that failed to reach the server after retries — surfaced so a
  // dropped connection can never silently lose an order.
  const [failed, setFailed] = useState<ComposerSubmit[]>([]);
  const [retrying, setRetrying] = useState(false);

  // Actually send the order + print the bill. Throws on failure.
  async function persist(payload: ComposerSubmit) {
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

    // Refresh the orders list cache so it's up to date when next opened.
    qc.invalidateQueries({ queryKey: ["orders", "today"] });

    // Print the bill (fire-and-forget; does nothing if no printer is paired).
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

  // Called by the composer the instant Save is tapped (cart already cleared).
  async function saveOrder(payload: ComposerSubmit) {
    toast.success("Order saved"); // instant — the rush never waits on the network
    try {
      await persist(payload);
    } catch {
      try {
        await persist(payload); // one silent retry for a transient blip
      } catch {
        toast.error("An order didn't save — tap Retry");
        setFailed((f) => [...f, payload]);
      }
    }
  }

  async function retryFailed() {
    setRetrying(true);
    const still: ComposerSubmit[] = [];
    for (const p of failed) {
      try {
        await persist(p);
      } catch {
        still.push(p);
      }
    }
    setFailed(still);
    setRetrying(false);
    toast[still.length === 0 ? "success" : "error"](
      still.length === 0
        ? "All orders saved"
        : `${still.length} order(s) still not saved`
    );
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
      {failed.length > 0 && (
        <div className="fixed left-1/2 top-3 z-[70] flex w-[calc(100%-1rem)] max-w-md -translate-x-1/2 items-center gap-2 rounded-xl border border-money-negative/30 bg-money-negative px-3 py-2 text-white shadow-lg">
          <AlertTriangle size={18} className="shrink-0" />
          <span className="flex-1 text-sm font-medium">
            {failed.length} order{failed.length > 1 ? "s" : ""} didn&apos;t save
          </span>
          <button
            onClick={retryFailed}
            disabled={retrying}
            className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-money-negative"
          >
            {retrying ? <Spinner className="h-4 w-4" /> : "Retry"}
          </button>
        </div>
      )}

      <OrderComposer
        submitLabel="Save Order"
        onSubmit={saveOrder}
        showOrderType
        resetOrderTypeOnSuccess
        optimistic
        emptyHint="Tap items to start an order"
      />
    </AppShell>
  );
}
