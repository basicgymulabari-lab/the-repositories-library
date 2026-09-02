import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ShoppingCart,
  PackageX,
  Boxes,
  Lock,
  Eye,
  Wallet,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addSalePayment, trashProduct, saveProduct, sellProduct, useGym } from "@/lib/gym/store";
import {
  activeMembers,
  isWalkIn,
  liveProducts,
  lowStock,
  money,
  profitOfSales,
  salePaid,
  saleDue,
  shortDate,
} from "@/lib/gym/selectors";
import { InvoiceDialog, type InvoiceData } from "@/components/app/InvoiceDialog";
import type { GymState, PaymentMethod, Product, ProductCategory, Sale } from "@/lib/gym/types";

/** Builds the invoice view from the already-saved sale record — never regenerates one. */
function saleInvoice(state: GymState, sale: Sale): InvoiceData {
  const member = sale.memberId ? state.members.find((m) => m.id === sale.memberId) : undefined;
  const walkIn = !member || isWalkIn(member);
  const initialPayment = [...state.payments]
    .filter((payment) => payment.saleId === sale.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  return {
    invoiceNo: sale.invoiceNo,
    date: sale.date,
    title: "Sales Invoice",
    walkIn,
    billedTo: member?.name ?? sale.buyer,
    contact: member?.phone ?? sale.buyerPhone,
    contactLines: walkIn
      ? [member?.email ?? sale.buyerEmail ?? "", member?.address ?? sale.buyerAddress ?? ""]
      : undefined,
    lines: [{ description: sale.productName, qty: sale.qty, rate: sale.unitPrice }],
    discount: sale.discount ?? 0,
    paid: salePaid(state, sale),
    method: initialPayment?.method,
  };
}

const CATEGORIES: ProductCategory[] = [
  "Supplements",
  "Apparel",
  "Accessories",
  "Equipment",
  "Beverages",
];

export const Route = createFileRoute("/products")({
  validateSearch: (search: Record<string, unknown>) => ({
    sale: typeof search.sale === "string" ? search.sale : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Products & Sales — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Manage supplements and gym merchandise, track stock levels, record sales and monitor low-stock alerts offline.",
      },
      { property: "og:title", content: "Products & Sales — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Inventory, stock alerts, sales recording and profit tracking for your gym store.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ProductsPage />
    </AppShell>
  ),
});

function ProductsPage() {
  const state = useGym();
  const { sale: saleParam } = Route.useSearch();
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | ProductCategory>("All");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [sellFor, setSellFor] = useState<Product | null>(null);
  const [trashFor, setTrashFor] = useState<Product | null>(null);
  const [lockedFor, setLockedFor] = useState<Product | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [collectFor, setCollectFor] = useState<Sale | null>(null);
  const [detailFor, setDetailFor] = useState<Sale | null>(null);
  const [salesFilter, setSalesFilter] = useState<"all" | "paid" | "partial" | "unpaid">("all");

  // Opening a pending walk-in payment notification lands here with ?sale=<id>.
  useEffect(() => {
    if (!state || !saleParam) return;
    const found = state.sales.find((x) => x.id === saleParam);
    if (found && saleDue(state, found) > 0) setCollectFor(found);
  }, [state, saleParam]);

  const filtered = useMemo(() => {
    if (!state) return [];
    const t = q.trim().toLowerCase().slice(0, 60);
    return liveProducts(state).filter(
      (p) =>
        (categoryFilter === "All" || p.category === categoryFilter) &&
        (!t || `${p.name} ${p.category}`.toLowerCase().includes(t)),
    );
  }, [state, q, categoryFilter]);

  if (!state) return null;
  const cur = state.settings.currency;
  const low = lowStock(state);
  const live = liveProducts(state);
  const availableCategories = CATEGORIES.filter((category) =>
    live.some((product) => product.category === category),
  );
  const stockValue = live.reduce((a, p) => a + p.stock * p.cost, 0);
  const recentSales = [...state.sales]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .filter((sale) => {
      if (salesFilter === "all") return true;
      const paid = salePaid(state, sale);
      const due = saleDue(state, sale);
      if (salesFilter === "paid") return due <= 0;
      if (salesFilter === "partial") return paid > 0 && due > 0;
      return paid <= 0 && due > 0;
    })
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="Products & Sales"
        subtitle="Supplements, merchandise and in-gym store operations"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Products", String(live.length), Boxes],
          ["Stock value", money(stockValue, cur), Boxes],
          ["Low stock", String(low.length), PackageX],
          ["Sales profit", money(profitOfSales(state), cur), ShoppingCart],
        ].map(([label, value, Icon]) => {
          const I = Icon as typeof Boxes;
          return (
            <div
              key={label as string}
              className="surface-panel flex items-center gap-4 rounded-2xl p-5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-gold/35 bg-gold/10 text-gold">
                <I className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  {label as string}
                </p>
                <p className="truncate font-display text-2xl">{value as string}</p>
              </div>
            </div>
          );
        })}
      </div>

      {low.length > 0 && (
        <div className="mb-6 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-medium text-warning">Low stock alert</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {low.map((p) => `${p.name} (${p.stock} left)`).join(" · ")}
          </p>
        </div>
      )}

      <Panel className="mb-6">
        <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search products"
              value={q}
              maxLength={60}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
            {(["All", ...availableCategories] as const).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategoryFilter(category)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  categoryFilter === category
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="No products found" hint="Try a different category or search term." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Product</th>
                  <th className="py-3">Category</th>
                  <th className="py-3">Cost</th>
                  <th className="py-3">Price</th>
                  <th className="py-3">Stock</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40">
                    <td className="py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {p.name}
                        {p.locked && <Lock className="h-3.5 w-3.5 text-gold" aria-label="Locked" />}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{p.category}</td>
                    <td className="py-3 text-muted-foreground">{money(p.cost, cur)}</td>
                    <td className="py-3 text-gold">{money(p.price, cur)}</td>
                    <td className="py-3">
                      <span
                        className={`font-medium ${p.stock <= p.lowStockAt ? "text-warning" : ""}`}
                      >
                        {p.stock}
                      </span>
                    </td>

                    <td className="py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={p.stock < 1}
                          onClick={() => setSellFor(p)}
                        >
                          <ShoppingCart className="mr-1.5 h-3.5 w-3.5" /> Sell
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit product"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Delete product"
                          onClick={() => (p.locked ? setLockedFor(p) : setTrashFor(p))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Recent Sales"
        actions={
          <div className="flex items-center gap-2">
            {(
              [
                ["all", "All"],
                ["paid", "Paid"],
                ["partial", "Partially Paid"],
                ["unpaid", "Unpaid"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSalesFilter(value)}
                className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  salesFilter === value
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {recentSales.length === 0 ? (
          <EmptyState
            title={salesFilter === "all" ? "No sales yet" : "No matching sales"}
            hint={
              salesFilter === "all"
                ? "Sales you record will appear here."
                : "No recent sales match this payment status."
            }
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {recentSales.map((s) => (
              <li
                key={s.id}
                role="button"
                tabIndex={0}
                aria-label={`View sale details for ${s.productName}, purchased by ${s.buyer}`}
                className="-mx-2 flex cursor-pointer items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                onClick={() => setDetailFor(s)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setDetailFor(s);
                  }
                }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {s.qty} ×{" "}
                    {state.products.find((p) => p.id === s.productId)?.name ?? s.productName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.buyer} · {shortDate(s.date)} · {s.invoiceNo}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-right">
                    <p className="font-medium text-gold">{money(s.total, cur)}</p>
                    {saleDue(state, s) > 0 && (
                      <p className="text-xs text-warning">Due {money(saleDue(state, s), cur)}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="View invoice"
                    title="View invoice"
                    onClick={(event) => {
                      event.stopPropagation();
                      setInvoice(saleInvoice(state, s));
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {saleDue(state, s) > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-warning hover:text-warning"
                      aria-label="Collect outstanding balance"
                      title="Collect outstanding balance"
                      onClick={(event) => {
                        event.stopPropagation();
                        setCollectFor(s);
                      }}
                    >
                      <Wallet className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <InvoiceDialog
        invoice={invoice}
        settings={state.settings}
        onOpenChange={() => setInvoice(null)}
      />

      <ProductDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <SellDialog product={sellFor} onClose={() => setSellFor(null)} />
      <SaleDetailsDialog
        sale={detailFor}
        onClose={() => setDetailFor(null)}
        onViewInvoice={(sale) => {
          setDetailFor(null);
          setInvoice(saleInvoice(state, sale));
        }}
        onCollect={(sale) => {
          setDetailFor(null);
          setCollectFor(sale);
        }}
      />
      <CollectSaleBalanceDialog sale={collectFor} onClose={() => setCollectFor(null)} />

      <Dialog open={Boolean(trashFor)} onOpenChange={(v) => !v && setTrashFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">
              Move this product to Trash?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This product will be moved to Trash. You can restore it within the next 30 days before
              it is permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTrashFor(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (trashFor) trashProduct(trashFor.id);
                  toast.success("Product moved to Trash");
                  setTrashFor(null);
                }}
              >
                Move to Trash
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(lockedFor)} onOpenChange={(v) => !v && setLockedFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide text-warning">
              This product is locked
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This product is protected and cannot be moved to Trash while it is locked. Please
              unlock the product first if you want to delete it.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setLockedFor(null)}>OK</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SaleDetailsDialog({
  sale,
  onClose,
  onViewInvoice,
  onCollect,
}: {
  sale: Sale | null;
  onClose: () => void;
  onViewInvoice: (sale: Sale) => void;
  onCollect: (sale: Sale) => void;
}) {
  const state = useGym();
  if (!state || !sale) return null;

  const member = sale.memberId
    ? state.members.find((item) => item.id === sale.memberId)
    : undefined;
  const paid = salePaid(state, sale);
  const due = saleDue(state, sale);
  const discount = sale.discount ?? 0;
  const original = sale.total + discount;
  const status = due <= 0 ? "Paid" : paid > 0 ? "Partially Paid" : "Unpaid";
  const payments = state.payments
    .filter((payment) => payment.saleId === sale.id)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const cur = state.settings.currency;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">Sale details</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {sale.qty} × {sale.productName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sale.invoiceNo} · {shortDate(sale.date)}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  due <= 0
                    ? "border-success/40 bg-success/10 text-success"
                    : paid > 0
                      ? "border-warning/40 bg-warning/10 text-warning"
                      : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="grid gap-4 rounded-xl border border-border p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Purchased by</p>
              <p className="mt-1 font-medium">{member?.name ?? sale.buyer}</p>
              {(member?.phone ?? sale.buyerPhone) && (
                <p className="text-muted-foreground">{member?.phone ?? sale.buyerPhone}</p>
              )}
              {(member?.email ?? sale.buyerEmail) && (
                <p className="break-all text-muted-foreground">
                  {member?.email ?? sale.buyerEmail}
                </p>
              )}
            </div>
            <div className="space-y-1 sm:text-right">
              <p className="flex justify-between gap-4 sm:justify-end">
                <span className="text-muted-foreground">Original</span>
                <span>{money(original, cur)}</span>
              </p>
              <p className="flex justify-between gap-4 sm:justify-end">
                <span className="text-muted-foreground">Discount</span>
                <span>{money(discount, cur)}</span>
              </p>
              <p className="flex justify-between gap-4 font-medium sm:justify-end">
                <span>Final total</span>
                <span>{money(sale.total, cur)}</span>
              </p>
              <p className="flex justify-between gap-4 text-success sm:justify-end">
                <span>Paid</span>
                <span>{money(paid, cur)}</span>
              </p>
              <p className="flex justify-between gap-4 text-warning sm:justify-end">
                <span>Due</span>
                <span>{money(due, cur)}</span>
              </p>
            </div>
          </div>

          {payments.length > 0 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                Payment history
              </p>
              <div className="divide-y divide-border/60 rounded-xl border border-border px-4">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between gap-4 py-2.5 text-sm">
                    <span className="capitalize text-muted-foreground">
                      {shortDate(payment.date)} · {payment.method}
                    </span>
                    <span className="font-medium">{money(payment.amount, cur)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => onViewInvoice(sale)}>
              <Eye className="mr-2 h-4 w-4" /> View invoice
            </Button>
            {due > 0 && (
              <Button onClick={() => onCollect(sale)}>
                <Wallet className="mr-2 h-4 w-4" /> Collect balance
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CollectSaleBalanceDialog({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const state = useGym();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  if (!state || !sale) return null;

  const balance = saleDue(state, sale);
  const value = amount === "" ? balance : Number(amount);
  const valid = Number.isFinite(value) && value > 0 && value <= balance;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            Collect sale balance
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-4 text-sm">
            <p className="font-medium">{sale.buyer}</p>
            <p className="mt-1 text-muted-foreground">
              {sale.invoiceNo} · {sale.productName}
            </p>
            <p className="mt-3 text-warning">
              Outstanding: {money(balance, state.settings.currency)}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              max={balance}
              value={amount}
              placeholder={String(balance)}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onValueChange={(next) => setMethod(next as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["cash", "upi", "card", "bank", "cheque", "other"] as const).map((item) => (
                  <SelectItem key={item} value={item} className="capitalize">
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!valid}
              onClick={() => {
                if (!addSalePayment(sale.id, value, method)) {
                  return toast.error("Payment could not be recorded");
                }
                toast.success(value === balance ? "Sale paid in full" : "Payment recorded");
                setAmount("");
                onClose();
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

function ProductDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
}) {
  const [form, setForm] = useState({
    name: "",
    category: "Supplements" as ProductCategory,
    sku: "",
    cost: "",
    price: "",
    stock: "",
    lowStockAt: "5",
    locked: false,
  });

  useMemo(() => {
    if (open) {
      setForm({
        name: product?.name ?? "",
        category: product?.category ?? "Supplements",
        sku: product?.sku ?? "",
        cost: product ? String(product.cost) : "",
        price: product ? String(product.price) : "",
        stock: product ? String(product.stock) : "",
        lowStockAt: product ? String(product.lowStockAt) : "5",
        locked: Boolean(product?.locked),
      });
    }
  }, [open, product]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {product ? "Edit Product" : "Add Product"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                maxLength={60}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v as ProductCategory }))}
              >
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
              <Label>SKU</Label>
              <Input
                value={form.sku}
                maxLength={24}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Cost price</Label>
              <Input
                type="number"
                min={0}
                value={form.cost}
                onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Selling price</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Stock</Label>
              <Input
                type="number"
                min={0}
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Low stock alert at</Label>
              <Input
                type="number"
                min={0}
                value={form.lowStockAt}
                onChange={(e) => setForm((f) => ({ ...f, lowStockAt: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4">
            <div>
              <Label className="text-sm">Lock this product</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Locked products cannot be moved to Trash.
              </p>
            </div>
            <Switch
              checked={form.locked}
              onCheckedChange={(v) => setForm((f) => ({ ...f, locked: v }))}
              aria-label="Lock this product"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (form.name.trim().length < 2) return toast.error("Enter a product name");
                if (Number(form.price) <= 0) return toast.error("Enter a valid selling price");
                saveProduct({
                  id: product?.id,
                  name: form.name.trim(),
                  category: form.category,
                  sku: form.sku.trim() || form.name.trim().slice(0, 6).toUpperCase(),
                  cost: Number(form.cost) || 0,
                  price: Number(form.price),
                  stock: Number(form.stock) || 0,
                  lowStockAt: Number(form.lowStockAt) || 0,
                  locked: form.locked,
                  deletedAt: product?.deletedAt ?? null,
                });
                toast.success(product ? "Product updated" : "Product added");
                onOpenChange(false);
              }}
            >
              Save product
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SellDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const state = useGym();
  const [qty, setQty] = useState("1");
  const [memberId, setMemberId] = useState("walkin");
  const [discountType, setDiscountType] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [walkEmail, setWalkEmail] = useState("");
  const [walkAddress, setWalkAddress] = useState("");
  const [buyerQuery, setBuyerQuery] = useState("");
  const [paid, setPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card">("cash");

  if (!state || !product) return null;
  const cur = state.settings.currency;
  const n = Number(qty);
  const qtyValid = Number.isInteger(n) && n >= 1 && n <= product.stock;
  const gross = product.price * (qtyValid ? n : 0);
  const rawDiscount =
    discountType === "none"
      ? 0
      : discountType === "percent"
        ? (gross * (Number(discountValue) || 0)) / 100
        : Number(discountValue) || 0;
  const discountAmount = Math.min(Math.max(0, Math.round(rawDiscount)), gross);
  const discountValid =
    discountType === "none" ||
    (discountValue !== "" &&
      Number.isFinite(Number(discountValue)) &&
      Number(discountValue) >= 0 &&
      (discountType === "percent" ? Number(discountValue) <= 100 : Number(discountValue) <= gross));
  const total = gross - discountAmount;
  const paidNum = Number(paid);
  const paidEntered = paid.trim() !== "";
  const paidValid = paidEntered && Number.isFinite(paidNum) && paidNum >= 0 && paidNum <= total;
  const remaining = Math.max(0, total - (paidValid ? paidNum : 0));
  const isWalkIn = memberId === "walkin";
  const walkInValid =
    !isWalkIn || (walkName.trim().length >= 2 && walkPhone.trim().replace(/\D/g, "").length >= 8);
  const walkPhoneDigits = walkPhone.replace(/\D/g, "");
  const normalizedWalkPhone =
    walkPhoneDigits.length > 10 ? walkPhoneDigits.slice(-10) : walkPhoneDigits;
  const existingWalkIn =
    isWalkIn && normalizedWalkPhone.length >= 8
      ? activeMembers(state).find(
          (member) =>
            member.type === "walk_in" &&
            member.phone.replace(/\D/g, "").slice(-10) === normalizedWalkPhone,
        )
      : undefined;

  const reset = () => {
    setQty("1");
    setPaid("");
    setDiscountType("none");
    setDiscountValue("");
    setMemberId("walkin");
    setWalkName("");
    setWalkPhone("");
    setWalkEmail("");
    setWalkAddress("");
    setPaymentMethod("cash");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            Sell {product.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Quantity (in stock: {product.stock})</Label>
            <Input
              type="number"
              min={1}
              max={product.stock}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
            {!qtyValid && (
              <p className="text-xs text-destructive">
                Enter a whole quantity between 1 and {product.stock}.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Discount type</Label>
            <Select
              value={discountType}
              onValueChange={(v) => setDiscountType(v as "none" | "percent" | "fixed")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No discount</SelectItem>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed amount ({cur})</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {discountType !== "none" && (
            <div className="space-y-2">
              <Label>{discountType === "percent" ? "Discount (%)" : `Discount (${cur})`}</Label>
              <Input
                type="number"
                min={0}
                max={discountType === "percent" ? 100 : gross}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder="0"
              />
              {!discountValid && (
                <p className="text-xs text-destructive">Enter a valid discount.</p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label>Buyer</Label>
            <Select
              value={memberId}
              onValueChange={setMemberId}
              onOpenChange={(o) => !o && setBuyerQuery("")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="p-1.5">
                  <Input
                    autoFocus
                    value={buyerQuery}
                    onChange={(e) => setBuyerQuery(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    placeholder="Search members..."
                    className="h-8"
                  />
                </div>
                <SelectItem value="walkin">Walk-in customer</SelectItem>
                {(() => {
                  const q = buyerQuery.trim().toLowerCase();
                  const list = activeMembers(state).filter(
                    (m) => m.type !== "walk_in" && (q ? m.name.toLowerCase().includes(q) : true),
                  );
                  if (list.length === 0)
                    return (
                      <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No members found.
                      </p>
                    );
                  return list.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ));
                })()}
              </SelectContent>
            </Select>
          </div>

          {isWalkIn && (
            <div className="grid gap-4 rounded-xl border border-gold/25 bg-secondary/30 p-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Customer name</Label>
                <Input
                  value={walkName}
                  onChange={(e) => setWalkName(e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile number</Label>
                <Input
                  value={walkPhone}
                  onChange={(e) => setWalkPhone(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input
                  value={walkEmail}
                  onChange={(e) => setWalkEmail(e.target.value)}
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label>Address (optional)</Label>
                <Input
                  value={walkAddress}
                  onChange={(e) => setWalkAddress(e.target.value)}
                  maxLength={200}
                />
              </div>
              {!walkInValid && (
                <p className="text-xs text-destructive sm:col-span-2">
                  Customer name and a valid mobile number are required.
                </p>
              )}
              {existingWalkIn && (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs sm:col-span-2">
                  <p className="font-semibold text-success">Existing customer found</p>
                  <p className="mt-1 text-foreground">{existingWalkIn.name}</p>
                  <p className="text-muted-foreground">{existingWalkIn.phone}</p>
                  <p className="mt-1 text-muted-foreground">
                    This sale will be added to their existing profile.
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1 rounded-lg border border-border bg-background/40 p-3 text-sm">
            <SummaryRow label="Original price" value={money(gross, cur)} />
            <SummaryRow label="Discount" value={`- ${money(discountAmount, cur)}`} />
            <SummaryRow label="Final payable" value={money(total, cur)} />
            <SummaryRow label="Remaining balance" value={money(remaining, cur)} />
          </div>
          <div className="space-y-2">
            <Label>Amount collected now</Label>
            <Input
              type="number"
              min={0}
              max={total}
              step={1}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              placeholder="Enter amount"
            />
            {!paidEntered ? (
              <p className="text-xs text-muted-foreground">
                Enter the amount collected now. Type 0 if no payment was collected.
              </p>
            ) : !paidValid ? (
              <p className="text-xs text-destructive">
                Amount collected cannot exceed the final payable amount ({money(total, cur)}).
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as "cash" | "upi" | "card")}
              disabled={paidValid && paidNum === 0}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!qtyValid || !discountValid || !walkInValid || !paidValid}
              onClick={() => {
                if (!qtyValid) return toast.error("Enter a valid quantity");
                if (!paidValid) return toast.error("Enter the amount collected now");
                const member = isWalkIn
                  ? null
                  : activeMembers(state).find((m) => m.id === memberId);
                sellProduct(
                  product.id,
                  n,
                  member?.name ?? (walkName.trim() || "Walk-in customer"),
                  member?.id ?? null,
                  {
                    discount: discountAmount,
                    amountPaid: paidNum,
                    paymentMethod,
                    buyerPhone: member?.phone ?? (walkPhone.trim() || undefined),
                    buyerEmail: member?.email ?? (walkEmail.trim() || undefined),
                    buyerAddress: member?.address ?? (walkAddress.trim() || undefined),
                  },
                );
                toast.success("Sale recorded");
                reset();
                onClose();
              }}
            >
              Complete sale
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
