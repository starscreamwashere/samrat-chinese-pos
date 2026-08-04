"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  CenteredSpinner,
  EmptyState,
  ErrorState,
  Spinner,
} from "@/components/ui";
import { apiGet, apiSend } from "@/lib/fetcher";
import { formatINR, cn } from "@/lib/utils";
import type { MenuItem } from "@/lib/types";

type Draft = {
  id?: string;
  name: string;
  category: string;
  halfPrice: string;
  fullPrice: string;
  isActive: boolean;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  category: "",
  halfPrice: "",
  fullPrice: "",
  isActive: true,
};

export default function MenuPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["menu", "all"],
    queryFn: () => apiGet<{ items: MenuItem[] }>("/api/menu"),
  });

  const [draft, setDraft] = useState<Draft | null>(null);

  const forbidden = error instanceof Error && /owner/i.test(error.message);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of data?.items ?? []) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return [...map.entries()];
  }, [data]);

  const categories = useMemo(
    () => Array.from(new Set((data?.items ?? []).map((i) => i.category))),
    [data]
  );

  async function toggleActive(item: MenuItem) {
    await apiSend(`/api/menu/${item.id}`, "PATCH", { isActive: !item.isActive });
    await qc.invalidateQueries({ queryKey: ["menu"] });
  }

  if (forbidden) {
    return (
      <AppShell title="Menu">
        <EmptyState
          title="Owner access only"
          hint="Only the owner can edit the menu."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Menu"
      right={
        <button
          onClick={() => setDraft({ ...EMPTY_DRAFT })}
          className="btn-primary px-3 py-2 text-sm"
        >
          <Plus size={16} /> Add
        </button>
      }
    >
      {isLoading ? (
        <CenteredSpinner label="Loading menu…" />
      ) : isError ? (
        <ErrorState message="Couldn't load the menu." onRetry={() => refetch()} />
      ) : grouped.length === 0 ? (
        <EmptyState title="No menu items." hint="Add your first item." />
      ) : (
        <div className="space-y-5">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">
                {category}
              </h2>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "card flex items-center justify-between gap-3 p-3",
                      !item.isActive && "opacity-60"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>
                      <p className="nums text-xs text-ink/50">
                        {item.halfPrice != null &&
                          `Half ${formatINR(item.halfPrice)} · `}
                        Full {formatINR(item.fullPrice ?? 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(item)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          item.isActive
                            ? "bg-money-positive/10 text-money-positive"
                            : "bg-black/5 text-ink/50"
                        )}
                      >
                        {item.isActive ? "Active" : "Hidden"}
                      </button>
                      <button
                        onClick={() =>
                          setDraft({
                            id: item.id,
                            name: item.name,
                            category: item.category,
                            halfPrice:
                              item.halfPrice != null
                                ? String(item.halfPrice)
                                : "",
                            fullPrice: String(item.fullPrice ?? ""),
                            isActive: item.isActive,
                          })
                        }
                        className="text-ink/40 hover:text-brand"
                        aria-label="Edit item"
                      >
                        <Pencil size={17} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {draft && (
        <MenuEditor
          draft={draft}
          categories={categories}
          onClose={() => setDraft(null)}
          onSaved={async () => {
            setDraft(null);
            await qc.invalidateQueries({ queryKey: ["menu"] });
          }}
        />
      )}
    </AppShell>
  );
}

function MenuEditor({
  draft,
  categories,
  onClose,
  onSaved,
}: {
  draft: Draft;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const full = Number(form.fullPrice);
    if (!form.name.trim() || !form.category.trim() || !full || full <= 0) {
      setErr("Name, category, and a full price are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim(),
      halfPrice: form.halfPrice === "" ? null : Number(form.halfPrice),
      fullPrice: full,
      isActive: form.isActive,
    };
    try {
      if (form.id) {
        await apiSend(`/api/menu/${form.id}`, "PATCH", payload);
      } else {
        await apiSend("/api/menu", "POST", payload);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {form.id ? "Edit item" : "Add item"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-ink/40">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Category</label>
            <input
              className="input"
              list="menu-categories"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <datalist id="menu-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Half price (₹)</label>
              <input
                className="input nums"
                type="number"
                inputMode="decimal"
                value={form.halfPrice}
                onChange={(e) =>
                  setForm({ ...form, halfPrice: e.target.value })
                }
                placeholder="—"
              />
            </div>
            <div>
              <label className="label">Full price (₹)</label>
              <input
                className="input nums"
                type="number"
                inputMode="decimal"
                value={form.fullPrice}
                onChange={(e) =>
                  setForm({ ...form, fullPrice: e.target.value })
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-5 w-5 accent-brand"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Show on order screen (active)
          </label>

          {err && (
            <p className="text-sm font-medium text-money-negative">{err}</p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="btn-ghost flex-1 py-3">
              Cancel
            </button>
            <button
              onClick={save}
              className="btn-primary flex-1 py-3"
              disabled={saving}
            >
              {saving ? <Spinner className="text-white" /> : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
