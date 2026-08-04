"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  CenteredSpinner,
  EmptyState,
  ErrorState,
  Spinner,
} from "@/components/ui";
import { apiGet, apiSend } from "@/lib/fetcher";
import { formatINR, cn } from "@/lib/utils";

type Expense = {
  id: string;
  type: "rent" | "salary" | "capital" | "other";
  amount: number;
  note: string;
  spentOn: string;
  createdAt: string;
};

const TYPES: { value: Expense["type"]; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "capital", label: "Capital" },
  { value: "other", label: "Other" },
];

export default function ExpensesPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => apiGet<{ expenses: Expense[] }>("/api/expenses"),
  });

  const [type, setType] = useState<Expense["type"]>("rent");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [spentOn, setSpentOn] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const forbidden = error instanceof Error && /owner/i.test(error.message);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setFormError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await apiSend("/api/expenses", "POST", {
        type,
        amount: amt,
        note,
        spentOn,
      });
      setAmount("");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await apiSend(`/api/expenses/${id}`, "DELETE");
    await qc.invalidateQueries({ queryKey: ["expenses"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  if (forbidden) {
    return (
      <AppShell title="Expenses">
        <EmptyState
          title="Owner access only"
          hint="Only the owner can log and view expenses."
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="Expenses">
      {/* Log form */}
      <form onSubmit={submit} className="card mb-4 space-y-3 p-4">
        <div>
          <span className="label">Type</span>
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "rounded-xl border py-2 text-sm font-medium transition",
                  type === t.value
                    ? "border-brand bg-brand text-white"
                    : "border-black/10 bg-white text-ink/60"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="amount">
              Amount (₹)
            </label>
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              className="input nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="label" htmlFor="spentOn">
              Date
            </label>
            <input
              id="spentOn"
              type="date"
              className="input"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="note">
            Note (optional)
          </label>
          <input
            id="note"
            type="text"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. August rent, cook salary…"
          />
        </div>

        {formError && (
          <p className="text-sm font-medium text-money-negative">{formError}</p>
        )}

        <button
          type="submit"
          className="btn-primary w-full py-3"
          disabled={saving}
        >
          {saving ? <Spinner className="text-white" /> : "Log expense"}
        </button>
      </form>

      {/* List */}
      {isLoading ? (
        <CenteredSpinner label="Loading expenses…" />
      ) : isError ? (
        <ErrorState
          message="Couldn't load expenses."
          onRetry={() => refetch()}
        />
      ) : !data || data.expenses.length === 0 ? (
        <EmptyState
          icon={<Wallet size={40} />}
          title="No expenses logged yet."
          hint="Log rent, salaries, and capital to track net position."
        />
      ) : (
        <div className="space-y-2">
          {data.expenses.map((e) => (
            <div
              key={e.id}
              className="card flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold uppercase text-ink/60">
                    {e.type}
                  </span>
                  <span className="text-xs text-ink/40">
                    {format(new Date(e.spentOn), "dd MMM yyyy")}
                  </span>
                </div>
                {e.note && (
                  <p className="mt-0.5 truncate text-sm text-ink/60">
                    {e.note}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="nums font-bold text-money-negative">
                  − {formatINR(e.amount)}
                </span>
                <button
                  onClick={() => remove(e.id)}
                  className="text-ink/30 hover:text-money-negative"
                  aria-label="Delete expense"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
