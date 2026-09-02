import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useGym } from "@/lib/gym/store";
import { activeMembers, money, shortDate } from "@/lib/gym/selectors";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const state = useGym();
  const navigate = useNavigate();
  if (!state) return null;

  const go = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search members, products, invoices, pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Members">
          {activeMembers(state)
            .slice(0, 40)
            .map((m) => (
              <CommandItem
                key={m.id}
                value={`${m.name} ${m.phone} ${m.email}`}
                onSelect={() =>
                  go(() =>
                    navigate({
                      to: "/members/$memberId",
                      params: { memberId: m.id },
                      search: { tab: undefined },
                    }),
                  )
                }
              >
                <span className="font-medium">{m.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{m.phone}</span>
              </CommandItem>
            ))}
        </CommandGroup>
        <CommandGroup heading="Products">
          {state.products.map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.name} ${p.sku} ${p.category}`}
              onSelect={() => go(() => navigate({ to: "/products", search: { sale: undefined } }))}
            >
              <span className="font-medium">{p.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {money(p.price, state.settings.currency)} · {p.stock} in stock
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Recent invoices">
          {state.payments.slice(0, 12).map((p) => (
            <CommandItem
              key={p.id}
              value={`${p.invoiceNo} ${p.note}`}
              onSelect={() => go(() => navigate({ to: "/payments" }))}
            >
              <span className="font-medium">{p.invoiceNo}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {money(p.amount, state.settings.currency)} · {shortDate(p.date)}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
