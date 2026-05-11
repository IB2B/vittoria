export function formatCurrency(
  value: number | null | undefined,
  currency = "EUR",
  locale = "it-IT",
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyDetailed(
  value: number | null | undefined,
  currency = "EUR",
  locale = "it-IT",
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(
  value: number | null | undefined,
  locale = "it-IT",
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value,
  );
}

export function formatPercent(
  value: number | null | undefined,
  digits = 2,
  locale = "it-IT",
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

export function formatRoas(
  value: number | null | undefined,
  locale = "it-IT",
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)}×`;
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(1)}%`;
}
