"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReceiptText, Phone, Utensils, Pencil, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenteredSpinner, EmptyState, ErrorState, Spinner } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/fetcher";
import { formatINR, cn } from "@/lib/utils";

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

export default function OrdersPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", "today"],
    queryFn: () =>
      apiGet<{ orders: Order[]; dailyTotal: number }>("/api/orders"),
    refetchInterval: 30_000,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function setType(order: Order, orderType: Order["orderType"]) {
    if (order.orderType === orderType) {
      setEditingId(null);
      return;
    }
    setSavingId(order.id);
    try {
      await apiSend(`/api/orders/${order.id}`, "PATCH", { orderType });
      await qc.invalidateQueries({ queryKey: ["orders", "today"] });
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <AppShell
      title="Today's Orders"
      right={
        data ? (
          <div className="text-right">
            <p className="text-[11px] uppercase text-ink/40">Total</p>
            <p className="nums text-lg font-bold text-money-positive">
              {formatINR(data.dailyTotal)}
            </p>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <CenteredSpinner label="Loading orders…" />
      ) : isError ? (
        <ErrorState message="Couldn't load orders." onRetry={() => refetch()} />
      ) : !data || data.orders.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={40} />}
          title="No orders yet today."
          hint="Saved orders will appear here with a running total."
        />
      ) : (
        <div className="space-y-3">
          {data.orders.map((order, idx) => {
            const editing = editingId === order.id;
            const saving = savingId === order.id;
            return (
              <div key={order.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                      {data.orders.length - idx}
                    </span>

                    {editing ? (
                      <div className="flex items-center gap-1 rounded-lg bg-black/5 p-0.5">
                        <TypeOption
                          active={order.orderType === "dine_in"}
                          disabled={saving}
                          onClick={() => setType(order, "dine_in")}
                          icon={<Utensils size={13} />}
                          label="Dine-in"
                        />
                        <TypeOption
                          active={order.orderType === "phone"}
                          disabled={saving}
                          onClick={() => setType(order, "phone")}
                          icon={<Phone size={13} />}
                          label="Phone"
                        />
                        {saving && <Spinner className="mx-1 h-4 w-4 text-ink/40" />}
                      </div>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-ink/50">
                        {order.orderType === "phone" ? (
                          <>
                            <Phone size={13} /> Phone
                          </>
                        ) : (
                          <>
                            <Utensils size={13} /> Dine-in
                          </>
                        )}
                      </span>
                    )}

                    {!editing && (
                      <span className="text-xs text-ink/40">
                        {format(new Date(order.createdAt), "h:mm a")}
                      </span>
                    )}

                    <button
                      onClick={() =>
                        setEditingId(editing ? null : order.id)
                      }
                      className="text-ink/30 hover:text-brand"
                      aria-label={editing ? "Done editing" : "Edit order type"}
                    >
                      {editing ? <X size={16} /> : <Pencil size={15} />}
                    </button>
                  </div>
                  <span className="nums shrink-0 text-lg font-bold">
                    {formatINR(order.total)}
                  </span>
                </div>
                <ul className="space-y-1">
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
              </div>
            );
          })}
        </div>
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
        "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition",
        active ? "bg-white text-ink shadow-sm" : "text-ink/50"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
