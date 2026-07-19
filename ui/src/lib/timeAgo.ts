import { t as defaultTranslate } from "@/i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export type TimeAgoTranslator = (key: string, params?: Record<string, unknown>) => string;

export function timeAgo(date: Date | string, translate?: TimeAgoTranslator): string {
  const t = translate ?? defaultTranslate;
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);

  if (seconds < MINUTE) return t("ui.common.time.justNow");
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return t("ui.common.time.minutesAgo", { count: m });
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return t("ui.common.time.hoursAgo", { count: h });
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return t("ui.common.time.daysAgo", { count: d });
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return t("ui.common.time.weeksAgo", { count: w });
  }
  const mo = Math.floor(seconds / MONTH);
  return t("ui.common.time.monthsAgo", { count: mo });
}
