import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
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
import {
  Eye,
  FileText,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { TablePager } from "@/components/app/TablePager";
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
import { addExpense, trashExpense, updateExpense, useGym } from "@/lib/gym/store";
import {
  expenseByCategory,
  expenseSeries,
  expenseTotal,
  expensesInRange,
  liveExpenses,
  money,
  revenueInRange,
  shortDate,
  type Range,
} from "@/lib/gym/selectors";
import type { Expense, ExpenseAttachment, ExpenseCategory, PaymentMethod } from "@/lib/gym/types";

export const Route = createFileRoute("/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses & Finance — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Track gym expenses with attachments, category analytics and live net profit against collected revenue — fully offline.",
      },
      { property: "og:title", content: "Expenses & Finance — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Expense entry, receipts, category charts and net profit tracking.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ExpensesPage />
    </AppShell>
  ),
});

const CATEGORIES: ExpenseCategory[] = [
  "Rent",
  "Salaries",
  "Utilities",
  "Equipment",
  "Maintenance",
  "Marketing",
  "Supplies",
  "Other",
];

const METHODS: PaymentMethod[] = ["cash", "upi", "card", "bank", "cheque", "other"];
const RANGES: Range[] = ["daily", "weekly", "monthly", "yearly"];
const RANGE_LABEL: Record<Range, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  yearly: "This year",
};

const CHART_COLORS = [
  "oklch(0.78 0.12 85)",
  "oklch(0.7 0.11 160)",
  "oklch(0.72 0.1 235)",
  "oklch(0.62 0.02 260)",
  "oklch(0.76 0.12 55)",
  "oklch(0.68 0.09 320)",
  "oklch(0.74 0.1 200)",
  "oklch(0.66 0.06 30)",
];

const PAGE_SIZE = 10;
const MAX_ATTACHMENT = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

function ExpensesPage() {
  const state = useGym();
  const [range, setRange] = useState<Range>("monthly");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [confirm, setConfirm] = useState<Expense | null>(null);
  const [preview, setPreview] = useState<Expense | null>(null);

  const scoped = useMemo(() => (state ? expensesInRange(state, range) : []), [state, range]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter((e) =>
      `${e.expenseNo} ${e.title} ${e.category} ${e.notes} ${e.method}`
        .toLowerCase()
        .includes(needle),
    );
  }, [scoped, q]);

  if (!state) return null;
  const cur = state.settings.currency;

  const revenue = revenueInRange(state, range);
  const expenses = expenseTotal(filtered);
  const profit = revenue - expenses;
  const series = expenseSeries(state, range);
  const byCategory = expenseByCategory(state, range);
  const paged = filtered
    .slice()
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Expenses & Finance"
        subtitle="Every card, table and chart below follows the selected date filter"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Expense
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => {
              setRange(r);
              setPage(1);
            }}
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Metric
          icon={Wallet}
          label={`Collected revenue · ${RANGE_LABEL[range]}`}
          value={money(revenue, cur)}
          hint="Membership payments + product sales"
          tone="success"
        />
        <Metric
          icon={TrendingDown}
          label={`Total expenses · ${RANGE_LABEL[range]}`}
          value={money(expenses, cur)}
          hint="Every expense entry in range"
          tone="warning"
        />
        <Metric
          icon={TrendingUp}
          label={`Net profit · ${RANGE_LABEL[range]}`}
          value={money(profit, cur)}
          hint="Revenue − Expenses"
          tone={profit >= 0 ? "gold" : "warning"}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel title={`Expenses — ${range}`}>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
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
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "rgba(212,175,55,0.08)" }}
                  contentStyle={{
                    background: "#111111",
                    border: "1px solid rgba(212,175,55,0.35)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                  formatter={(v: number) => money(v, cur)}
                />
                <Bar dataKey="total" fill="#D4AF37" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Category-wise distribution">
          {byCategory.length === 0 ? (
            <EmptyState title="No expenses in this range" hint="Add an expense to see the split." />
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={92}
                      paddingAngle={5}
                      cornerRadius={6}
                    >
                      {byCategory.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          stroke="transparent"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="rounded-xl border border-gold/60 bg-popover px-3.5 py-2.5 text-xs shadow-lg">
                            <p className="font-semibold text-gold">{payload[0].name}</p>
                            <p className="mt-0.5 font-medium text-gold/90">
                              {money(Number(payload[0].value), cur)}
                            </p>
                          </div>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {byCategory.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      {d.name}
                    </span>
                    <span className="font-medium">{money(d.value, cur)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <Panel>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search ID, title, category, notes or method"
            value={q}
            maxLength={60}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="mt-5 overflow-x-auto">
          {paged.length === 0 ? (
            <EmptyState
              title="No expenses found"
              hint="Adjust the filter or record a new expense."
            />
          ) : (
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Expense ID</th>
                  <th className="py-3">Title</th>
                  <th className="py-3">Category</th>
                  <th className="py-3">Method</th>
                  <th className="py-3">Date</th>
                  <th className="py-3">Attachment</th>
                  <th className="py-3 text-right">Amount</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((e) => (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="py-3 font-medium text-gold">{e.expenseNo}</td>
                    <td className="py-3">
                      <p className="font-medium">{e.title}</p>
                      {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                    </td>
                    <td className="py-3 text-muted-foreground">{e.category}</td>
                    <td className="py-3 capitalize text-muted-foreground">{e.method}</td>
                    <td className="py-3 text-muted-foreground">{shortDate(e.date)}</td>
                    <td className="py-3">
                      {e.attachment ? (
                        <button
                          onClick={() => setPreview(e)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
                        >
                          <Paperclip className="h-3.5 w-3.5" /> View Attachment
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-medium">{money(e.amount, cur)}</td>
                    <td className="py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit expense"
                          onClick={() => {
                            setEditing(e);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Delete expense"
                          onClick={() => setConfirm(e)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <TablePager page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
      </Panel>

      <ExpenseFormDialog
        open={formOpen}
        expense={editing}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditing(null);
        }}
      />

      <Dialog open={Boolean(confirm)} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">
              Move this expense to Trash?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{confirm?.title}</strong> will be moved to Trash and stays recoverable for 30
            days. It is never permanently deleted from here.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (confirm) {
                  trashExpense(confirm.id);
                  toast.success("Expense moved to Trash");
                }
                setConfirm(null);
              }}
            >
              Move to Trash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AttachmentPreview expense={preview} onClose={() => setPreview(null)} />
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
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
        <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function AttachmentPreview({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  if (!expense?.attachment) return null;
  const att = expense.attachment;
  const isPdf = att.type === "application/pdf";
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {expense.title} — Attachment
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-xl border border-border bg-card p-3">
          {isPdf ? (
            <iframe title={att.name} src={att.dataUrl} className="h-[70vh] w-full rounded-lg" />
          ) : (
            <img src={att.dataUrl} alt={att.name} className="mx-auto max-h-[70vh] rounded-lg" />
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {att.name} · {(att.size / 1024).toFixed(0)} KB
          </p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ExpenseFormDialog({
  open,
  expense,
  onOpenChange,
}: {
  open: boolean;
  expense: Expense | null;
  onOpenChange: (v: boolean) => void;
}) {
  const key = expense?.id ?? "new";
  const [title, setTitle] = useState(expense?.title ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? "Rent");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [date, setDate] = useState(expense ? expense.date.slice(0, 10) : todayInput());
  const [method, setMethod] = useState<PaymentMethod>(expense?.method ?? "cash");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [attachment, setAttachment] = useState<ExpenseAttachment | null>(
    expense?.attachment ?? null,
  );
  const [loadedKey, setLoadedKey] = useState(key);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loadedKey !== key) {
    setLoadedKey(key);
    setTitle(expense?.title ?? "");
    setCategory(expense?.category ?? "Rent");
    setAmount(expense ? String(expense.amount) : "");
    setDate(expense ? expense.date.slice(0, 10) : todayInput());
    setMethod(expense?.method ?? "cash");
    setNotes(expense?.notes ?? "");
    setAttachment(expense?.attachment ?? null);
  }

  const amountValue = Number(amount);
  const futureDate = date > todayInput();
  const errors = {
    title: title.trim().length === 0 ? "Expense title is required" : "",
    amount:
      !amount || Number.isNaN(amountValue) || amountValue <= 0
        ? "Amount must be greater than ₹0"
        : "",
    date: futureDate ? "Future dates are not allowed" : "",
  };
  const valid = !errors.title && !errors.amount && !errors.date;

  const pickFile = (file?: File | null) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Only PDF, JPG and PNG files are allowed");
      return;
    }
    if (file.size > MAX_ATTACHMENT) {
      toast.error("Attachment must be 5 MB or smaller");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setAttachment({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result),
      });
    reader.readAsDataURL(file);
  };

  const submit = () => {
    if (!valid) {
      toast.error(errors.title || errors.amount || errors.date);
      return;
    }
    const payload = {
      title,
      category,
      amount: amountValue,
      date: new Date(`${date}T12:00:00`).toISOString(),
      method,
      notes,
      attachment,
    };
    if (expense) {
      updateExpense(expense.id, payload);
      toast.success("Expense updated");
    } else {
      addExpense(payload);
      toast.success("Expense recorded");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {expense ? "Edit Expense" : "Add Expense"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Expense title</Label>
            <Input
              value={title}
              maxLength={80}
              placeholder="Electricity bill"
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="capitalize">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                max={todayInput()}
                onChange={(e) => setDate(e.target.value)}
              />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              maxLength={160}
              placeholder="Optional note"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Attachment (PDF, JPG, PNG · max 5 MB)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Choose file
              </Button>
              {attachment && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> {attachment.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setAttachment(null)}
                  >
                    Remove
                  </Button>
                </>
              )}
            </div>
            {attachment && (
              <div className="rounded-xl border border-border bg-card p-3">
                {attachment.type === "application/pdf" ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" /> PDF attached — preview available from the table
                  </p>
                ) : (
                  <img
                    src={attachment.dataUrl}
                    alt={attachment.name}
                    className="mx-auto max-h-40 rounded-lg"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!valid} onClick={submit}>
              {expense ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
