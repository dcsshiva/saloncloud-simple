export type BillingCycle = "monthly" | "annual" | "manual";

export function cycleDays(cycle: string, durationDays: number | null | undefined): number {
  if (cycle === "monthly") return 30;
  if (cycle === "annual") return 365;
  return durationDays && durationDays > 0 ? durationDays : 30;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function currency(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
