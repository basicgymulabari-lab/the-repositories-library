import NepaliDatePackage, { dateConfigMap } from "nepali-date-converter";
import type { CalendarSystem } from "./types";

const NepaliDate =
  (NepaliDatePackage as unknown as { default?: typeof NepaliDatePackage }).default ??
  NepaliDatePackage;

export const BS_MONTHS = [
  "Baisakh",
  "Jestha",
  "Asar",
  "Shrawan",
  "Bhadra",
  "Aswin",
  "Kartik",
  "Mangsir",
  "Poush",
  "Magh",
  "Falgun",
  "Chaitra",
] as const;

let activeCalendar: CalendarSystem = "gregorian";

export function configureCalendarSystem(system?: CalendarSystem) {
  activeCalendar = system === "bikram_sambat" ? "bikram_sambat" : "gregorian";
}

export const currentCalendarSystem = () => activeCalendar;

export const localDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export function toNepaliDate(value: string | Date) {
  return new NepaliDate(new Date(value));
}

export function fromNepaliDate(year: number, month: number, day: number) {
  return new NepaliDate(year, month, day).toJsDate();
}

export function bsDaysInMonth(year: number, month: number) {
  const config = dateConfigMap[String(year)];
  return config?.[BS_MONTHS[month]] ?? 30;
}

function safeBs(value: string | Date, format: string) {
  try {
    return toNepaliDate(value).format(format, "en");
  } catch {
    return null;
  }
}

export function formatShortDate(value: string | Date) {
  if (activeCalendar === "bikram_sambat") {
    return safeBs(value, "DD MMMM YYYY") ?? "—";
  }
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatCompactDate(value: string | Date) {
  if (activeCalendar === "bikram_sambat") {
    return safeBs(value, "DD MMM YY") ?? "—";
  }
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function formatLongDate(value: string | Date) {
  if (activeCalendar === "bikram_sambat") {
    return safeBs(value, "ddd, D MMMM YYYY") ?? "—";
  }
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDayMonth(value: string | Date) {
  if (activeCalendar === "bikram_sambat") return safeBs(value, "DD MMM") ?? "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function formatMonth(value: string | Date) {
  if (activeCalendar === "bikram_sambat") return safeBs(value, "MMM") ?? "—";
  return new Date(value).toLocaleDateString("en-IN", { month: "short" });
}
