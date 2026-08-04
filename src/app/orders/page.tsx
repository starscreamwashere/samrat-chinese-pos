"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ReceiptText, Phone, Utensils } from "lucide-react";
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
  createdAt: string;
  createdBy: string;
  items: OrderItem[];
};

export default function OrdersPage() {
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
            <div key={order.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    {data.orders.length - idx}
                  </span>
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
                  <span className="text-xs text-ink/40">
                    {format(new Date(order.createdAt), "h:mm a")}
                  </span>
                </div>
                <span className="nums text-lg font-bold">
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
          ))}
        </div>
      )}
    </AppShell>
  );
}
