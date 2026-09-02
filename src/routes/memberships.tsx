import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, RefreshCw, Snowflake, Trash2, BellRing, Pencil, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { StatusBadge } from "@/components/app/StatCard";
import { RenewDialog } from "./members.$memberId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { trashPlan, savePlan, toggleFreeze, useGym } from "@/lib/gym/store";
import {
  activeMembers,
  currentMembership,
  livePlans,
  daysUntil,
  membershipHistory,
  money,
  planOf,
  shortDate,
  statusOf,
} from "@/lib/gym/selectors";
import type { Plan } from "@/lib/gym/types";

export const Route = createFileRoute("/memberships")({
  head: () => ({
    meta: [
      { title: "Memberships — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Create membership plans, renew or freeze memberships, follow up on expiries and review renewal history.",
      },
      { property: "og:title", content: "Memberships — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Plans, renewals, freezes, expiry reminders and full membership history.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <MembershipsPage />
    </AppShell>
  ),
});

function MembershipsPage() {
  const state = useGym();
  const [planOpen, setPlanOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [renewFor, setRenewFor] = useState<string | null>(null);
  const [trashPlanTarget, setTrashPlanTarget] = useState<Plan | null>(null);
  const [lockedPlan, setLockedPlan] = useState<Plan | null>(null);

  const rows = useMemo(() => {
    if (!state) return [];
    return activeMembers(state)
      .map((m) => ({
        member: m,
        ms: currentMembership(state, m.id),
        status: statusOf(state, m.id),
      }))
      .filter((r) => r.ms)
      .sort((a, b) => +new Date(a.ms!.endDate) - +new Date(b.ms!.endDate));
  }, [state]);

  if (!state) return null;
  const cur = state.settings.currency;
  const expiring = rows.filter((r) => r.status === "expiring");
  const expired = rows.filter((r) => r.status === "expired");
  const frozen = rows.filter((r) => r.status === "frozen");

  return (
    <>
      <PageHeader
        title="Membership Management"
        subtitle="Plans, renewals, freezes and expiry follow-ups"
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setPlanOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Create Plan
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Active plans", String(livePlans(state).filter((p) => p.active).length)],
          ["Expiring soon", String(expiring.length)],
          ["Expired", String(expired.length)],
          ["Frozen", String(frozen.length)],
        ].map(([label, value]) => (
          <div key={label} className="surface-panel rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl text-gold">{value}</p>
          </div>
        ))}
      </div>

      <Panel title="Membership Plans" className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {livePlans(state).map((p) => (
            <div
              key={p.id}
              className="group relative rounded-2xl border border-border bg-secondary/30 p-5 transition-all hover:border-gold/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-display text-xl tracking-wide">
                    {p.name}
                    {p.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-gold" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.durationDays} days</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Edit plan"
                    onClick={() => {
                      setEditing(p);
                      setPlanOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label="Delete plan"
                    onClick={() => (p.locked ? setLockedPlan(p) : setTrashPlanTarget(p))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mt-3 font-display text-3xl text-gradient-gold">{money(p.price, cur)}</p>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {
                  activeMembers(state).filter(
                    (m) => currentMembership(state, m.id)?.planId === p.id,
                  ).length
                }{" "}
                members enrolled
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Tabs defaultValue="all">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="all">All memberships</TabsTrigger>
          <TabsTrigger value="expiring">Renewal reminders ({expiring.length})</TabsTrigger>
          <TabsTrigger value="expired">Expired ({expired.length})</TabsTrigger>
          <TabsTrigger value="frozen">Frozen ({frozen.length})</TabsTrigger>
        </TabsList>

        {(
          [
            ["all", rows],
            ["expiring", expiring],
            ["expired", expired],
            ["frozen", frozen],
          ] as const
        ).map(([key, list]) => (
          <TabsContent key={key} value={key}>
            <Panel>
              {list.length === 0 ? (
                <EmptyState title="Nothing here" hint="This list is currently empty." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                        <th className="py-3">Member</th>
                        <th className="py-3">Plan</th>
                        <th className="py-3">Period</th>
                        <th className="py-3">Remaining</th>
                        <th className="py-3">Status</th>
                        <th className="py-3">Terms</th>
                        <th className="py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(({ member, ms, status }) => {
                        const left = daysUntil(ms!.endDate);
                        return (
                          <tr
                            key={member.id}
                            className="border-b border-border/50 hover:bg-secondary/40"
                          >
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
                              {planOf(state, ms!.planId)?.name}
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {shortDate(ms!.startDate)} → {shortDate(ms!.endDate)}
                            </td>
                            <td className="py-3">
                              <span
                                className={
                                  left < 0 ? "text-destructive" : left <= 7 ? "text-warning" : ""
                                }
                              >
                                {left < 0 ? `${Math.abs(left)}d overdue` : `${left}d left`}
                              </span>
                            </td>
                            <td className="py-3">
                              <StatusBadge status={status} />
                            </td>
                            <td className="py-3 text-muted-foreground">
                              {membershipHistory(state, member.id).length}
                            </td>
                            <td className="py-3">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Freeze membership"
                                  onClick={() => {
                                    toggleFreeze(ms!.id);
                                    toast.success(
                                      ms!.frozen ? "Membership unfrozen" : "Membership frozen",
                                    );
                                  }}
                                >
                                  <Snowflake className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-gold"
                                  aria-label="Send reminder"
                                  onClick={() =>
                                    toast.success(`Renewal reminder logged for ${member.name}`)
                                  }
                                >
                                  <BellRing className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => setRenewFor(member.id)}
                                >
                                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Renew
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
          </TabsContent>
        ))}
      </Tabs>

      {renewFor && (
        <RenewDialog open onOpenChange={(v) => !v && setRenewFor(null)} memberId={renewFor} />
      )}
      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} plan={editing} />

      <Dialog open={!!trashPlanTarget} onOpenChange={(v) => !v && setTrashPlanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">
              Move this membership plan to Trash?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This membership plan will be moved to Trash. You can restore it within 30 days before
              it is permanently deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTrashPlanTarget(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  trashPlan(trashPlanTarget!.id);
                  toast.success("Plan moved to Trash");
                  setTrashPlanTarget(null);
                }}
              >
                Move to Trash
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lockedPlan} onOpenChange={(v) => !v && setLockedPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">
              This membership plan is locked
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This membership plan is protected and cannot be deleted while it is locked. Please
              unlock the plan first if you want to move it to Trash.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => setLockedPlan(null)}>OK</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: Plan | null;
}) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    durationDays: "",
    description: "",
    locked: false,
  });
  const [touched, setTouched] = useState(false);

  useMemo(() => {
    if (open) {
      setForm({
        name: plan?.name ?? "",
        price: plan ? String(plan.price) : "",
        durationDays: plan ? String(plan.durationDays) : "",
        description: plan?.description ?? "",
        locked: plan?.locked ?? false,
      });
      setTouched(false);
    }
  }, [open, plan]);

  const invalid =
    form.name.trim().length < 2 || Number(form.price) <= 0 || Number(form.durationDays) <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl tracking-wide">
            {plan ? "Edit Plan" : "Create Membership Plan"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan name</Label>
            <Input
              value={form.name}
              maxLength={60}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                min={1}
                value={form.durationDays}
                onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={3}
              maxLength={220}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-3">
            <div>
              <Label>Lock this membership plan</Label>
              <p className="text-xs text-muted-foreground">
                Locked plans cannot be moved to Trash.
              </p>
            </div>
            <Switch
              checked={form.locked}
              onCheckedChange={(v) => setForm((f) => ({ ...f, locked: v }))}
            />
          </div>
          {touched && invalid && (
            <p className="text-xs text-destructive">
              Provide a name, a price above 0 and a duration of at least 1 day.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setTouched(true);
                if (invalid) return;
                savePlan({
                  id: plan?.id,
                  name: form.name.trim(),
                  price: Number(form.price),
                  durationDays: Number(form.durationDays),
                  description: form.description.trim(),
                  active: true,
                  locked: form.locked,
                  deletedAt: plan?.deletedAt ?? null,
                });
                toast.success(plan ? "Plan updated" : "Plan created");
                onOpenChange(false);
              }}
            >
              {plan ? "Save plan" : "Create plan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
