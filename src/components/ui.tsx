"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} size={20} />;
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-ink/50">
      <Spinner className="h-6 w-6" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-black/10 py-16 text-center">
      {icon && <div className="text-ink/30">{icon}</div>}
      <p className="font-semibold text-ink/70">{title}</p>
      {hint && <p className="max-w-xs text-sm text-ink/50">{hint}</p>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-money-negative/20 bg-money-negative/5 py-10 text-center">
      <p className="px-6 text-sm font-medium text-money-negative">{message}</p>
      {onRetry && (
        <button className="btn-ghost px-4 py-2 text-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
