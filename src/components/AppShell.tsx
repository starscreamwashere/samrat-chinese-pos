"use client";

import { BottomNav } from "./BottomNav";

export function AppShell({
  title,
  right,
  children,
  /** Extra bottom padding when a page pins its own footer (e.g. order total). */
  footerSpace = false,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  footerSpace?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-black/10 bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold tracking-tight">{title}</h1>
        {right}
      </header>

      <main
        className="flex-1 px-4 py-4"
        style={{
          paddingBottom: footerSpace
            ? "calc(180px + env(safe-area-inset-bottom))"
            : "calc(76px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
