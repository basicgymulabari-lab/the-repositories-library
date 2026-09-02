import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 grid grid-cols-1 items-start gap-3 sm:flex sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="break-words font-display text-3xl tracking-[0.06em] sm:truncate sm:text-4xl">
          <span className="text-gradient-gold">{title}</span>
        </h1>
        {subtitle && <p className="mt-1 break-words text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("surface-panel hairline-top relative overflow-hidden rounded-2xl", className)}
    >
      {(title || actions) && (
        <div className="grid grid-cols-1 items-start gap-3 border-b border-border px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="break-words font-display text-xl tracking-wide sm:truncate">
                {title}
              </h2>
            )}
            {description && (
              <p className="break-words text-xs text-muted-foreground sm:truncate">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 sm:shrink-0 sm:overflow-visible sm:pb-0">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="font-display text-lg tracking-wide text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  );
}
