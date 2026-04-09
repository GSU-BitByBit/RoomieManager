export function toDateOnlyUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function parseDateOnlyString(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function transformDateOnlyValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return parseDateOnlyString(value) ?? value;
}

export function formatDateOnlyUtc(date: Date): string {
  return toDateOnlyUtc(date).toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  const result = toDateOnlyUtc(date);
  result.setUTCDate(result.getUTCDate() + days);
  return toDateOnlyUtc(result);
}

export function compareDateOnlyAsc(left: Date, right: Date): number {
  return toDateOnlyUtc(left).getTime() - toDateOnlyUtc(right).getTime();
}

export function maxDateOnly(...dates: Date[]): Date {
  if (dates.length === 0) {
    throw new Error('maxDateOnly requires at least one date.');
  }

  return dates.reduce(
    (latest, current) =>
      compareDateOnlyAsc(current, latest) > 0 ? toDateOnlyUtc(current) : latest,
    toDateOnlyUtc(dates[0])
  );
}

export function minDateOnly(...dates: Date[]): Date {
  if (dates.length === 0) {
    throw new Error('minDateOnly requires at least one date.');
  }

  return dates.reduce(
    (earliest, current) =>
      compareDateOnlyAsc(current, earliest) < 0 ? toDateOnlyUtc(current) : earliest,
    toDateOnlyUtc(dates[0])
  );
}

export function isDateOnlyBefore(left: Date, right: Date): boolean {
  return compareDateOnlyAsc(left, right) < 0;
}

export function isDateOnlyAfter(left: Date, right: Date): boolean {
  return compareDateOnlyAsc(left, right) > 0;
}
