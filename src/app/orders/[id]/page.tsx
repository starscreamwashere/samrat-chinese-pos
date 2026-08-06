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
  tableNo: number | null;
  customerName: string | null;
  customerPhone: string | null;
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

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<{ tableCount: number }>("/api/settings"),
  });
  const tableCount = settingsQuery.data?.tableCount ?? 0;

  const order = data?.order;
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function patchOrder(fields: Record<string, unknown>) {
    setSaving(true);
    setActionError(null);
    try {
      await apiSend(`/api/orders/${id}`, "PATCH", fields);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["order", id] }),
        qc.invalidateQueries({ queryKey: ["orders", "today"] }),
      ]);
    } catch (e) {
      // Show a friendly message instead of an unhandled rejection, and
      // resync from the server (e.g. if the order was deleted elsewhere).
      setActionError(
        e instanceof Error ? e.message : "Couldn't update the order."
      );
      qc.invalidateQueries({ queryKey: ["order", id] });
    } finally {
      setSaving(false);
    }
  }

  function setType(orderType: Order["orderType"]) {
    if (!order || order.orderType === orderType) return;
    return patchOrder({ orderType });
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
                  disabled={saving}
                  onClick={() => setType("dine_in")}
                  icon={<Utensils size={13} />}
                  label="Dine-in"
                />
                <TypeOption
                  active={order.orderType === "phone"}
                  disabled={saving}
                  onClick={() => setType("phone")}
                  icon={<Phone size={13} />}
                  label="Phone"
                />
                {saving && <Spinner className="mx-1 h-4 w-4 text-ink/40" />}
              </div>
              <span className="text-xs text-ink/40">
                {format(new Date(order.createdAt), "h:mm a")}
              </span>
            </div>

            {/* Table (dine-in) or customer (phone) */}
            {order.orderType === "dine_in" ? (
              <TableEditor
                tableCount={tableCount}
                tableNo={order.tableNo}
                disabled={saving}
                onPick={(n) => patchOrder({ tableNo: n })}
              />
            ) : (
              <CustomerEditor
                key={order.id}
                name={order.customerName ?? ""}
                phone={order.customerPhone ?? ""}
                saving={saving}
                onSave={(name, phone) =>
                  patchOrder({
                    customerName: name.trim() || null,
                    customerPhone: phone.trim() || null,
                  })
                }
              />
            )}

            {actionError && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-money-negative/20 bg-money-negative/5 px-3 py-2">
                <p className="text-xs font-medium text-money-negative">
                  {actionError}
                </p>
                <button
                  onClick={() => refetch()}
                  className="rounded-lg bg-money-negative px-3 py-1 text-xs font-semibold text-white"
                >
                  Refresh
                </button>
              </div>
            )}

            <ul className="mt-3 space-y-1.5">
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

function TableEditor({
  tableCount,
  tableNo,
  disabled,
  onPick,
}: {
  tableCount: number;
  tableNo: number | null;
  disabled: boolean;
  onPick: (n: number | null) => void;
}) {
  if (tableCount <= 0) {
    return (
      <p className="text-xs text-ink/40">
        Set your number of tables in More → Tables to assign one.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-ink/40">Table</span>
      {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onPick(tableNo === n ? null : n)}
          className={cn(
            "nums h-9 min-w-9 rounded-lg px-2 text-sm font-semibold transition disabled:opacity-50",
            tableNo === n ? "bg-brand text-white" : "bg-black/5 text-ink/60"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function CustomerEditor({
  name,
  phone,
  saving,
  onSave,
}: {
  name: string;
  phone: string;
  saving: boolean;
  onSave: (name: string, phone: string) => void;
}) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const dirty = n !== name || p !== phone;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input
          className="input !py-2 text-sm"
          value={n}
          onChange={(e) => setN(e.target.value)}
          placeholder="Customer name"
          aria-label="Customer name"
        />
        <input
          className="input nums !py-2 text-sm"
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="Phone number"
          inputMode="tel"
          aria-label="Customer phone number"
        />
      </div>
      {dirty && (
        <button
          onClick={() => onSave(n, p)}
          disabled={saving}
          className="btn-ghost w-full py-1.5 text-xs"
        >
          {saving ? <Spinner className="h-4 w-4" /> : "Save customer details"}
        </button>
      )}
    </div>
  );
}
