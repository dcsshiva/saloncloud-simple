/** Slot maths shared by the customer booking page and the booking server function. */

export const SLOT_MINUTES = 30;

export function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(":");
  return Number(h) * 60 + Number(m);
}

export function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export function formatTime(time: string): string {
  const minutes = toMinutes(time);
  const h24 = Math.floor(minutes / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(minutes % 60).padStart(2, "0")} ${suffix}`;
}

export type Hours = {
  is_open: boolean | null;
  open_time: string | null;
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
};

export type TakenSlot = { slot_start_time: string; slot_end_time: string };

/** All slot start times a service of `durationMinutes` could occupy on this weekday. */
export function generateSlots(hours: Hours | null | undefined, durationMinutes: number): string[] {
  if (!hours || hours.is_open === false || !hours.open_time || !hours.close_time) return [];
  const open = toMinutes(hours.open_time);
  const close = toMinutes(hours.close_time);
  const breakStart = hours.break_start ? toMinutes(hours.break_start) : null;
  const breakEnd = hours.break_end ? toMinutes(hours.break_end) : null;

  const slots: string[] = [];
  for (let start = open; start + durationMinutes <= close; start += SLOT_MINUTES) {
    const end = start + durationMinutes;
    const hitsBreak =
      breakStart !== null && breakEnd !== null && start < breakEnd && end > breakStart;
    if (!hitsBreak) slots.push(toTimeString(start));
  }
  return slots;
}

/** True when a candidate booking overlaps any already-locked slot. */
export function overlapsTaken(
  startTime: string,
  durationMinutes: number,
  taken: TakenSlot[],
): boolean {
  const start = toMinutes(startTime);
  const end = start + durationMinutes;
  return taken.some((slot) => {
    const takenStart = toMinutes(slot.slot_start_time);
    const takenEnd = toMinutes(slot.slot_end_time);
    return start < takenEnd && end > takenStart;
  });
}

/** Date (YYYY-MM-DD) and minutes-since-midnight "now" inside the salon's timezone. */
export function nowInTimezone(timezone: string): { date: string; minutes: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = parts["hour"] === "24" ? "00" : parts["hour"];
  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    minutes: Number(hour) * 60 + Number(parts["minute"]),
  };
}

/** Weekday index (0 = Sunday) for a YYYY-MM-DD string, timezone independent. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}
