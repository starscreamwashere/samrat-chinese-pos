"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutGrid,
  ReceiptText,
  LineChart,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  ownerOnly?: boolean;
};

const TABS: Tab[] = [
  { href: "/", label: "Order", icon: LayoutGrid, match: (p) => p === "/" },
  {
    href: "/orders",
    label: "Orders",
    icon: ReceiptText,
    match: (p) => p.startsWith("/orders"),
  },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LineChart,
    match: (p) => p.startsWith("/dashboard"),
    ownerOnly: true,
  },
  {
    href: "/more",
    label: "More",
    icon: MoreHorizontal,
    match: (p) =>
      p.startsWith("/more") ||
      p.startsWith("/menu") ||
      p.startsWith("/expenses"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isOwner = session?.user?.role === "owner";

  const tabs = TABS.filter((t) => !t.ownerOnly || isOwner);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-4">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium transition",
                  active ? "text-brand" : "text-ink/50 hover:text-ink/80"
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
