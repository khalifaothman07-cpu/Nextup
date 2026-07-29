/**
 * Money display. Shows cents only when there are cents to show, so whole
 * amounts stay clean ("$49") while balances and curve prices keep their
 * precision ("$47.50", "$2.01"). Never round money away — a wallet balance
 * or a live price is wrong the moment its cents disappear.
 */
export function formatUSD(cents) {
  const fraction = cents % 100 === 0 ? 0 : 2;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  });
}

/** "1 song" / "3 songs" — avoids "1 songs" in generated sentences. */
export function plural(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}
