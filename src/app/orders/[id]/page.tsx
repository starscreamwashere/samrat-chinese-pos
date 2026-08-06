"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Phone, Utensils } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { OrderComposer, type ComposerSubmit } from "@/components/OrderComposer";
import { CenteredSpinner, ErrorState, Spinner } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/fetcher";
import { formatINR, cn } from "@/lib/utils";
import { useState } from "react";

type OrderItem = {
  id: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
};
type Order = {
  id: string;
  total: number;
  orderType: "dine_in" | "phone";
  createdAt: string;
  createdBy: string;
  items: OrderItem[];
};

export default function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["order", id],
    queryFn: () => apiGet<{ order: Order }>(`/api/orders/${id}`),
  });

  const order = data?.order;
  const [savingType, setSavingType] = useState(false);

  async function setType(orderType: Order["orderType"]) {
    if (!order || order.orderType === orderType) return;
    setSavingType(true);
    try {
      await apiSend(`/api/orders/${id}`, "PATCH", { orderType });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["order", id] }),
        qc.invalidateQueries({ queryKey: ["orders", "today"] }),
      ]);
    } finally {
      setSavingType(false);
    }
  }

  async function appendItems(payload: ComposerSubmit) {
    await apiSend(`/api/orders/${id}/items`, "POST", { items: payload.items });
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["order", id] }),
      qc.invalidateQueries({ queryKey: ["orders", "today"] }),
    ]);
  }

  return (
    <AppShell
      title="Order"
      footerSpace
      right={
        <button
          onClick={() => router.push("/orders")}
          className="flex items-center gap-1 text-sm text-ink/50 hover:text-ink"
          aria-label="Back to orders"
        >
          <ArrowLeft size={16} /> Orders
        </button>
      }
    >
      {isLoading ? (
        <CenteredSpinner label="Loading order…" />
      ) : isError || !order ? (
        <ErrorState message="Couldn't load this order." onRetry={() => refetch()} />
      ) : (
        <>
          {/* Current bill */}
          <div className="card mb-3 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-lg bg-black/5 p-0.5">
                <TypeOption
                  active={order.orderType === "dine_in"}
                  disabled={savingType}
                  onClick={() => setType("dine_in")}
                  icon={<Utensils size={13} />}
                  label="Dine-in"
                />
                <TypeOption
                  active={order.orderType === "phone"}
                  disabled={savingType}
                  onClick={() => setType("phone")}
                  icon={<Phone size={13} />}
                  label="Phone"
                />
                {savingType && <Spinner className="mx-1 h-4 w-4 text-ink/40" />}
              </div>
              <span className="text-xs text-ink/40">
                {format(new Date(order.createdAt), "h:mm a")}
              </span>
            </div>

            <ul className="space-y-1.5">
              {order.items.map((it) => (
                <li
                  key={it.id}
                  className="flex justify-between text-sm text-ink/70"
                >
                  <span>
                    <span className="nums font-medium text-ink">
                      {it.quantity}×
                    </span>{" "}
                    {it.itemName}
                  </span>
                  <span className="nums text-ink/50">
                    {formatINR(it.unitPrice * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3">
              <span className="text-sm font-semibold text-ink/60">
                Current total
              </span>
              <span className="nums text-xl font-extrabold">
                {formatINR(order.total)}
              </span>
            </div>
          </div>

          <p className="mb-2 px-1 text-sm font-semibold text-ink/60">
            Add follow-up items
          </p>

          {/* Reuse the tap-to-order grid; appends to this order. */}
          <OrderComposer
            submitLabel="Add to order"
            onSubmit={appendItems}
            emptyHint="Tap items to add to this order"
          />
        </>
      )}
    </AppShell>
  );
}

function TypeOption({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition",
        active ? "bg-white text-ink shadow-sm" : "text-ink/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
