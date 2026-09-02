import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Search, Plus, Eye, Pencil, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { StatusBadge } from "@/components/app/StatCard";
import { TablePager } from "@/components/app/TablePager";
import { MemberFormDialog } from "@/components/app/MemberFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trashMember, useGym } from "@/lib/gym/store";
import {
  activeMembers,
  currentMembership,
  isWalkIn,
  money,
  outstandingFor,
  planOf,
  shortDate,
  statusOf,
} from "@/lib/gym/selectors";
import type { Member } from "@/lib/gym/types";

const searchSchema = z.object({
  filter: fallback(z.string(), "all").default("all"),
  q: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
  new: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/members/")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Members — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "Search, filter and manage every gym member: profiles, membership status, dues, measurements and progress notes.",
      },
      { property: "og:title", content: "Members — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Full member roster with status filters, dues tracking and safe delete to trash.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <MembersPage />
    </AppShell>
  ),
});

const FILTERS = ["all", "active", "expiring", "expired", "frozen", "due", "walk-in"] as const;
const PAGE_SIZE = 8;

function MembersPage() {
  const state = useGym();
  const navigate = useNavigate({ from: "/members/" });
  const search = Route.useSearch();
  const [formOpen, setFormOpen] = useState(search.new);
  const [editing, setEditing] = useState<Member | null>(null);
  const [toTrash, setToTrash] = useState<Member | null>(null);

  const filter = FILTERS.includes(search.filter as (typeof FILTERS)[number])
    ? (search.filter as (typeof FILTERS)[number])
    : "all";
  const q = search.q.slice(0, 60).toLowerCase();
  const page = Math.max(1, search.page);

  const rows = useMemo(() => {
    if (!state) return [];
    return activeMembers(state)
      .map((m) => ({
        member: m,
        status: isWalkIn(m) ? "walk-in" : statusOf(state, m.id),
        due: outstandingFor(state, m.id),
        membership: currentMembership(state, m.id),
      }))
      .filter((r) => {
        if (filter === "due") return r.due > 0;
        if (filter === "walk-in") return isWalkIn(r.member);
        if (isWalkIn(r.member)) return filter === "all";
        if (filter === "active") return r.status === "active" || r.status === "expiring";
        if (filter !== "all") return r.status === filter;
        return true;
      })
      .filter(
        (r) =>
          !q ||
          r.member.name.toLowerCase().includes(q) ||
          r.member.phone.toLowerCase().includes(q) ||
          r.member.email.toLowerCase().includes(q),
      )
      .sort((a, b) => a.member.name.localeCompare(b.member.name));
  }, [state, filter, q]);

  if (!state) return null;
  const cur = state.settings.currency;
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const setSearch = (patch: Record<string, unknown>) =>
    navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }) as never });

  return (
    <>
      <PageHeader
        title="Member Management"
        subtitle={`${rows.length} ${rows.length === 1 ? "person" : "people"} matching the current view`}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Member
          </Button>
        }
      />

      <Panel>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, phone or email"
              value={search.q}
              maxLength={60}
              onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setSearch({ filter: f, page: 1 })}
                className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "border-gold/50 bg-gold/15 text-gold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "due" ? "Pending due" : f === "walk-in" ? "Walk-in Customers" : f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          {paged.length === 0 ? (
            <EmptyState title="No people found" hint="Try a different filter or search term." />
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-3">Member</th>
                  <th className="py-3">Plan</th>
                  <th className="py-3">Expiry</th>
                  <th className="py-3">Status</th>
                  <th className="py-3 text-right">Due</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(({ member, status, due, membership }) => (
                  <tr
                    key={member.id}
                    className="border-b border-border/50 transition-colors hover:bg-secondary/40"
                  >
                    <td className="py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/25 bg-secondary text-xs font-semibold text-gold">
                          {member.photo ? (
                            <img
                              src={member.photo}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            member.name.slice(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{member.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{member.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {isWalkIn(member) ? "—" : (planOf(state, membership?.planId)?.name ?? "—")}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {!isWalkIn(member) && membership ? shortDate(membership.endDate) : "—"}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="py-3 text-right font-medium">
                      <span className={due > 0 ? "text-warning" : "text-muted-foreground"}>
                        {money(due, cur)}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                          <Link
                            to="/members/$memberId"
                            params={{ memberId: member.id }}
                            search={{ tab: undefined }}
                            aria-label="View profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={isWalkIn(member) ? "Edit walk-in customer" : "Edit member"}
                          onClick={() => {
                            setEditing(member);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label="Move to trash"
                          onClick={() => setToTrash(member)}
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

        <TablePager
          page={page}
          pageSize={PAGE_SIZE}
          total={rows.length}
          onPage={(p) => setSearch({ page: p })}
        />
      </Panel>

      <MemberFormDialog
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) {
            setEditing(null);
            if (search.new) setSearch({ new: false });
          }
        }}
        member={editing}
      />

      <AlertDialog open={Boolean(toTrash)} onOpenChange={(v) => !v && setToTrash(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl tracking-wide">
              Do you want to move this member to Trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toTrash?.name} will be moved to Trash. You can restore them within 30 days before the
              record is removed automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toTrash) {
                  trashMember(toTrash.id, state.settings.adminName);
                  toast.success(`${toTrash.name} moved to Trash`);
                }
                setToTrash(null);
              }}
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
