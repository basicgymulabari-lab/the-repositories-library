import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bell, CircleDollarSign, CalendarClock, Cake, Boxes, Activity, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markNotificationsRead, useGym } from "@/lib/gym/store";
import { buildNotifications, relative, type Notification } from "@/lib/gym/selectors";

export const CATEGORY_META = {
  due: { label: "Payment Due", icon: CircleDollarSign },
  expiry: { label: "Membership Expiry", icon: CalendarClock },
  birthday: { label: "Birthdays", icon: Cake },
  inventory: { label: "Inventory Alerts", icon: Boxes },
  system: { label: "System Activities", icon: Activity },
} as const;

export const toneClass = (tone: Notification["tone"]) =>
  ({
    danger: "text-destructive bg-destructive/10 border-destructive/30",
    warning: "text-warning bg-warning/10 border-warning/30",
    success: "text-success bg-success/10 border-success/30",
    info: "text-info bg-info/10 border-info/30",
  })[tone];

export function NotificationRow({
  n,
  read,
  compact,
}: {
  n: Notification;
  read: boolean;
  compact?: boolean;
}) {
  const Icon = CATEGORY_META[n.category].icon;
  const body = (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-transparent p-3 transition-colors hover:border-gold/25 hover:bg-secondary/50",
        !read && "bg-secondary/30",
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-lg border",
          toneClass(n.tone),
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold">{n.title}</p>
          {!read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />}
        </div>
        <p className={cn("text-xs text-muted-foreground", compact ? "truncate" : "")}>
          {n.description}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground/70">{relative(n.date)}</p>
      </div>
    </div>
  );
  return n.href ? (
    <Link to={n.href} search={n.search as never} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function NotificationBell() {
  const state = useGym();
  const [open, setOpen] = useState(false);
  const notifications = useMemo(() => (state ? buildNotifications(state) : []), [state]);
  const readSet = new Set(state?.readNotifications ?? []);
  const unread = notifications.filter((n) => !readSet.has(n.id));

  if (!state) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-lg border border-border bg-secondary/60 p-2 text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unread.length > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[image:var(--gradient-gold)] px-1 text-[10px] font-bold text-primary-foreground">
              {unread.length > 99 ? "99+" : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[92vw] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="font-display text-lg tracking-wide">Notifications</p>
            <p className="text-xs text-muted-foreground">{unread.length} unread</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gold"
            onClick={() => markNotificationsRead(notifications.map((n) => n.id))}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Mark all read
          </Button>
        </div>
        <ScrollArea className="h-[420px]">
          <div className="space-y-4 p-2">
            {(() => {
              const keys = Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>;
              const hasBirthdayToday = notifications.some(
                (n) => n.category === "birthday" && n.description === "Birthday today",
              );
              return hasBirthdayToday
                ? (["birthday", ...keys.filter((k) => k !== "birthday")] as typeof keys)
                : keys;
            })().map((cat) => {
              const items = notifications.filter((n) => n.category === cat).slice(0, 4);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {CATEGORY_META[cat].label}
                  </p>
                  {items.map((n) => (
                    <NotificationRow key={n.id} n={n} read={readSet.has(n.id)} compact />
                  ))}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="border-t border-border p-2">
          <Button asChild variant="secondary" className="w-full" onClick={() => setOpen(false)}>
            <Link to="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
