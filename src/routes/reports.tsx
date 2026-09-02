import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel } from "@/components/app/Panel";
import { Button } from "@/components/ui/button";
import { useGym } from "@/lib/gym/store";
import {
  activeMembers,
  gymMembers,
  currentMembership,
  metricMeta,
  metricStart,
  money,
  planDistribution,
  profitOfSales,
  rangeToMetric,
  revenueForMetric,
  revenueSeries,
  shortDate,
  statusOf,
  topProducts,
  totalDue,
  totalRevenue,
} from "@/lib/gym/selectors";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Daily, weekly, monthly and yearly reports on revenue, memberships, dues and product sales — exportable as CSV.",
      },
      { property: "og:title", content: "Reports & Analytics — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Revenue trends, membership breakdowns, sales performance and CSV export.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ReportsPage />
    </AppShell>
  ),
});

const RANGES = ["daily", "weekly", "monthly", "yearly"] as const;
type RangeKey = (typeof RANGES)[number];
const GOLDS = ["#D4AF37", "#B8912C", "#E8CE7A", "#8C6D1F", "#F2E2AC"];

function ReportsPage() {
  const state = useGym();
  const [range, setRange] = useState<RangeKey>("monthly");

  const series = useMemo(() => (state ? revenueSeries(state, range) : []), [state, range]);

  if (!state) return null;
  const cur = state.settings.currency;
  const dist = planDistribution(state);
  const products = topProducts(state, 5);
  const statuses = gymMembers(state).reduce<Record<string, number>>((acc, m) => {
    const s = statusOf(state, m.id);
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});

  const exportCsv = () => {
    const rows = [
      ["Period", "Revenue"],
      ...series.map((d) => [d.label, String(d.total)]),
      [],
      ["Summary", ""],
      ["Total revenue", String(totalRevenue(state))],
      ["Pending dues", String(totalDue(state))],
      ["Product profit", String(profitOfSales(state))],
      ["Active members", String(statuses.active ?? 0)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ironvault-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported");
  };

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle={`Generated ${shortDate(new Date())} · all figures computed locally`}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
            <Button onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
              range === r
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            metricMeta(rangeToMetric(range)).label,
            money(revenueForMetric(state, rangeToMetric(range)), cur),
          ],
          ["Pending dues", money(totalDue(state), cur)],
          ["Product profit", money(profitOfSales(state, metricStart(rangeToMetric(range))), cur)],
          ["Active members", String(statuses.active ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="surface-panel rounded-2xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl text-gradient-gold">{value}</p>
          </div>
        ))}
      </div>

      <Panel title={`Revenue — ${range}`} className="mb-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series}>
              <defs>
                <linearGradient id="revGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="label"
                stroke="#8b8b8b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis stroke="#8b8b8b" fontSize={11} tickLine={false} axisLine={false} width={56} />
              <Tooltip
                contentStyle={{
                  background: "#111111",
                  border: "1px solid rgba(212,175,55,0.35)",
                  borderRadius: 12,
                  color: "#fff",
                }}
                formatter={(v: number) => money(v, cur)}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="#D4AF37"
                strokeWidth={2}
                fill="url(#revGold)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Membership distribution">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dist}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {dist.map((_, i) => (
                    <Cell key={i} fill={GOLDS[i % GOLDS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="rounded-xl border border-gold/60 bg-popover px-3.5 py-2.5 text-xs shadow-lg">
                        <p className="font-semibold text-gold">{payload[0].name}</p>
                        <p className="mt-0.5 font-medium text-gold/90">
                          Members: {payload[0].value}
                        </p>
                      </div>
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {dist.map((d, i) => (
              <li key={d.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: GOLDS[i % GOLDS.length] }}
                  />
                  {d.name}
                </span>
                <span className="font-medium">{d.value}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Top selling products">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={products}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="name"
                  stroke="#8b8b8b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#8b8b8b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                />
                <Tooltip
                  cursor={{ fill: "rgba(212,175,55,0.08)" }}
                  contentStyle={{
                    background: "#111111",
                    border: "1px solid rgba(212,175,55,0.35)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
                <Bar dataKey="revenue" fill="#D4AF37" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Membership status summary" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-3">Member</th>
                <th className="py-3">Status</th>
                <th className="py-3">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {gymMembers(state)
                .slice(0, 10)
                .map((m) => {
                  const ms = currentMembership(state, m.id);
                  return (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2.5">{m.name}</td>
                      <td className="py-2.5 capitalize text-muted-foreground">
                        {statusOf(state, m.id)}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {ms ? shortDate(ms.endDate) : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
