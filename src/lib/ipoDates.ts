export interface IpoSchedule {
  name: string;
  closeDate?: string;
  allotmentDate?: string;
  listingDate?: string;
}

export function indiaDate(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata' }).format(date);
}

export function ipoDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}|^\d{1,2}[ -][a-z]{3,9}[ -]\d{4}$/i.test(value)) return undefined;
  const date = new Date(/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : `${value} UTC`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 2000) return undefined;
  return date.toISOString().slice(0, 10);
}

export function ipoNameKey(name: string) {
  return name.toLowerCase().trim()
    .replace(/\b(?:ipo|limited|ltd)\.?$/g, '').trim()
    .replace(/\b(?:limited|ltd)\.?$/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findIpoSchedule(schedules: IpoSchedule[], name: string, closeDate?: string) {
  const key = ipoNameKey(name);
  if (!key) return undefined;
  const candidates = schedules.filter(schedule => ipoNameKey(schedule.name) === key);
  const close = ipoDate(closeDate);
  if (close) return candidates.find(schedule => schedule.closeDate === close);
  return candidates.length === 1 ? candidates[0] : undefined;
}
