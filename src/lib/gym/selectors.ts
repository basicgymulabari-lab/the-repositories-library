import type { GymState, Member, MemberStatus, Membership, Payment, Product, Sale } from "./types";
import { formatCompactDate, formatDayMonth, formatMonth, formatShortDate } from "./calendar";

export const DAY = 24 * 60 * 60 * 1000;

export const money = (n: number, currency = "₹") =>
  `${currency}${Math.round(n).toLocaleString("en-IN")}`;

export const shortDate = formatShortDate;

/** Compact date: 03 Aug 26 */
export const compactDate = formatCompactDate;

export const dateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export const relative = (d: string | Date) => {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(d);
};

export const daysUntil = (d: string | Date) =>
  Math.ceil((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);

export const activeMembers = (s: GymState) => s.members.filter((m) => !m.deletedAt);
export const trashedMembers = (s: GymState) => s.members.filter((m) => m.deletedAt);
export const isWalkIn = (member: Member) => member.type === "walk_in";
export const gymMembers = (s: GymState) => activeMembers(s).filter((m) => !isWalkIn(m));

export const livePlans = (s: GymState) => s.plans.filter((p) => !p.deletedAt);
export const trashedPlans = (s: GymState) => s.plans.filter((p) => p.deletedAt);

export function currentMembership(s: GymState, memberId: string): Membership | undefined {
  return s.memberships
    .filter((m) => m.memberId === memberId)
    .sort((a, b) => +new Date(b.endDate) - +new Date(a.endDate))[0];
}

export function membershipHistory(s: GymState, memberId: string) {
  return s.memberships
    .filter((m) => m.memberId === memberId)
    .sort((a, b) => +new Date(b.startDate) - +new Date(a.startDate));
}

export function statusOf(s: GymState, memberId: string): MemberStatus {
  const ms = currentMembership(s, memberId);
  if (!ms) return "expired";
  if (ms.frozen) return "frozen";
  const left = daysUntil(ms.endDate);
  if (left < 0) return "expired";
  if (left <= s.settings.expiryReminderDays) return "expiring";
  return "active";
}

export function paidFor(s: GymState, membershipId: string) {
  return s.payments
    .filter((p) => p.membershipId === membershipId)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function membershipPayable(membership: Membership) {
  return membership.price - membership.discount + (membership.joiningFee ?? 0);
}

export function dueFor(s: GymState, memberId: string) {
  return s.memberships
    .filter((m) => m.memberId === memberId)
    .reduce((sum, m) => sum + Math.max(0, membershipPayable(m) - paidFor(s, m.id)), 0);
}

export function productDueFor(s: GymState, memberId: string) {
  return salesFor(s, memberId).reduce((sum, sale) => sum + saleDue(s, sale), 0);
}

export function outstandingFor(s: GymState, memberId: string) {
  return dueFor(s, memberId) + productDueFor(s, memberId);
}

export function totalDue(s: GymState) {
  return activeMembers(s).reduce((sum, m) => sum + outstandingFor(s, m.id), 0);
}

export function totalRevenue(s: GymState, from?: Date) {
  return s.payments
    .filter((p) => (from ? new Date(p.date) >= from : true))
    .reduce((sum, p) => sum + p.amount, 0);
}

export const liveProducts = (s: GymState) => s.products.filter((p) => !p.deletedAt);
export const trashedProducts = (s: GymState) => s.products.filter((p) => p.deletedAt);

export function lowStock(s: GymState): Product[] {
  return liveProducts(s).filter((p) => p.stock <= p.lowStockAt);
}

/** Amount collected against a product sale. Legacy sales were always fully paid. */
export function salePaid(s: GymState, sale: Sale) {
  if (typeof sale.paid !== "number") return sale.total;
  return s.payments.filter((p) => p.saleId === sale.id).reduce((sum, p) => sum + p.amount, 0);
}

export function saleDue(s: GymState, sale: Sale) {
  return Math.max(0, sale.total - salePaid(s, sale));
}

export const salesFor = (s: GymState, memberId: string) =>
  s.sales.filter((x) => x.memberId === memberId);

export const pendingSales = (s: GymState) => s.sales.filter((x) => saleDue(s, x) > 0);

export function profitOfSales(s: GymState, from?: Date) {
  return s.sales
    .filter((x) => (from ? new Date(x.date) >= from : true))
    .reduce((sum, x) => sum + x.total - x.unitCost * x.qty, 0);
}

export type Range = "daily" | "weekly" | "monthly" | "yearly";

export function revenueSeries(s: GymState, range: Range) {
  const now = new Date();
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];

  const mk = (label: string, start: Date, end: Date) => buckets.push({ label, start, end });

  if (range === "daily") {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const e = new Date(d);
      e.setHours(23, 59, 59, 999);
      mk(formatDayMonth(d), d, e);
    }
  } else if (range === "weekly") {
    for (let i = 11; i >= 0; i--) {
      const e = new Date(now);
      e.setDate(e.getDate() - i * 7);
      e.setHours(23, 59, 59, 999);
      const d = new Date(e);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      mk(`W${12 - i}`, d, e);
    }
  } else if (range === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      mk(formatMonth(d), d, e);
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      mk(String(y), new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
    }
  }

  return buckets.map((b) => {
    const inRange = (date: string) => {
      const t = new Date(date).getTime();
      return t >= b.start.getTime() && t <= b.end.getTime();
    };
    const membership = s.payments
      .filter((p) => p.kind === "membership" && inRange(p.date))
      .reduce((sum, p) => sum + p.amount, 0);
    const product = s.payments
      .filter((p) => p.kind === "product" && inRange(p.date))
      .reduce((sum, p) => sum + p.amount, 0);
    return { label: b.label, membership, product, total: membership + product };
  });
}

export function planDistribution(s: GymState) {
  return livePlans(s)
    .map((plan) => ({
      name: plan.name,
      value: gymMembers(s).filter((m) => currentMembership(s, m.id)?.planId === plan.id).length,
    }))
    .filter((p) => p.value > 0);
}

export function topProducts(s: GymState, limit = 5) {
  const map = new Map<string, { name: string; units: number; revenue: number; profit: number }>();
  s.sales.forEach((sale) => {
    const entry = map.get(sale.productId) ?? {
      name: sale.productName,
      units: 0,
      revenue: 0,
      profit: 0,
    };
    entry.units += sale.qty;
    entry.revenue += sale.total;
    entry.profit += sale.total - sale.unitCost * sale.qty;
    map.set(sale.productId, entry);
  });
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function memberOf(s: GymState, id?: string | null): Member | undefined {
  return s.members.find((m) => m.id === id);
}

export function planOf(s: GymState, id?: string | null) {
  return s.plans.find((p) => p.id === id);
}

export function paymentsWithNames(s: GymState): Array<Payment & { who: string }> {
  return s.payments
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map((p) => ({
      ...p,
      who:
        memberOf(s, p.memberId)?.name ??
        s.sales.find((x) => x.id === p.saleId)?.buyer ??
        "Walk-in customer",
    }));
}

/* ---------------- Notifications ---------------- */

export type NotificationCategory = "due" | "expiry" | "birthday" | "inventory" | "system";

export type Notification = {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  date: string;
  tone: "danger" | "warning" | "success" | "info";
  href?: string;
  /** Optional search params applied when the notification is clicked. */
  search?: Record<string, string>;
};

const birthdayOffset = (dob: string) => {
  const d = new Date(dob);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  const diff = Math.round((next.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
  return diff;
};

export function buildNotifications(s: GymState): Notification[] {
  const list: Notification[] = [];

  activeMembers(s).forEach((m) => {
    const due = dueFor(s, m.id);
    if (due > 0) {
      const ms = currentMembership(s, m.id);
      const overdueDays = ms ? Math.max(0, -daysUntil(ms.endDate)) : 0;
      list.push({
        id: `due_${m.id}`,
        category: "due",
        title: m.name,
        description:
          overdueDays > 0
            ? `Payment overdue (${overdueDays} days) — ${money(due, s.settings.currency)}`
            : `Pending payment — ${money(due, s.settings.currency)}`,
        date: ms?.endDate ?? m.joinDate,
        tone: overdueDays > 0 ? "danger" : "warning",
        href: `/members/${m.id}`,
        search: { tab: "payments" },
      });
    }

    const saleDues = salesFor(s, m.id).filter((x) => saleDue(s, x) > 0);
    if (saleDues.length > 0) {
      const amount = saleDues.reduce((sum, x) => sum + saleDue(s, x), 0);
      list.push({
        id: `sdue_${m.id}`,
        category: "due",
        title: m.name,
        description: `Pending product payment — ${money(amount, s.settings.currency)}`,
        date: saleDues[0]!.date,
        tone: "warning",
        href: `/members/${m.id}`,
        search: { tab: "purchases" },
      });
    }

    const ms = currentMembership(s, m.id);
    if (ms && !ms.frozen) {
      const left = daysUntil(ms.endDate);
      if (left <= s.settings.expiryReminderDays && left >= -30) {
        list.push({
          id: `exp_${m.id}`,
          category: "expiry",
          title: m.name,
          description:
            left < 0
              ? `Membership expired ${Math.abs(left)} day(s) ago`
              : left === 0
                ? "Membership expires today"
                : left === 1
                  ? "Membership expires tomorrow"
                  : `Membership expires in ${left} days`,
          date: ms.endDate,
          tone: left < 0 ? "danger" : "warning",
          href: `/members/${m.id}`,
          search: { tab: "history" },
        });
      }
    }

    const bday = m.dob ? birthdayOffset(m.dob) : -1;
    if (bday === 0 || bday === 1) {
      list.push({
        id: `bday_${m.id}`,
        category: "birthday",
        title: m.name,
        description: bday === 0 ? "Birthday today" : "Birthday tomorrow",
        date: new Date().toISOString(),
        tone: "success",
        href: `/members/${m.id}`,
      });
    }
  });

  // Walk-in customers have no profile — link straight to the sale invoice.
  pendingSales(s)
    .filter((x) => !x.memberId)
    .forEach((x) => {
      list.push({
        id: `sdue_${x.id}`,
        category: "due",
        title: x.buyer,
        description: `Pending product payment — ${money(saleDue(s, x), s.settings.currency)} · ${x.invoiceNo}`,
        date: x.date,
        tone: "warning",
        href: "/products",
        search: { sale: x.id },
      });
    });

  if (s.settings.lowStockAlerts) {
    lowStock(s).forEach((p) => {
      list.push({
        id: `stock_${p.id}`,
        category: "inventory",
        title: p.name,
        description:
          p.stock === 0
            ? "Out of stock — restock immediately"
            : `Only ${p.stock} left in stock (alert at ${p.lowStockAt})`,
        date: new Date().toISOString(),
        tone: p.stock === 0 ? "danger" : "warning",
        href: "/products",
      });
    });
  }

  s.activities.slice(0, 8).forEach((a) => {
    list.push({
      id: `act_${a.id}`,
      category: "system",
      title: a.title,
      description: a.description,
      date: a.date,
      tone: "info",
    });
  });

  const isTodayBirthday = (n: Notification) =>
    n.category === "birthday" && n.description === "Birthday today";

  return list.sort((a, b) => {
    const pa = isTodayBirthday(a) ? 1 : 0;
    const pb = isTodayBirthday(b) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return +new Date(b.date) - +new Date(a.date);
  });
}

/* ------------------------------------------------------------------ */
/* Revenue card metric                                                 */
/* ------------------------------------------------------------------ */

export type RevenueMetric = "today" | "weekly" | "monthly" | "yearly" | "total";

export const REVENUE_METRICS: Array<{ key: RevenueMetric; label: string; hint: string }> = [
  { key: "today", label: "Today's Revenue", hint: "Today's earnings" },
  { key: "weekly", label: "Weekly Revenue", hint: "This week's earnings" },
  { key: "monthly", label: "Monthly Revenue", hint: "This month's earnings" },
  { key: "yearly", label: "Yearly Revenue", hint: "This year's earnings" },
  { key: "total", label: "Total Revenue", hint: "Lifetime earnings" },
];

export function metricStart(metric: RevenueMetric): Date | undefined {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  switch (metric) {
    case "today":
      return d;
    case "weekly": {
      const day = (d.getDay() + 6) % 7; // Monday start
      d.setDate(d.getDate() - day);
      return d;
    }
    case "monthly":
      d.setDate(1);
      return d;
    case "yearly":
      d.setMonth(0, 1);
      return d;
    default:
      return undefined;
  }
}

export function revenueForMetric(s: GymState, metric: RevenueMetric) {
  return totalRevenue(s, metricStart(metric));
}

export const rangeToMetric = (r: Range): RevenueMetric =>
  r === "daily" ? "today" : r === "weekly" ? "weekly" : r === "monthly" ? "monthly" : "yearly";

export const metricMeta = (metric: RevenueMetric) =>
  REVENUE_METRICS.find((m) => m.key === metric) ?? REVENUE_METRICS[0];

/* ---------------- Expenses & finance ---------------- */

export const liveExpenses = (s: GymState) => (s.expenses ?? []).filter((e) => !e.deletedAt);
export const trashedExpenses = (s: GymState) => (s.expenses ?? []).filter((e) => e.deletedAt);

export function rangeWindow(range: Range): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "weekly") {
    const daysSinceMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - daysSinceMonday);
  }
  if (range === "monthly") start.setDate(1);
  if (range === "yearly") start.setMonth(0, 1);
  return { start, end };
}

export const inWindow = (date: string, w: { start: Date; end: Date }) => {
  const t = new Date(date).getTime();
  return t >= w.start.getTime() && t <= w.end.getTime();
};

export function expensesInRange(s: GymState, range: Range) {
  const w = rangeWindow(range);
  return liveExpenses(s).filter((e) => inWindow(e.date, w));
}

export function revenueInRange(s: GymState, range: Range) {
  const w = rangeWindow(range);
  return s.payments.filter((p) => inWindow(p.date, w)).reduce((sum, p) => sum + p.amount, 0);
}

export function expenseTotal(list: Array<{ amount: number }>) {
  return list.reduce((sum, e) => sum + e.amount, 0);
}

export function expenseSeries(s: GymState, range: Range) {
  const now = new Date();
  const buckets: Array<{ label: string; start: Date; end: Date }> = [];
  const mk = (label: string, start: Date, end: Date) => buckets.push({ label, start, end });

  if (range === "daily") {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const e = new Date(d);
      e.setHours(23, 59, 59, 999);
      mk(formatDayMonth(d), d, e);
    }
  } else if (range === "weekly") {
    for (let i = 11; i >= 0; i--) {
      const e = new Date(now);
      e.setDate(e.getDate() - i * 7);
      e.setHours(23, 59, 59, 999);
      const d = new Date(e);
      d.setDate(d.getDate() - 6);
      d.setHours(0, 0, 0, 0);
      mk(`W${12 - i}`, d, e);
    }
  } else if (range === "monthly") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      mk(formatMonth(d), d, e);
    }
  } else {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      mk(String(y), new Date(y, 0, 1), new Date(y, 11, 31, 23, 59, 59));
    }
  }

  const list = liveExpenses(s);
  return buckets.map((b) => ({
    label: b.label,
    total: list.filter((e) => inWindow(e.date, b)).reduce((sum, e) => sum + e.amount, 0),
  }));
}

export function expenseByCategory(s: GymState, range: Range) {
  const map = new Map<string, number>();
  expensesInRange(s, range).forEach((e) => {
    map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}
