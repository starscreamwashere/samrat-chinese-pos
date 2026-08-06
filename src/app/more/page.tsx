"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  UtensilsCrossed,
  Wallet,
  LogOut,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
  Grid2x2,
  Minus,
  Plus,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Spinner } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

export default function MorePage() {
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";

  return (
    <AppShell title="More">
      <div className="space-y-4">
        {isOwner && (
          <div className="card divide-y divide-black/5 overflow-hidden">
            <MoreLink
              href="/menu"
              icon={<UtensilsCrossed size={20} />}
              label="Manage Menu"
              hint="Add items, edit prices, hide/show"
            />
            <MoreLink
              href="/expenses"
              icon={<Wallet size={20} />}
              label="Expenses"
              hint="Log rent, salary, capital"
            />
          </div>
        )}

        {isOwner && <TablesSetting />}

        {/* Restaurant details */}
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-ink/60">
            Samrat Chinese
          </h2>
          <Detail
            icon={<MapPin size={16} />}
            text="59/60, Shivram Seth Amrutwar Marg, Opp. 114 BDD Chawl, Worli, Mumbai — 400013"
          />
          <Detail icon={<Phone size={16} />} text="8591929077" />
          <Detail
            icon={<Clock size={16} />}
            text="12:00pm–4:00pm & 7:00pm–12:00am"
          />
          <p className="pt-1 text-xs text-ink/40">
            Free home delivery on orders above ₹300
          </p>
        </div>

        {/* Account */}
        <div className="card p-4">
          <div className="mb-3">
            <p className="text-sm font-medium">{session?.user?.name}</p>
            <p className="text-xs text-ink/50">
              {session?.user?.email} · {isOwner ? "Owner" : "Staff"}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-ghost w-full py-3 text-money-negative"
          >
            <LogOut size={18} /> Log out
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function TablesSetting() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiGet<{ tableCount: number }>("/api/settings"),
  });

  const [count, setCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Local value: user edits, or falls back to the saved value.
  const value = count ?? data?.tableCount ?? 0;

  function bump(delta: number) {
    setSaved(false);
    setCount(Math.max(0, Math.min(100, value + delta)));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await apiSend("/api/settings", "PUT", { tableCount: value });
      await qc.invalidateQueries({ queryKey: ["settings"] });
      setCount(null);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const dirty = count !== null && count !== (data?.tableCount ?? 0);

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Grid2x2 size={18} className="text-brand" />
        <h2 className="text-sm font-semibold">Tables</h2>
      </div>
      <p className="mb-3 text-xs text-ink/50">
        How many tables do you have? This many table buttons appear when taking a
        dine-in order.
      </p>

      {isLoading ? (
        <Spinner className="h-5 w-5 text-ink/40" />
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => bump(-1)}
            className="btn-ghost h-11 w-11 !p-0"
            aria-label="Fewer tables"
          >
            <Minus size={18} />
          </button>
          <span className="nums w-12 text-center text-2xl font-extrabold">
            {value}
          </span>
          <button
            onClick={() => bump(1)}
            className="btn-ghost h-11 w-11 !p-0"
            aria-label="More tables"
          >
            <Plus size={18} />
          </button>

          <button
            onClick={save}
            disabled={!dirty || saving}
            className={cn("btn-primary ml-auto px-5 py-2.5", !dirty && "opacity-50")}
          >
            {saving ? <Spinner className="text-white" /> : "Save"}
          </button>
        </div>
      )}
      {saved && !dirty && (
        <p className="mt-2 text-xs font-medium text-money-positive">Saved.</p>
      )}
    </div>
  );
}

function MoreLink({
  href,
  icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-black/[0.02]"
    >
      <span className="text-brand">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-ink/50">{hint}</span>
      </span>
      <ChevronRight size={18} className="text-ink/30" />
    </Link>
  );
}

function Detail({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-ink/70">
      <span className="mt-0.5 text-ink/40">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
