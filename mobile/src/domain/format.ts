/**
 * Number formatting.
 *
 * Deliberately not `Intl` — Hermes ships a partial ICU and the design only ever
 * needs two formats, so they're spelled out here and behave identically on every
 * platform: whole dollars for anything structural, cents for anything that
 * changes when you tap something.
 */

function group(n: number): string {
  return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `$3,269` — rounded, grouped. */
export function money(n: number): string {
  return `${n < 0 ? '−' : ''}$${group(n)}`;
}

/** `$34.78` — the live numbers: today's remainder, a receipt, a line item. */
export function cents(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** `+$186` / `−$84` — signed, for deltas. */
export function signedMoney(n: number): string {
  return `${n >= 0 ? '+' : '−'}$${group(n)}`;
}

/** `−2 d` / `+2 d`, the runway ledger's unit. */
export function signedDays(n: number, unit = 'd'): string {
  return `${n >= 0 ? '+' : '−'}${Math.abs(n)} ${unit}`;
}

/** `12 h` — hours, trimmed of a trailing `.0`. */
export function hours(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)}`;
}

/** `$15.50 / h` — a pay rate, cents only when there are cents. */
export function rate(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)} / h`;
}

/** `$15.50/h` — the same rate where it sits inside a list row. */
export function rateCompact(n: number): string {
  return `$${Number.isInteger(n) ? n : n.toFixed(2)}/h`;
}

/** Width for a bar in a percentage row, floored so a tiny value is still visible. */
export function pct(value: number, max: number, floor = 4): `${number}%` {
  if (max <= 0) return `${floor}%`;
  return `${Math.max(floor, Math.round((value / max) * 100))}%`;
}
