export const uid = () => crypto.randomUUID();
export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const parseDate = (s: string) => new Date(`${s}T12:00:00`);
export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function daysBetween(a: string, b: string) {
  return Math.round((Date.UTC(...parts(b)) - Date.UTC(...parts(a))) / 86400000);
}
function parts(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m - 1, d];
}
export const prettyDate = (s: string, options?: Intl.DateTimeFormatOptions) =>
  parseDate(s).toLocaleDateString(
    'en-GB',
    options || { day: 'numeric', month: 'short', year: 'numeric' },
  );
export const secondsText = (s: number) =>
  `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${Math.max(0, s % 60)
    .toString()
    .padStart(2, '0')}`;
export const num = (n: number, digits = 1) => Number(n.toFixed(digits)).toLocaleString('en-GB');
