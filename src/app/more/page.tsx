"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  UtensilsCrossed,
  Wallet,
  LogOut,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";

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
