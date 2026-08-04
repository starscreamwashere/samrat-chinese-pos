"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp, ReceiptText, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CenteredSpinner, ErrorState, EmptyState } from "@/components/ui";
import { apiGet } from "@/lib/fetcher";
import { formatINR, cn } from "@/lib/utils";

type Dashboard = {
  today: { revenue: number; orderCount: number };
  finance: {
    totalRevenue: number;
    totalExpenses: number;
    netPosition: number;
    expenseBreakdown: { type: string; amount: number }[];
  };
  revenueSeries: { date: string; label: string; revenue: number }[];
};

const EXPENSE_LABELS: Record<string, string> = {
  rent: "Rent",
  salary: "Salaries",
  capital: "Capital invested",
  other: "Other",
};

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<Dashboard>("/api/dashboard"),
  });

  const forbidden = error instanceof Error && /owner/i.test(error.message);

  return (
    <AppShell title="Dashboard">
      {isLoading ? (
        <CenteredSpinner label="Crunching numbers…" />
      ) : forbidden ? (
        <EmptyState
          title="Owner access only"
          hint="Finance and analytics are visible to the owner account."
        />
      ) : isError ? (
        <ErrorState
          message="Couldn't load the dashboard."
          onRetry={() => refetch()}
        />
      ) : data ? (
        <div className="space-y-4">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<TrendingUp size={18} />}
              label="Today's Revenue"
              value={formatINR(data.today.revenue)}
              accent="positive"
            />
            <StatCard
              icon={<ReceiptText size={18} />}
              label="Today's Orders"
              value={String(data.today.orderCount)}
            />
            <StatCard
              icon={<Wallet size={18} />}
              label="Net Position"
              value={formatINR(data.finance.netPosition)}
              accent={data.finance.netPosition >= 0 ? "positive" : "negative"}
              className="col-span-2"
              big
            />
          </div>

          {/* Revenue chart */}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink/60">
              Revenue — last 14 days
            </h2>
            {data.revenueSeries.every((d) => d.revenue === 0) ? (
              <p className="py-10 text-center text-sm text-ink/40">
                No revenue recorded yet.
              </p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.revenueSeries}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#eee"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#999" }}
                      interval="preserveStartEnd"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#999" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatINR(v), "Revenue"]}
                      cursor={{ fill: "rgba(215,38,61,0.06)" }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#D7263D"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Finance breakdown */}
          <div className="card p-4">
            <h2 className="mb-3 text-sm font-semibold text-ink/60">
              Finance (all time)
            </h2>
            <FinanceRow
              label="Total revenue"
              value={formatINR(data.finance.totalRevenue)}
              accent="positive"
            />
            {data.finance.expenseBreakdown.map((e) => (
              <FinanceRow
                key={e.type}
                label={EXPENSE_LABELS[e.type] ?? e.type}
                value={`− ${formatINR(e.amount)}`}
                accent="negative"
                indent
              />
            ))}
            <FinanceRow
              label="Total expenses"
              value={`− ${formatINR(data.finance.totalExpenses)}`}
              accent="negative"
            />
            <div className="mt-2 border-t border-black/10 pt-2">
              <FinanceRow
                label="Net position"
                value={formatINR(data.finance.netPosition)}
                accent={data.finance.netPosition >= 0 ? "positive" : "negative"}
                bold
              />
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  className,
  big,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "positive" | "negative";
  className?: string;
  big?: boolean;
}) {
  return (
    <div className={cn("card p-4", className)}>
      <div className="mb-1 flex items-center gap-1.5 text-ink/40">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p
        className={cn(
          "nums font-extrabold",
          big ? "text-3xl" : "text-2xl",
          accent === "positive" && "text-money-positive",
          accent === "negative" && "text-money-negative"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  accent,
  bold,
  indent,
}: {
  label: string;
  value: string;
  accent?: "positive" | "negative";
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5",
        indent && "pl-3"
      )}
    >
      <span
        className={cn(
          "text-sm",
          bold ? "font-bold text-ink" : "text-ink/60",
          indent && "text-ink/45"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "nums text-sm",
          bold ? "text-lg font-extrabold" : "font-semibold",
          accent === "positive" && "text-money-positive",
          accent === "negative" && "text-money-negative"
        )}
      >
        {value}
      </span>
    </div>
  );
}
