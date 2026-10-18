/** Time zone that decides what "today" means. Railway runs in UTC, so this is set explicitly. */
export function appTimeZone(): string {
  return process.env.APP_TIME_ZONE || "America/Toronto";
}

/** Calendar date in the app time zone as YYYY-MM-DD (the en-CA locale formats it this way). */
export function localToday(now: Date = new Date(), timeZone: string = appTimeZone()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
