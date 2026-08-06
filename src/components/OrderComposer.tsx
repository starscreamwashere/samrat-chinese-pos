"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Minus, X } from "lucide-react";
import { CenteredSpinner, ErrorState, Spinner } from "@/components/ui";
import { apiGet } from "@/lib/fetcher";
import { formatINR, cn } from "@/lib/utils";
import {
  type CartLine,
  type MenuItem,
  type OrderType,
  type PayloadItem,
  type Size,
  lineName,
} from "@/lib/types";

const GRAVY_PRICE = 10;

export type ComposerSubmit = {
  items: PayloadItem[];
  orderType: OrderType;
};

/**
 * Tap-to-order menu grid + cart + pinned footer. Shared by the new-order screen
 * and the "add items to an existing order" detail screen.
 *
 * `onSubmit` should resolve on success (the cart is cleared) and reject on
 * failure (the cart is kept and a Retry is shown).
 */
export function OrderComposer({
  submitLabel,
  onSubmit,
  showOrderType = false,
  initialOrderType = "dine_in",
  resetOrderTypeOnSuccess = false,
  emptyHint = "Tap items to add",
}: {
  submitLabel: string;
  onSubmit: (payload: ComposerSubmit) => Promise<void>;
  showOrderType?: boolean;
  initialOrderType?: OrderType;
  resetOrderTypeOnSuccess?: boolean;
  emptyHint?: string;
}) {
  const menuQuery = useQuery({
    queryKey: ["menu", "active"],
    queryFn: () => apiGet<{ items: MenuItem[] }>("/api/menu?activeOnly=true"),
  });

  const items = menuQuery.data?.items ?? [];
  const categories = useMemo(() => {
    const set = new Set(items.map((i) => i.category));
    return ["All", ...Array.from(set)];
  }, [items]);

  const [activeCat, setActiveCat] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderType, setOrderType] = useState<OrderType>(initialOrderType);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const visibleItems =
    activeCat === "All" ? items : items.filter((i) => i.category === activeCat);

  const total = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = cart.reduce((s, l) => s + l.quantity, 0);

  function addToCart(item: MenuItem, size: Size) {
    const price =
      size === "half"
        ? item.halfPrice ?? item.fullPrice ?? 0
        : item.fullPrice ?? 0;
    const key = `${item.id}:${size}:n`;

    setCart((prev) => {
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          menuItemId: item.id,
          baseName: item.name,
          size,
          gravy: false,
          unitPrice: price,
          quantity: 1,
        },
      ];
    });
    setSaveError(null);
  }

  function changeQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function toggleGravy(line: CartLine) {
    const gravy = !line.gravy;
    const basePrice = line.gravy ? line.unitPrice - GRAVY_PRICE : line.unitPrice;
    const newPrice = basePrice + (gravy ? GRAVY_PRICE : 0);
    const newKey = `${line.menuItemId}:${line.size}:${gravy ? "g" : "n"}`;

    setCart((prev) => {
      const withoutOld = prev.filter((l) => l.key !== line.key);
      const existingIdx = withoutOld.findIndex((l) => l.key === newKey);
      if (existingIdx >= 0) {
        const next = [...withoutOld];
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: next[existingIdx].quantity + line.quantity,
        };
        return next;
      }
      return [...withoutOld, { ...line, key: newKey, gravy, unitPrice: newPrice }];
    });
  }

  async function submit() {
    if (cart.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit({
        orderType,
        items: cart.map((l) => ({
          menuItemId: l.menuItemId,
          itemName: lineName(l),
          unitPrice: l.unitPrice,
          quantity: l.quantity,
        })),
      });
      setCart([]);
      if (resetOrderTypeOnSuccess) setOrderType("dine_in");
    } catch (e) {
      // Keep the tapped items on screen; let the owner retry.
      setSaveError(
        e instanceof Error ? e.message : "Couldn't save — check connection."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {menuQuery.isLoading ? (
        <CenteredSpinner label="Loading menu…" />
      ) : menuQuery.isError ? (
        <ErrorState
          message="Couldn't load the menu."
          onRetry={() => menuQuery.refetch()}
        />
      ) : (
        <>
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                className={cn(
                  "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
                  activeCat === cat
                    ? "bg-brand text-white"
                    : "bg-white text-ink/70 border border-black/10"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleItems.map((item) => (
              <MenuButton key={item.id} item={item} onAdd={addToCart} />
            ))}
          </div>
          {visibleItems.length === 0 && (
            <p className="py-10 text-center text-sm text-ink/50">
              No items in this category.
            </p>
          )}
        </>
      )}

      <ComposerFooter
        cart={cart}
        total={total}
        itemCount={itemCount}
        submitLabel={submitLabel}
        emptyHint={emptyHint}
        showOrderType={showOrderType}
        orderType={orderType}
        setOrderType={setOrderType}
        onQty={changeQty}
        onRemove={removeLine}
        onToggleGravy={toggleGravy}
        onSubmit={submit}
        saving={saving}
        saveError={saveError}
      />
    </>
  );
}

function MenuButton({
  item,
  onAdd,
}: {
  item: MenuItem;
  onAdd: (item: MenuItem, size: Size) => void;
}) {
  const hasHalf = item.halfPrice != null;

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex-1 px-3 pt-3">
        <p className="text-sm font-semibold leading-tight">{item.name}</p>
      </div>
      {hasHalf ? (
        <div className="mt-2 grid grid-cols-2 gap-px bg-black/5">
          <button
            onClick={() => onAdd(item, "half")}
            className="bg-white px-2 py-3 text-center active:bg-brand/5"
          >
            <span className="block text-[11px] uppercase text-ink/40">Half</span>
            <span className="nums text-sm font-bold text-brand">
              {formatINR(item.halfPrice as number)}
            </span>
          </button>
          <button
            onClick={() => onAdd(item, "full")}
            className="bg-white px-2 py-3 text-center active:bg-brand/5"
          >
            <span className="block text-[11px] uppercase text-ink/40">Full</span>
            <span className="nums text-sm font-bold text-brand">
              {formatINR(item.fullPrice as number)}
            </span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => onAdd(item, "single")}
          className="mt-2 bg-white px-3 py-3 text-center active:bg-brand/5"
        >
          <span className="nums text-base font-bold text-brand">
            {formatINR(item.fullPrice as number)}
          </span>
        </button>
      )}
    </div>
  );
}

function ComposerFooter({
  cart,
  total,
  itemCount,
  submitLabel,
  emptyHint,
  showOrderType,
  orderType,
  setOrderType,
  onQty,
  onRemove,
  onToggleGravy,
  onSubmit,
  saving,
  saveError,
}: {
  cart: CartLine[];
  total: number;
  itemCount: number;
  submitLabel: string;
  emptyHint: string;
  showOrderType: boolean;
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  onQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onToggleGravy: (line: CartLine) => void;
  onSubmit: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="fixed inset-x-0 bottom-[64px] z-30 mx-auto max-w-2xl">
      <div className="mx-2 rounded-t-2xl border border-black/10 bg-white shadow-pinned">
        {cart.length > 0 && expanded && (
          <div className="max-h-[35vh] divide-y divide-black/5 overflow-y-auto px-3 py-1">
            {cart.map((line) => {
              const hasSize = line.size !== "single";
              return (
                <div key={line.key} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {lineName(line)}
                    </p>
                    <p className="nums text-xs text-ink/50">
                      {formatINR(line.unitPrice)} each
                    </p>
                    {hasSize && (
                      <button
                        onClick={() => onToggleGravy(line)}
                        className={cn(
                          "mt-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                          line.gravy
                            ? "bg-brand text-white"
                            : "bg-black/5 text-ink/60"
                        )}
                      >
                        + Gravy ₹10
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onQty(line.key, -1)}
                      className="btn-ghost h-8 w-8 !p-0"
                      aria-label="Decrease"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="nums w-6 text-center text-sm font-bold">
                      {line.quantity}
                    </span>
                    <button
                      onClick={() => onQty(line.key, 1)}
                      className="btn-ghost h-8 w-8 !p-0"
                      aria-label="Increase"
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      onClick={() => onRemove(line.key)}
                      className="ml-1 text-ink/30 hover:text-money-negative"
                      aria-label="Remove"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {saveError && (
          <div className="flex items-center justify-between gap-2 border-t border-money-negative/20 bg-money-negative/5 px-3 py-2">
            <p className="text-xs font-medium text-money-negative">{saveError}</p>
            <button
              onClick={onSubmit}
              className="rounded-lg bg-money-negative px-3 py-1 text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        )}

        <div className="border-t border-black/5 p-3">
          {(showOrderType || cart.length > 0) && (
            <div className="mb-2 flex items-center justify-between">
              {showOrderType ? (
                <div className="flex rounded-xl bg-black/5 p-0.5 text-sm">
                  {(["dine_in", "phone"] as OrderType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setOrderType(t)}
                      className={cn(
                        "rounded-lg px-3 py-1.5 font-medium transition",
                        orderType === t ? "bg-white shadow-sm" : "text-ink/50"
                      )}
                    >
                      {t === "dine_in" ? "Dine-in" : "Phone"}
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              {cart.length > 0 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs text-ink/40"
                >
                  {expanded ? "Hide items" : `Show ${itemCount} items`}
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-ink/50">
                {cart.length === 0
                  ? emptyHint
                  : `${itemCount} item${itemCount > 1 ? "s" : ""}`}
              </p>
              <p className="nums text-2xl font-extrabold">{formatINR(total)}</p>
            </div>
            <button
              onClick={onSubmit}
              disabled={cart.length === 0 || saving}
              className="btn-primary min-h-[56px] flex-1 px-6 text-lg"
            >
              {saving ? <Spinner className="text-white" /> : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
