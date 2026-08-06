import { toNum } from "@/lib/utils";

type OrderItemRow = {
  id: string;
  itemName: string;
  unitPrice: unknown;
  quantity: number;
};

type OrderRow = {
  id: string;
  total: unknown;
  orderType: string;
  createdAt: Date;
  items: OrderItemRow[];
  createdByUser?: { name: string } | null;
};

/** Consistent JSON shape for an order across list + detail endpoints. */
export function serializeOrder(order: OrderRow) {
  return {
    id: order.id,
    total: toNum(order.total),
    orderType: order.orderType,
    createdAt: order.createdAt.toISOString(),
    createdBy: order.createdByUser?.name ?? "—",
    items: order.items.map((it) => ({
      id: it.id,
      itemName: it.itemName,
      unitPrice: toNum(it.unitPrice),
      quantity: it.quantity,
    })),
  };
}
