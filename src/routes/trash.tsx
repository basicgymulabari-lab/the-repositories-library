import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RotateCcw, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  deleteMemberPermanently,
  deletePlanPermanently,
  deleteProductPermanently,
  deleteExpensePermanently,
  restoreExpense,
  restoreMember,
  restorePlan,
  restoreProduct,
  useGym,
} from "@/lib/gym/store";
import {
  daysUntil,
  money,
  shortDate,
  trashedMembers,
  trashedPlans,
  trashedProducts,
  trashedExpenses,
} from "@/lib/gym/selectors";
import type { Member } from "@/lib/gym/types";

export const Route = createFileRoute("/trash")({
  head: () => ({
    meta: [
      { title: "Trash — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Recover deleted member records within 30 days or permanently erase them with a typed DELETE confirmation.",
      },
      { property: "og:title", content: "Trash — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Safe delete with 30-day recovery and confirmed permanent deletion.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <TrashPage />
    </AppShell>
  ),
});

function TrashPage() {
  const state = useGym();
  const [target, setTarget] = useState<Member | null>(null);

  const items = useMemo(() => (state ? trashedMembers(state) : []), [state]);
  const plans = useMemo(() => (state ? trashedPlans(state) : []), [state]);
  const products = useMemo(() => (state ? trashedProducts(state) : []), [state]);
  const expenses = useMemo(() => (state ? trashedExpenses(state) : []), [state]);
  if (!state) return null;

  return (
    <>
      <PageHeader
        title="Trash"
        subtitle="Deleted members stay recoverable for 30 days before permanent removal"
      />

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <p className="text-sm text-muted-foreground">
          Permanent deletion erases the member profile along with their memberships, payments,
          measurements and notes. This cannot be undone — you must type <strong>DELETE</strong> to
          confirm.
        </p>
      </div>

      <Panel>
        {items.length === 0 ? (
          <EmptyState title="Trash is empty" hint="Deleted members will appear here for 30 days." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Member</th>
                  <th className="py-3">Deleted on</th>
                  <th className="py-3">Deleted by</th>
                  <th className="py-3">Auto-purge in</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const purge = m.deletedAt
                    ? daysUntil(new Date(+new Date(m.deletedAt) + 30 * 24 * 60 * 60 * 1000))
                    : 30;
                  return (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/40">
                      <td className="py-3">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.phone}</p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {m.deletedAt ? shortDate(m.deletedAt) : "—"}
                      </td>
                      <td className="py-3 text-muted-foreground">{m.deletedBy ?? "Admin"}</td>
                      <td className="py-3">
                        <span className={purge <= 5 ? "text-destructive" : "text-muted-foreground"}>
                          {Math.max(0, purge)} days
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              restoreMember(m.id);
                              toast.success(`${m.name} restored`);
                            }}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setTarget(m)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete forever
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Deleted Membership Plans" className="mt-6">
        {plans.length === 0 ? (
          <EmptyState
            title="No deleted plans"
            hint="Plans moved to Trash will appear here for 30 days."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Plan</th>
                  <th className="py-3">Price</th>
                  <th className="py-3">Deleted on</th>
                  <th className="py-3">Auto-purge in</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const purge = p.deletedAt
                    ? daysUntil(new Date(+new Date(p.deletedAt) + 30 * 24 * 60 * 60 * 1000))
                    : 30;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40">
                      <td className="py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.durationDays} days</p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {money(p.price, state.settings.currency)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {p.deletedAt ? shortDate(p.deletedAt) : "—"}
                      </td>
                      <td className="py-3">
                        <span className={purge <= 5 ? "text-destructive" : "text-muted-foreground"}>
                          {Math.max(0, purge)} days
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              restorePlan(p.id);
                              toast.success(`${p.name} restored`);
                            }}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (deletePlanPermanently(p.id)) {
                                toast.success("Plan permanently deleted");
                              } else {
                                toast.error(
                                  "This plan is used by membership history and cannot be deleted permanently",
                                );
                              }
                            }}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete forever
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Deleted Products" className="mt-6">
        {products.length === 0 ? (
          <EmptyState
            title="No deleted products"
            hint="Products moved to Trash will appear here for 30 days."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Product</th>
                  <th className="py-3">Price</th>
                  <th className="py-3">Deleted on</th>
                  <th className="py-3">Auto-purge in</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const purge = p.deletedAt
                    ? daysUntil(new Date(+new Date(p.deletedAt) + 30 * 24 * 60 * 60 * 1000))
                    : 30;
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/40">
                      <td className="py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.category}</p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {money(p.price, state.settings.currency)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {p.deletedAt ? shortDate(p.deletedAt) : "—"}
                      </td>
                      <td className="py-3">
                        <span className={purge <= 5 ? "text-destructive" : "text-muted-foreground"}>
                          {Math.max(0, purge)} days
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              restoreProduct(p.id);
                              toast.success(`${p.name} restored`);
                            }}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              deleteProductPermanently(p.id);
                              toast.success("Product permanently deleted");
                            }}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete forever
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Deleted Expenses" className="mt-6">
        {expenses.length === 0 ? (
          <EmptyState
            title="No deleted expenses"
            hint="Expenses moved to Trash will appear here for 30 days."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Expense</th>
                  <th className="py-3">Amount</th>
                  <th className="py-3">Deleted on</th>
                  <th className="py-3">Auto-purge in</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => {
                  const purge = e.deletedAt
                    ? daysUntil(new Date(+new Date(e.deletedAt) + 30 * 24 * 60 * 60 * 1000))
                    : 30;
                  return (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-secondary/40">
                      <td className="py-3">
                        <p className="font-medium">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {e.expenseNo} · {e.category}
                        </p>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {money(e.amount, state.settings.currency)}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {e.deletedAt ? shortDate(e.deletedAt) : "—"}
                      </td>
                      <td className="py-3">
                        <span className={purge <= 5 ? "text-destructive" : "text-muted-foreground"}>
                          {Math.max(0, purge)} days
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              restoreExpense(e.id);
                              toast.success(`${e.title} restored`);
                            }}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              deleteExpensePermanently(e.id);
                              toast.success("Expense permanently deleted");
                            }}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete forever
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog member={target} onClose={() => setTarget(null)} />
    </>
  );
}

function ConfirmDialog({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const [text, setText] = useState("");
  if (!member) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide text-destructive">
            Permanently delete {member.name}?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            All records linked to this member will be erased from this device. This action is
            irreversible.
          </p>
          <div className="space-y-2">
            <Label>
              Type <span className="font-mono text-destructive">DELETE</span> to confirm
            </Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={text !== "DELETE"}
              onClick={() => {
                deleteMemberPermanently(member.id);
                toast.success("Member permanently deleted");
                setText("");
                onClose();
              }}
            >
              Delete permanently
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
