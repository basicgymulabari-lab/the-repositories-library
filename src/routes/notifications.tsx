import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { BellRing, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, Panel, EmptyState } from "@/components/app/Panel";
import { Button } from "@/components/ui/button";
import { markNotificationsRead, useGym } from "@/lib/gym/store";
import { buildNotifications, relative } from "@/lib/gym/selectors";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — IRONVAULT Gym Management" },
      {
        name: "description",
        content:
          "All gym alerts in one place: payments due, memberships expiring, member birthdays and low stock warnings.",
      },
      { property: "og:title", content: "Notifications — IRONVAULT Gym Management" },
      {
        property: "og:description",
        content: "Payment dues, expiry reminders, birthdays and stock alerts generated on-device.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <NotificationsPage />
    </AppShell>
  ),
});

function NotificationsPage() {
  const state = useGym();
  const items = useMemo(() => (state ? buildNotifications(state) : []), [state]);
  if (!state) return null;

  const read = new Set(state.readNotifications);
  const unread = items.filter((n) => !read.has(n.id));

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unread.length} unread of ${items.length} alerts`}
        actions={
          <Button
            variant="secondary"
            disabled={unread.length === 0}
            onClick={() => {
              markNotificationsRead(items.map((n) => n.id));
              toast.success("All notifications marked as read");
            }}
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
          </Button>
        }
      />

      <Panel>
        {items.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            hint="New alerts will show up here automatically."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((n) => {
              const isRead = read.has(n.id);
              const row = (
                <div className="flex items-start gap-4 py-4">
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
                      isRead
                        ? "border-border bg-secondary/40 text-muted-foreground"
                        : "border-gold/40 bg-gold/10 text-gold"
                    }`}
                  >
                    <BellRing className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${isRead ? "text-muted-foreground" : "font-medium"}`}
                    >
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{relative(n.date)}</span>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      to={n.href}
                      search={n.search as never}
                      className="block rounded-lg px-2 transition-colors hover:bg-secondary/50"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
