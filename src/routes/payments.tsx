import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Plus, Search, Printer, Wallet, AlertTriangle, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { StatusBadge } from "@/components/app/StatCard";
import { TablePager } from "@/components/app/TablePager";
import { InvoiceDialog, type InvoiceData } from "@/components/app/InvoiceDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addPayment, useGym } from "@/lib/gym/store";
import {
  activeMembers,
  currentMembership,
  dueFor,
  gymMembers,
  isWalkIn,
  membershipHistory,
  membershipPayable,
  memberOf,
  money,
  outstandingFor,
  paidFor,
  paymentsWithNames,
  planOf,
  salePaid,
  salesFor,
  shortDate,
  totalDue,
  totalRevenue,
} from "@/lib/gym/selectors";
import type { PaymentMethod } from "@/lib/gym/types";

const searchSchema = z.object({
  tab: fallback(z.string(), "collected").default("collected"),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/payments")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Payments — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Record manual payments, track collected revenue and pending dues, and generate printable invoices offline.",
      },
      { property: "og:title", content: "Payments — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Manual payment entry, payment history, pending dues and printable invoices.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <PaymentsPage />
    </AppShell>
  ),
});

const PAGE_SIZE = 10;

function PaymentsPage() {
  const state = useGym();
  const navigate = useNavigate({ from: "/payments" });
  const search = Route.useSearch();
  const [entryOpen, setEntryOpen] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);

  const tab = search.tab === "pending" ? "pending" : "collected";
  const q = search.q.slice(0, 60).toLowerCase();
  const page = Math.max(1, search.page);

  const history = useMemo(
    () =>
      state
        ? paymentsWithNames(state).filter(
            (p) => !q || `${p.who} ${p.invoiceNo} ${p.note}`.toLowerCase().includes(q),
          )
        : [],
    [state, q],
  );

  const pending = useMemo(() => {
    if (!state) return [];
    return activeMembers(state)
      .map((m) => ({
        member: m,
        due: outstandingFor(state, m.id),
        ms: currentMembership(state, m.id),
      }))
      .filter((r) => r.due > 0)
      .filter((r) => !q || r.member.name.toLowerCase().includes(q))
      .sort((a, b) => b.due - a.due);
  }, [state, q]);

  if (!state) return null;
  const cur = state.settings.currency;
  const setSearch = (patch: Record<string, unknown>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) as never });

  const list = tab === "collected" ? history : pending;
  const paged = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Payment Management"
        subtitle="Manual entries only — no gateways, everything stays on this device"
        actions={
          <Button onClick={() => setEntryOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Manual Payment
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={Wallet}
          label="Collected revenue"
          value={money(totalRevenue(state), cur)}
          tone="success"
        />
        <Metric
          icon={AlertTriangle}
          label="Pending due"
          value={money(totalDue(state), cur)}
          tone="warning"
        />
        <Metric
          icon={ReceiptText}
          label="Invoices"
          value={String(state.payments.length)}
          tone="gold"
        />
      </div>

      <Panel>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search invoices or member names"
              value={search.q}
              maxLength={60}
              onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            />
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {(["collected", "pending"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSearch({ tab: t, page: 1 })}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "collected" ? "Payment history" : "Pending payments"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          {paged.length === 0 ? (
            <EmptyState title="Nothing to show" hint="Adjust your search or record a payment." />
          ) : tab === "collected" ? (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Invoice</th>
                  <th className="py-3">Paid by</th>
                  <th className="py-3">Type</th>
                  <th className="py-3">Method</th>
                  <th className="py-3">Date</th>
                  <th className="py-3 text-right">Amount</th>
                  <th className="py-3 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {(paged as typeof history).map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="py-3 font-medium text-gold">{p.invoiceNo}</td>
                    <td className="py-3">{p.who}</td>
                    <td className="py-3 capitalize text-muted-foreground">{p.kind}</td>
                    <td className="py-3 capitalize text-muted-foreground">{p.method}</td>
                    <td className="py-3 text-muted-foreground">{shortDate(p.date)}</td>
                    <td className="py-3 text-right font-medium">{money(p.amount, cur)}</td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Print invoice"
                        onClick={() => {
                          const sale = p.saleId
                            ? state.sales.find((s) => s.id === p.saleId)
                            : undefined;
                          const payer = memberOf(state, p.memberId);
                          const walkIn = Boolean(sale && (!payer || isWalkIn(payer)));
                          const membership = p.membershipId
                            ? state.memberships.find((item) => item.id === p.membershipId)
                            : undefined;
                          const membershipPlan = membership
                            ? state.plans.find((plan) => plan.id === membership.planId)
                            : undefined;
                          setInvoice({
                            invoiceNo: p.invoiceNo,
                            date: p.date,
                            title: sale ? "Sales Invoice" : "Membership Invoice",
                            walkIn,
                            billedTo: p.who,
                            contact: memberOf(state, p.memberId)?.phone ?? sale?.buyerPhone,
                            contactLines: walkIn
                              ? [
                                  payer?.email ?? sale?.buyerEmail ?? "",
                                  payer?.address ?? sale?.buyerAddress ?? "",
                                ]
                              : undefined,
                            lines: sale
                              ? [
                                  {
                                    description: sale.productName,
                                    qty: sale.qty,
                                    rate: sale.unitPrice,
                                  },
                                ]
                              : membership
                                ? [
                                    {
                                      description: `${membershipPlan?.name ?? "Membership"} membership`,
                                      qty: 1,
                                      rate: membership.price,
                                    },
                                  ]
                                : [{ description: p.note || "Payment", qty: 1, rate: p.amount }],
                            discount: sale?.discount ?? membership?.discount ?? 0,
                            joiningFee: membership?.joiningFee ?? 0,
                            paid: membership ? paidFor(state, membership.id) : p.amount,
                            method: p.method,
                          });
                        }}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Member</th>
                  <th className="py-3">Source</th>
                  <th className="py-3">Total</th>
                  <th className="py-3">Paid</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(paged as typeof pending).map(({ member, due, ms }) => {
                  const purchases = salesFor(state, member.id);
                  const productTotal = purchases.reduce((sum, sale) => sum + sale.total, 0);
                  const productPaid = purchases.reduce(
                    (sum, sale) => sum + salePaid(state, sale),
                    0,
                  );
                  const membershipTotal = ms ? membershipPayable(ms) : 0;
                  const membershipPaid = ms ? paidFor(state, ms.id) : 0;
                  const price = membershipTotal + productTotal;
                  const paid = membershipPaid + productPaid;
                  return (
                    <tr key={member.id} className="border-b border-border/50 hover:bg-secondary/40">
                      <td className="py-3">
                        <Link
                          to="/members/$memberId"
                          params={{ memberId: member.id }}
                          search={{ tab: undefined }}
                          className="font-medium hover:text-gold"
                        >
                          {member.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{member.phone}</p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {isWalkIn(member)
                          ? "Product purchases"
                          : (planOf(state, ms?.planId)?.name ?? "—")}
                      </td>
                      <td className="py-3 text-muted-foreground">{money(price, cur)}</td>
                      <td className="py-3 text-success">{money(paid, cur)}</td>
                      <td className="py-3">
                        <StatusBadge status={paid === 0 ? "unpaid" : "partial"} />
                      </td>
                      <td className="py-3 text-right font-medium text-warning">
                        {money(due, cur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <TablePager
          page={page}
          pageSize={PAGE_SIZE}
          total={list.length}
          onPage={(p) => setSearch({ page: p })}
        />
      </Panel>

      <PaymentDialog open={entryOpen} onOpenChange={setEntryOpen} />
      <InvoiceDialog
        invoice={invoice}
        settings={state.settings}
        onOpenChange={() => setInvoice(null)}
      />
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: "gold" | "success" | "warning";
}) {
  const map = {
    gold: "text-gold border-gold/35 bg-gold/10",
    success: "text-success border-success/35 bg-success/10",
    warning: "text-warning border-warning/35 bg-warning/10",
  };
  return (
    <div className="surface-panel flex items-center gap-4 rounded-2xl p-5">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${map[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        <p className="truncate font-display text-2xl">{value}</p>
      </div>
    </div>
  );
}

function PaymentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const state = useGym();
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");

  if (!state) return null;
  const ms = memberId
    ? membershipHistory(state, memberId).find(
        (membership) => membershipPayable(membership) - paidFor(state, membership.id) > 0,
      )
    : undefined;
  const due = ms ? Math.max(0, membershipPayable(ms) - paidFor(state, ms.id)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            Manual Payment Entry
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Member</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {gymMembers(state).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {memberId && (
              <p className="text-xs text-muted-foreground">
                Outstanding balance: {money(due, state.settings.currency)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={1}
                max={due || undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["cash", "upi", "card", "bank", "cheque", "other"] as const).map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Note</Label>
            <Input
              value={note}
              maxLength={120}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Membership payment"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const value = Number(amount);
                if (!memberId) return toast.error("Select a member");
                if (!value || value <= 0 || Number.isNaN(value))
                  return toast.error("Enter a valid amount");
                if (due <= 0) return toast.error("This member has no outstanding balance");
                if (value > due)
                  return toast.error("Payment cannot exceed the outstanding balance");
                const recorded = addPayment({
                  memberId,
                  membershipId: ms?.id ?? null,
                  amount: value,
                  method,
                  note: note.trim() || "Manual payment entry",
                });
                if (!recorded) return toast.error("Payment could not be recorded");
                toast.success("Payment recorded and invoice generated");
                setMemberId("");
                setAmount("");
                setNote("");
                onOpenChange(false);
              }}
            >
              Record payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
