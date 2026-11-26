/** A calendar date in India, formatted for native date input values. */
export function todayInIndia(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Convert a saved instant to the calendar day the user sees in India. */
export function dateInputInIndia(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return todayInIndia();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Store an input's selected calendar day at noon in India, avoiding UTC day shifts. */
export function indiaDateIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date().toISOString();
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 6, 30)).toISOString();
}

/** Parse a calendar-only value as India-local noon before displaying it. */
export function formatIndiaDate(value: string | Date, options: Intl.DateTimeFormatOptions = {
  day: 'numeric', month: 'short', year: 'numeric',
}): string {
  const date = value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T06:30:00.000Z` : value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'Asia/Kolkata' }).format(date);
}
