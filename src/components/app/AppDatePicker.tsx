import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGym } from "@/lib/gym/store";
import {
  BS_MONTHS,
  bsDaysInMonth,
  formatShortDate,
  fromNepaliDate,
  localDateInput,
  toNepaliDate,
} from "@/lib/gym/calendar";

type Props = {
  value: string;
  onChange: (value: string) => void;
  min?: Date;
  max?: Date;
  placeholder?: string;
};

export function AppDatePicker({ value, onChange, min, max, placeholder = "Select date" }: Props) {
  const state = useGym();
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : undefined;
  const initialBs = toNepaliDate(selected ?? new Date()).getBS();
  const [bsYear, setBsYear] = useState(initialBs.year);
  const [bsMonth, setBsMonth] = useState(initialBs.month);
  const nepali = state?.settings.calendarSystem === "bikram_sambat";

  useEffect(() => {
    if (!open) return;
    const selectedForView = value ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date();
    const bs = toNepaliDate(selectedForView).getBS();
    setBsYear(bs.year);
    setBsMonth(bs.month);
  }, [open, value]);

  const years = useMemo(() => {
    const minYear = toNepaliDate(min ?? new Date(1920, 0, 1)).getYear();
    const maxYear = toNepaliDate(max ?? new Date(new Date().getFullYear() + 5, 11, 31)).getYear();
    return Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
  }, [min, max]);

  const moveMonth = (amount: number) => {
    const index = bsYear * 12 + bsMonth + amount;
    const minIndex = years[0] * 12;
    const maxIndex = years[years.length - 1] * 12 + 11;
    const boundedIndex = Math.max(minIndex, Math.min(maxIndex, index));
    setBsYear(Math.floor(boundedIndex / 12));
    setBsMonth(((boundedIndex % 12) + 12) % 12);
  };

  const firstDay = fromNepaliDate(bsYear, bsMonth, 1).getDay();
  const days = bsDaysInMonth(bsYear, bsMonth);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`w-full justify-between px-3 font-normal ${
            selected ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {selected ? formatShortDate(selected) : placeholder}
          <CalendarIcon className="h-4 w-4 text-gold" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto border-gold/25 p-0">
        {nepali ? (
          <div className="w-[310px] rounded-xl bg-popover p-3">
            <div className="mb-3 flex items-center gap-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => moveMonth(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={String(bsMonth)} onValueChange={(v) => setBsMonth(Number(v))}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BS_MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(bsYear)} onValueChange={(v) => setBsYear(Number(v))}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="ghost" size="icon" onClick={() => moveMonth(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="py-1.5">
                  {day.slice(0, 1)}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {Array.from({ length: firstDay }).map((_, index) => (
                <span key={`blank-${index}`} />
              ))}
              {Array.from({ length: days }, (_, index) => index + 1).map((day) => {
                const ad = fromNepaliDate(bsYear, bsMonth, day);
                const disabled = Boolean((min && ad < min) || (max && ad > max));
                const active = selected && localDateInput(ad) === localDateInput(selected);
                return (
                  <button
                    key={day}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(localDateInput(ad));
                      setOpen(false);
                    }}
                    className={`h-9 rounded-md text-sm transition-colors hover:bg-accent disabled:opacity-30 ${
                      active ? "bg-gold text-black hover:bg-gold" : "text-foreground"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">Bikram Sambat (BS)</p>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? new Date()}
            onSelect={(date) => {
              if (!date) return;
              onChange(localDateInput(date));
              setOpen(false);
            }}
            disabled={
              min && max
                ? [{ before: min }, { after: max }]
                : min
                  ? { before: min }
                  : max
                    ? { after: max }
                    : undefined
            }
            startMonth={min}
            endMonth={max}
            captionLayout="dropdown"
            className="rounded-xl bg-popover"
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
