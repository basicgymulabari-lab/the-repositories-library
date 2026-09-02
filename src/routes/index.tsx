import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Wallet,
  AlertTriangle,
  CalendarX,
  UserPlus,
  RefreshCw,
  BadgeX,
  IndianRupee,
  ShoppingBag,
  PackagePlus,
  FileText,
  TrendingUp,
  ArrowRight,
  CalendarClock,
  Boxes,
  ReceiptText,
  UserRoundPlus,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/app/Panel";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import { useGym } from "@/lib/gym/store";
import {
  activeMembers,
  gymMembers,
  currentMembership,
  daysUntil,
  liveProducts,
  lowStock,
  metricMeta,
  membershipPayable,
  money,
  planDistribution,
  profitOfSales,
  relative,
  revenueForMetric,
  revenueSeries,
  statusOf,
  outstandingFor,
  saleDue,
  topProducts,
  totalDue,
  totalRevenue,
  type Range,
  type RevenueMetric,
} from "@/lib/gym/selectors";
import type { ActivityType } from "@/lib/gym/types";
import { formatLongDate } from "@/lib/gym/calendar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Track active members, collected revenue, pending dues and expired memberships from one premium offline gym dashboard.",
      },
      { property: "og:title", content: "Dashboard — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content:
          "Track active members, collected revenue, pending dues and expired memberships from one premium offline gym dashboard.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

const ACTIVITY_ICON: Record<ActivityType, typeof UserPlus> = {
  member_added: UserPlus,
  membership_renewed: RefreshCw,
  membership_expired: BadgeX,
  payment_received: IndianRupee,
  product_sold: ShoppingBag,
  product_added: PackagePlus,
  invoice_generated: FileText,
  member_trashed: BadgeX,
  member_restored: RefreshCw,
  member_deleted: BadgeX,
  expense_added: IndianRupee,
  expense_updated: RefreshCw,
  expense_trashed: BadgeX,
};

const RANGES: Range[] = ["daily", "weekly", "monthly", "yearly"];
const RANGE_HINT: Record<Range, string> = {
  daily: "Last 14 days",
  weekly: "Last 12 weeks",
  monthly: "Last 12 months",
  yearly: "Last 5 years",
};

/** Muted premium palette: gold, emerald, sky, slate, soft orange. */
const PLAN_COLORS = [
  "oklch(0.775 0.128 87.5)",
  "oklch(0.68 0.11 160)",
  "oklch(0.68 0.09 235)",
  "oklch(0.6 0.02 250)",
  "oklch(0.72 0.115 55)",
];

function Dashboard() {
  const state = useGym();
  const [range, setRange] = useState<Range>("monthly");

  const data = useMemo(() => {
    if (!state) return null;
    const members = gymMembers(state);
    const statuses = members.map((m) => statusOf(state, m.id));
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const todayKey = new Date().toDateString();
    const isToday = (date: string) => new Date(date).toDateString() === todayKey;
    const expenses = state.expenses.filter((expense) => !expense.deletedAt);
    const collectedRevenue = totalRevenue(state);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const productCost = state.sales.reduce((sum, sale) => sum + sale.unitCost * sale.qty, 0);
    const invoices = new Set([
      ...state.sales.map((sale) => sale.invoiceNo),
      ...state.payments.map((payment) => payment.invoiceNo),
    ]);
    const attentionDues = activeMembers(state)
      .map((person) => ({ person, due: outstandingFor(state, person.id) }))
      .filter((item) => item.due > 0)
      .sort((a, b) => b.due - a.due);
    const expiring = members
      .map((member) => ({ member, membership: currentMembership(state, member.id) }))
      .filter(
        (item) =>
          item.membership &&
          !item.membership.frozen &&
          daysUntil(item.membership.endDate) >= 0 &&
          daysUntil(item.membership.endDate) <= state.settings.expiryReminderDays,
      )
      .sort((a, b) => +new Date(a.membership!.endDate) - +new Date(b.membership!.endDate));
    const balanceAges = [
      ...state.memberships.flatMap((membership) => {
        const due = Math.max(
          0,
          membershipPayable(membership) -
            state.payments
              .filter((payment) => payment.membershipId === membership.id)
              .reduce((sum, payment) => sum + payment.amount, 0),
        );
        return due > 0 ? [{ due, date: membership.endDate }] : [];
      }),
      ...state.sales.flatMap((sale) => {
        const due = saleDue(state, sale);
        return due > 0 ? [{ due, date: sale.date }] : [];
      }),
    ];
    const ageBuckets = [
      { label: "Current / today", min: -Infinity, max: 0, amount: 0 },
      { label: "1–7 days", min: 1, max: 7, amount: 0 },
      { label: "8–30 days", min: 8, max: 30, amount: 0 },
      { label: "30+ days", min: 31, max: Infinity, amount: 0 },
    ];
    balanceAges.forEach((balance) => {
      const age = Math.floor((Date.now() - new Date(balance.date).getTime()) / 86_400_000);
      const bucket = ageBuckets.find((item) => age >= item.min && age <= item.max);
      if (bucket) bucket.amount += balance.due;
    });
    const monthMemberships = state.memberships.filter(
      (membership) => new Date(membership.createdAt) >= monthStart,
    );
    const renewalsThisMonth = monthMemberships.filter((membership) =>
      state.memberships.some(
        (other) =>
          other.memberId === membership.memberId &&
          other.id !== membership.id &&
          new Date(other.createdAt) < new Date(membership.createdAt),
      ),
    ).length;
    const membersWithMemberships = members.filter((member) =>
      state.memberships.some((membership) => membership.memberId === member.id),
    );
    const renewedMembers = membersWithMemberships.filter(
      (member) =>
        state.memberships.filter((membership) => membership.memberId === member.id).length > 1,
    ).length;

    return {
      active: statuses.filter((s) => s === "active" || s === "expiring").length,
      expired: statuses.filter((s) => s === "expired").length,
      frozen: statuses.filter((s) => s === "frozen").length,
      revenue: collectedRevenue,
      cardRevenue: revenueForMetric(
        state,
        (state.settings.revenueCardMetric ?? "today") as RevenueMetric,
      ),
      due: totalDue(state),
      series: revenueSeries(state, range),
      plans: planDistribution(state),
      products: topProducts(state, 5),
      profit: profitOfSales(state),
      totalMembers: members.length,
      expenses: totalExpenses,
      productCost,
      net: collectedRevenue - totalExpenses - productCost,
      invoiceCount: invoices.size,
      productCount: liveProducts(state).length,
      attentionDues,
      expiring,
      lowStock: lowStock(state).slice(0, 4),
      ageBuckets,
      newThisMonth: members.filter((member) => new Date(member.joinDate) >= monthStart).length,
      renewalsThisMonth,
      renewalRate: membersWithMemberships.length
        ? Math.round((renewedMembers / membersWithMemberships.length) * 100)
        : 0,
      today: {
        payments: state.payments
          .filter((payment) => isToday(payment.date))
          .reduce((sum, payment) => sum + payment.amount, 0),
        sales: state.sales
          .filter((sale) => isToday(sale.date))
          .reduce((sum, sale) => sum + sale.qty, 0),
        expenses: expenses
          .filter((expense) => isToday(expense.date))
          .reduce((sum, expense) => sum + expense.amount, 0),
        memberships: state.memberships.filter((membership) => isToday(membership.createdAt)).length,
      },
    };
  }, [state, range]);

  if (!state || !data) return null;
  const cur = state.settings.currency;
  const compactMoney = (value: number) =>
    `${cur}${new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={`${state.settings.gymName} · ${formatLongDate(new Date())}`}
        actions={
          <Button asChild variant="secondary">
            <Link to="/reports">View reports</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Members"
          value={String(data.active)}
          hint={`${data.totalMembers} total on roster`}
          icon={Users}
          tone="gold"
          to="/members"
          search={{ filter: "active", q: "", page: 1 }}
        />
        <StatCard
          label={metricMeta((state.settings.revenueCardMetric ?? "today") as RevenueMetric).label}
          value={money(data.cardRevenue, cur)}
          hint={metricMeta((state.settings.revenueCardMetric ?? "today") as RevenueMetric).hint}
          icon={Wallet}
          tone="success"
          to="/payments"
          search={{ tab: "collected", q: "", page: 1 }}
        />
        <StatCard
          label="Pending Due"
          value={money(data.due, cur)}
          hint="Membership and product balances"
          icon={AlertTriangle}
          tone="warning"
          to="/payments"
          search={{ tab: "pending", q: "", page: 1 }}
        />
        <StatCard
          label="Expired Members"
          value={String(data.expired)}
          hint="Needs renewal follow-up"
          icon={CalendarX}
          tone="danger"
          to="/members"
          search={{ filter: "expired", q: "", page: 1 }}
        />
      </div>

      <Panel title="Quick Actions" description="Common daily tasks" className="mt-6">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/members" search={{ filter: "all", q: "", page: 1, new: true }}>
              <UserRoundPlus className="mr-2 h-4 w-4 text-gold" /> Add Member
            </Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/products" search={{ sale: undefined }}>
              <ShoppingBag className="mr-2 h-4 w-4 text-success" /> Sell Product
            </Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/payments" search={{ tab: "pending", q: "", page: 1 }}>
              <Wallet className="mr-2 h-4 w-4 text-warning" /> Record Payment
            </Link>
          </Button>
          <Button asChild variant="secondary" className="justify-start">
            <Link to="/expenses">
              <ReceiptText className="mr-2 h-4 w-4 text-info" /> Add Expense
            </Link>
          </Button>
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Revenue Chart"
          description={`Membership vs product income · ${RANGE_HINT[range]}`}
          actions={
            <div className="flex min-w-max rounded-lg border border-border bg-secondary/50 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    range === r
                      ? "bg-[image:var(--gradient-gold)] text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        >
          {data.series.some((point) => point.total > 0) ? (
            <div className="h-[250px] w-full sm:h-[290px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ left: -18, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-gold)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="var(--color-gold)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={compactMoney}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [
                      money(v, cur),
                      n === "membership" ? "Membership" : "Products",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="membership"
                    stroke="var(--color-gold)"
                    strokeWidth={2}
                    fill="url(#gGold)"
                  />
                  <Area
                    type="monotone"
                    dataKey="product"
                    stroke="var(--color-success)"
                    strokeWidth={2}
                    fill="url(#gGreen)"
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) =>
                      value === "membership" ? "Membership" : "Products"
                    }
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No revenue data yet" hint="Recorded payments will appear here." />
          )}
        </Panel>

        <Panel title="Membership Statistics" description="Active members by plan">
          {data.plans.length > 0 ? (
            <div>
              <div className="relative h-[190px] w-full sm:h-[210px]">
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="font-display text-3xl leading-none text-foreground">
                    {data.active}
                  </p>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Active
                  </p>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.plans}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="79%"
                      paddingAngle={2.5}
                      cornerRadius={4}
                      minAngle={2}
                      stroke="transparent"
                      strokeWidth={0}
                      isAnimationActive
                      animationDuration={700}
                    >
                      {data.plans.map((_, i) => (
                        <Cell
                          key={i}
                          fill={PLAN_COLORS[i % PLAN_COLORS.length]}
                          style={{ transition: "opacity 200ms ease, filter 200ms ease" }}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      cursor={false}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 text-xs shadow-lg">
                            <p className="font-semibold text-foreground">{payload[0].name}</p>
                            <p className="mt-0.5 text-muted-foreground">
                              Members:{" "}
                              <span className="font-medium text-gold">{payload[0].value}</span>
                            </p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 grid gap-x-4 gap-y-1.5 border-t border-border/70 pt-3 sm:grid-cols-2">
                {data.plans.map((plan, i) => (
                  <div
                    key={plan.name}
                    className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {plan.name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-foreground">
                      {plan.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No active memberships"
              hint="Plan distribution will appear after memberships are added."
            />
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          title="Sales Statistics"
          description="Best performing products by revenue"
          actions={
            <span className="flex items-center gap-1.5 text-xs text-success">
              <TrendingUp className="h-3.5 w-3.5" /> {money(data.profit, cur)} profit
            </span>
          }
        >
          {data.products.length > 0 ? (
            <div className="h-[240px] w-full sm:h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.products} margin={{ left: -18, right: 8, top: 8 }}>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={(v: string) => v.split(" ")[0]}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                    tickFormatter={compactMoney}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-secondary)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => money(v, cur)}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="var(--color-gold)" />
                  <Bar dataKey="profit" radius={[6, 6, 0, 0]} fill="var(--color-chart-3)" />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (value === "revenue" ? "Revenue" : "Profit")}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No product sales yet"
              hint="Completed product sales will appear here."
            />
          )}
        </Panel>

        <Panel
          title="Recent Activities"
          description="Latest events across the club"
          actions={
            <Button asChild variant="ghost" size="sm" className="text-xs text-gold">
              <Link to="/notifications">View all</Link>
            </Button>
          }
        >
          <ul className="space-y-1">
            {state.activities.slice(0, 8).map((a) => {
              const Icon = ACTIVITY_ICON[a.type] ?? FileText;
              return (
                <li
                  key={a.id}
                  className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold/25 bg-gold/10 text-gold">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground/70">
                    {relative(a.date)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Attention Required"
        description="Items that may need action today"
        className="mt-6"
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <AttentionGroup
            title="Outstanding balances"
            icon={AlertTriangle}
            empty="No pending balances"
            items={data.attentionDues.slice(0, 4).map(({ person, due }) => ({
              id: person.id,
              label: person.name,
              value: money(due, cur),
              to: `/members/${person.id}`,
            }))}
          />
          <AttentionGroup
            title="Expiring memberships"
            icon={CalendarClock}
            empty="No memberships expiring soon"
            items={data.expiring.slice(0, 4).map(({ member, membership }) => ({
              id: member.id,
              label: member.name,
              value: membership ? `${Math.max(0, daysUntil(membership.endDate))}d left` : "—",
              to: `/members/${member.id}`,
            }))}
          />
          <AttentionGroup
            title="Low stock"
            icon={Boxes}
            empty="Stock levels look healthy"
            items={data.lowStock.map((product) => ({
              id: product.id,
              label: product.name,
              value: `${product.stock} left`,
              to: "/products",
            }))}
          />
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Panel title="Financial Overview" description="All-time collected performance">
          <div className="space-y-3">
            <SummaryMetric
              label="Collected revenue"
              value={money(data.revenue, cur)}
              tone="success"
            />
            <SummaryMetric label="Expenses" value={money(data.expenses, cur)} tone="warning" />
            <SummaryMetric
              label="Product cost"
              value={money(data.productCost, cur)}
              tone="warning"
            />
            <SummaryMetric
              label="Estimated net profit"
              value={money(data.net, cur)}
              tone={data.net >= 0 ? "gold" : "danger"}
              strong
            />
          </div>
        </Panel>

        <Panel title="Balance Aging" description="Outstanding amount by age">
          <div className="space-y-4">
            {data.ageBuckets.map((bucket) => {
              const max = Math.max(...data.ageBuckets.map((item) => item.amount), 1);
              return (
                <div key={bucket.label}>
                  <div className="mb-1.5 flex justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{bucket.label}</span>
                    <span className="font-medium">{money(bucket.amount, cur)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-warning transition-[width]"
                      style={{
                        width: `${bucket.amount ? Math.max(5, (bucket.amount / max) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Member Lifecycle" description="Current month and roster health">
          <div className="grid grid-cols-2 gap-3">
            <LifecycleMetric label="New this month" value={data.newThisMonth} />
            <LifecycleMetric label="Renewals" value={data.renewalsThisMonth} />
            <LifecycleMetric label="Active" value={data.active} />
            <LifecycleMetric label="Expired" value={data.expired} />
            <LifecycleMetric label="Renewal rate" value={`${data.renewalRate}%`} />
            <LifecycleMetric label="Frozen" value={data.frozen} />
          </div>
        </Panel>
      </div>

      <Panel title="Today’s Summary" description="Activity recorded today" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TodayMetric label="Payments received" value={money(data.today.payments, cur)} />
          <TodayMetric label="Products sold" value={String(data.today.sales)} />
          <TodayMetric label="Expenses recorded" value={money(data.today.expenses, cur)} />
          <TodayMetric label="Memberships started" value={String(data.today.memberships)} />
        </div>
      </Panel>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Frozen memberships", String(data.frozen)],
          ["Products in catalogue", String(data.productCount)],
          ["Invoices generated", String(data.invoiceCount)],
          [
            `Expiring within ${state.settings.expiryReminderDays} days`,
            String(
              gymMembers(state).filter((m) => {
                const ms = currentMembership(state, m.id);
                return ms && statusOf(state, m.id) === "expiring";
              }).length,
            ),
          ],
        ].map(([label, value]) => (
          <div key={label} className="surface-panel rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-2xl">{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function AttentionGroup({
  title,
  icon: Icon,
  empty,
  items,
}: {
  title: string;
  icon: typeof AlertTriangle;
  empty: string;
  items: Array<{ id: string; label: string; value: string; to: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/25 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-gold" /> {title}
      </div>
      {items.length ? (
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to as never}
              className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-secondary"
            >
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{item.label}</span>
              <span className="shrink-0 text-xs font-medium">{item.value}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="px-2 py-4 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "gold" | "danger";
  strong?: boolean;
}) {
  const tones = {
    success: "text-success",
    warning: "text-warning",
    gold: "text-gold",
    danger: "text-destructive",
  };
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/25 px-3 py-3 ${strong ? "border-gold/30" : ""}`}
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-display text-xl ${tones[tone]}`}>{value}</span>
    </div>
  );
}

function LifecycleMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/25 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}

function TodayMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/25 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}
