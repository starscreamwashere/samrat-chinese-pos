"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ReceiptText,
  Phone,
  Utensils,
  ChevronRight,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenteredSpinner, EmptyState, ErrorState } from "@/components/ui";
import { apiGet } from "@/lib/fetcher";
import { formatINR } from "@/lib/utils";

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

export default function OrdersPage() {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", "today"],
    queryFn: () =>
      apiGet<{ orders: Order[]; dailyTotal: number }>("/api/orders"),
    refetchInterval: 30_000,
  });

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
          {data.orders.map((order, idx) => (
            <button
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="card block w-full p-4 text-left transition active:scale-[0.99] hover:bg-black/[0.01]"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    {data.orders.length - idx}
                  </span>
                  {order.orderType === "phone" ? (
                    <span className="flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-ink/60">
                      <Phone size={12} />
                      {order.customerName || "Phone"}
                    </span>
                  ) : order.tableNo != null ? (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                      <Utensils size={12} /> Table {order.tableNo}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-ink/50">
                      <Utensils size={13} /> Dine-in
                    </span>
                  )}
                  <span className="text-xs text-ink/40">
                    {format(new Date(order.createdAt), "h:mm a")}
                  </span>
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
              <div className="mt-2 flex items-center justify-between border-t border-black/5 pt-2 text-xs font-medium text-brand">
                <span className="flex items-center gap-1">
                  <Plus size={14} /> Add items / edit
                </span>
                <ChevronRight size={16} className="text-ink/30" />
              </div>
            </button>
          ))}
        </div>
      )}
    </AppShell>
  );
}
