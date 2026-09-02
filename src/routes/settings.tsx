import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Database, Download, Upload, RotateCcw, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel } from "@/components/app/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REVENUE_METRICS, type RevenueMetric } from "@/lib/gym/selectors";
import type { CalendarSystem } from "@/lib/gym/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  exportBackup,
  resetData,
  restoreBackup,
  setupTemplateData,
  updateSettings,
  useGym,
} from "@/lib/gym/store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Configure gym details, invoice numbering, reminder rules and manage offline backup, restore and data reset.",
      },
      { property: "og:title", content: "Settings — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Gym profile, invoicing, alerts and local backup or restore of your data.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ),
});

function SettingsPage() {
  const state = useGym();
  const fileRef = useRef<HTMLInputElement>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [form, setForm] = useState<Record<string, string> | null>(null);

  if (!state) return null;
  const s = state.settings;
  const value = (key: keyof typeof s) => form?.[key] ?? String(s[key]);
  const set = (key: string, v: string) => setForm((f) => ({ ...(f ?? {}), [key]: v }));

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Everything is stored on this device — no accounts, no cloud, no internet"
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Gym Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gym name" value={value("gymName")} onChange={(v) => set("gymName", v)} />
            <Field label="Tagline" value={value("tagline")} onChange={(v) => set("tagline", v)} />
            <Field label="Phone" value={value("phone")} onChange={(v) => set("phone", v)} />
            <Field label="Email" value={value("email")} onChange={(v) => set("email", v)} />
            <Field
              label="Admin name"
              value={value("adminName")}
              onChange={(v) => set("adminName", v)}
            />
            <Field
              label="Currency symbol"
              value={value("currency")}
              onChange={(v) => set("currency", v)}
              max={4}
            />
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea
                rows={2}
                maxLength={180}
                value={value("address")}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button
              onClick={() => {
                if (!form) return toast.info("No changes to save");
                if ((form.gymName ?? s.gymName).trim().length < 2)
                  return toast.error("Gym name is too short");
                updateSettings({
                  gymName: (form.gymName ?? s.gymName).trim(),
                  tagline: (form.tagline ?? s.tagline).trim(),
                  phone: (form.phone ?? s.phone).trim(),
                  email: (form.email ?? s.email).trim(),
                  adminName: (form.adminName ?? s.adminName).trim(),
                  currency: (form.currency ?? s.currency).trim() || "₹",
                  address: (form.address ?? s.address).trim(),
                });
                setForm(null);
                toast.success("Settings saved");
              }}
            >
              <Save className="mr-2 h-4 w-4" /> Save changes
            </Button>
          </div>
        </Panel>

        <Panel title="Invoicing & Alerts">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Invoice prefix</Label>
              <Input
                value={s.invoicePrefix}
                maxLength={8}
                onChange={(e) => updateSettings({ invoicePrefix: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2">
              <Label>Expiry reminder (days before)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={s.expiryReminderDays}
                onChange={(e) =>
                  updateSettings({
                    expiryReminderDays: Math.min(60, Math.max(1, Number(e.target.value) || 7)),
                  })
                }
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Label>Dashboard revenue card</Label>
            <Select
              value={s.revenueCardMetric ?? "today"}
              onValueChange={(v) => updateSettings({ revenueCardMetric: v as RevenueMetric })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REVENUE_METRICS.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Chooses which figure the revenue card on the dashboard shows.
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-secondary/30 p-4">
            <div className="min-w-0 pr-4">
              <p className="text-sm font-medium">Low stock alerts</p>
              <p className="text-xs text-muted-foreground">
                Warn on the dashboard when a product falls below its threshold.
              </p>
            </div>
            <Switch
              checked={s.lowStockAlerts}
              onCheckedChange={(v) => updateSettings({ lowStockAlerts: v })}
            />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Next invoice number:{" "}
            <span className="text-gold">
              {s.invoicePrefix}-{String(state.invoiceSeq + 1).padStart(6, "0")}
            </span>
          </p>
        </Panel>

        <Panel title="Calendar & Region">
          <div className="space-y-2">
            <Label>Calendar system</Label>
            <Select
              value={s.calendarSystem ?? "gregorian"}
              onValueChange={(selected) =>
                updateSettings({ calendarSystem: selected as CalendarSystem })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gregorian">Global — Gregorian calendar</SelectItem>
                <SelectItem value="bikram_sambat">Nepal — Bikram Sambat calendar</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nepal mode uses Bikram Sambat years and Nepali month names while preserving all stored
              records and calculations.
            </p>
          </div>
        </Panel>

        <Panel title="Backup & Restore">
          <p className="text-sm text-muted-foreground">
            Export a complete JSON snapshot of your gym data and keep it somewhere safe. Restoring
            replaces everything currently on this device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([exportBackup()], { type: "application/json" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = `ironvault-backup-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Backup downloaded");
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Export backup
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Restore backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  restoreBackup(await file.text());
                  toast.success("Backup restored");
                } catch {
                  toast.error("Could not read that file");
                }
                e.target.value = "";
              }}
            />
          </div>
        </Panel>

        <Panel title="Danger Zone">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Resetting permanently wipes every member, customer, plan, payment, product, sale,
              expense and activity record. Your app and gym settings remain unchanged.
            </p>
          </div>
          <div className="mt-4 flex flex-col items-end gap-2">
            <Button variant="secondary" onClick={() => setTemplateOpen(true)}>
              <Database className="mr-2 h-4 w-4" /> Set Up Template Data
            </Button>
            <Button variant="destructive" onClick={() => setResetOpen(true)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset all data
            </Button>
          </div>
        </Panel>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide text-destructive">
              Reset all data?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Export a backup first if you might need this data again.
            </p>
            <div className="space-y-2">
              <Label>
                Type <span className="font-mono text-destructive">RESET</span> to confirm
              </Label>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="RESET"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={confirm !== "RESET"}
                onClick={() => {
                  resetData();
                  setConfirm("");
                  setResetOpen(false);
                  toast.success("All data reset");
                }}
              >
                Reset everything
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-wide">
              Set up template data?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This replaces all current business records with the default starter data, including
              members, plans, payments, products, sales and expenses. Your settings remain
              unchanged.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setTemplateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setupTemplateData();
                  setTemplateOpen(false);
                  toast.success("Template data set up successfully");
                }}
              >
                Set Up Template Data
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  max = 80,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
