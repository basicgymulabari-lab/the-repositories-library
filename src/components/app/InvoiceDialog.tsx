import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money, shortDate } from "@/lib/gym/selectors";
import type { Settings } from "@/lib/gym/types";

export type InvoiceStatus = "Paid" | "Partially Paid" | "Pending";

export type InvoiceData = {
  invoiceNo: string;
  date: string;
  billedTo: string;
  contact?: string;
  lines: Array<{ description: string; qty: number; rate: number }>;
  discount?: number;
  /** One-time joining/admission fee included after the membership discount. */
  joiningFee?: number;
  paid: number;
  method?: string;
  /** Document title, e.g. "Membership Invoice", "Sales Invoice", "Expense Receipt". */
  title?: string;
  /** Renders the buyer block as a walk-in customer instead of a member. */
  walkIn?: boolean;
  /** Extra contact lines shown under the buyer name (email, address...). */
  contactLines?: string[];
  /** Override the computed payment status. */
  status?: InvoiceStatus;
};

export function invoiceStatusOf(total: number, paid: number): InvoiceStatus {
  if (paid >= total && total > 0) return "Paid";
  if (paid <= 0) return "Pending";
  return "Partially Paid";
}

/** Prints the invoice node only — same layout for Print and Save-as-PDF (A4). */
function printInvoice() {
  if (typeof document === "undefined") return;
  const node = document.getElementById("invoice-print");
  const dialog = node?.closest<HTMLElement>('[role="dialog"]') ?? null;
  const prevStyle = dialog?.getAttribute("style") ?? null;

  // Radix centres the dialog with fixed positioning + a translate; both must be
  // neutralised inline so the invoice starts at the top of page 1 and can flow
  // onto extra pages when it is long.
  if (dialog) {
    dialog.style.setProperty("position", "static", "important");
    dialog.style.setProperty("inset", "auto", "important");
    dialog.style.setProperty("translate", "none", "important");
    dialog.style.setProperty("transform", "none", "important");
    dialog.style.setProperty("max-height", "none", "important");
    dialog.style.setProperty("overflow", "visible", "important");
  }

  document.body.classList.add("invoice-printing");
  const cleanup = () => {
    document.body.classList.remove("invoice-printing");
    if (dialog) {
      if (prevStyle === null) dialog.removeAttribute("style");
      else dialog.setAttribute("style", prevStyle);
    }
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
  window.setTimeout(cleanup, 1500);
}

/**
 * Single reusable invoice component — used for membership payments, product
 * sales and expense receipts. Only relevant fields are rendered per document.
 */
export function InvoiceDialog({
  invoice,
  settings,
  onOpenChange,
}: {
  invoice: InvoiceData | null;
  settings: Settings;
  onOpenChange: (v: boolean) => void;
}) {
  if (!invoice) return null;
  const gross = invoice.lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const discount = Math.min(Math.max(0, invoice.discount ?? 0), gross);
  const joiningFee = Math.max(0, invoice.joiningFee ?? 0);
  const total = gross - discount + joiningFee;
  const due = Math.max(0, total - invoice.paid);
  const status = invoice.status ?? invoiceStatusOf(total, invoice.paid);
  const statusTone =
    status === "Paid"
      ? "border-success/45 bg-success/10 text-success"
      : status === "Partially Paid"
        ? "border-warning/45 bg-warning/10 text-warning"
        : "border-destructive/45 bg-destructive/10 text-destructive";

  return (
    <Dialog open={Boolean(invoice)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="no-print">
          <DialogTitle className="font-display text-2xl tracking-wide">
            {invoice.title ?? "Invoice"} {invoice.invoiceNo}
          </DialogTitle>
        </DialogHeader>

        <div id="invoice-print" className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div className="min-w-0">
              <p className="font-display text-2xl tracking-[0.16em] text-gradient-gold">
                {settings.gymName}
              </p>
              <p className="text-xs text-muted-foreground">{settings.tagline}</p>
              <p className="mt-2 max-w-xs text-xs text-muted-foreground">{settings.address}</p>
              <p className="text-xs text-muted-foreground">
                {settings.phone} · {settings.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {invoice.title ?? "Invoice"}
              </p>
              <p className="font-display text-xl">{invoice.invoiceNo}</p>
              <p className="text-xs text-muted-foreground">{shortDate(invoice.date)}</p>
              <span
                className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusTone}`}
              >
                {status}
              </span>
            </div>
          </div>

          <div className="py-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {invoice.walkIn ? "Walk-in Customer" : "Billed to"}
            </p>
            <p className="font-semibold">{invoice.billedTo}</p>
            {invoice.contact && <p className="text-xs text-muted-foreground">{invoice.contact}</p>}
            {invoice.contactLines?.filter(Boolean).map((line) => (
              <p key={line} className="text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Qty</th>
                <th className="py-2 text-right">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-2.5">{l.description}</td>
                  <td className="py-2.5 text-center">{l.qty}</td>
                  <td className="py-2.5 text-right">{money(l.rate, settings.currency)}</td>
                  <td className="py-2.5 text-right">{money(l.qty * l.rate, settings.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5 text-sm">
            {discount > 0 && (
              <>
                <Row label="Original amount" value={money(gross, settings.currency)} />
                <Row label="Discount" value={`- ${money(discount, settings.currency)}`} />
              </>
            )}
            {joiningFee > 0 && (
              <Row
                label="Joining / admission fee"
                value={`+ ${money(joiningFee, settings.currency)}`}
              />
            )}
            <Row
              label={discount > 0 || joiningFee > 0 ? "Final amount" : "Total"}
              value={money(total, settings.currency)}
            />
            <Row label="Paid" value={money(invoice.paid, settings.currency)} />
            <div className="flex justify-between border-t border-border pt-2 font-display text-lg">
              <span>Balance due</span>
              <span className="text-gold">{money(due, settings.currency)}</span>
            </div>
            {invoice.method && (
              <p className="pt-1 text-xs text-muted-foreground">Payment method: {invoice.method}</p>
            )}
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Thank you for training with {settings.gymName}. This is a computer generated invoice.
          </p>
        </div>

        <div className="no-print flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="secondary" onClick={printInvoice}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
          <Button onClick={printInvoice}>
            <Printer className="mr-2 h-4 w-4" /> Print invoice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

export function useInvoice() {
  return useState<InvoiceData | null>(null);
}
