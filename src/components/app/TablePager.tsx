import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function TablePager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-4 flex flex-col items-start gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <p className="truncate text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex w-full shrink-0 items-center justify-between gap-2 sm:w-auto sm:justify-start">
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {Math.min(page, pages)} / {pages}
        </span>
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
