/**
 * Turning database errors into sentences a person can act on.
 *
 * The rate limiter raises `rate limit exceeded for wd:<uuid>` — accurate, and
 * exactly the wrong thing to show someone. It also leaks an internal bucket
 * key. Every surface that can trip a limit routes its error through here.
 */

/** Postgres raises rate-limit violations with this SQLSTATE. */
const RAISE_EXCEPTION = "P0001";

const RATE_LIMIT_COPY = {
  wd: "You've made several withdrawal requests already. Try again in an hour — the ones you've made are still queued.",
  pos: "That's a lot of trades in a short time. Give it a minute and try again.",
  chg: "You've started several checkouts recently. Try again in an hour.",
  wl: "We've had a few signups from your connection already. Try again shortly.",
};

export function isRateLimited(error) {
  return (
    error?.code === RAISE_EXCEPTION &&
    typeof error?.message === "string" &&
    error.message.startsWith("rate limit exceeded")
  );
}

/**
 * A message for the person, never the raw one. `fallback` covers everything
 * that isn't a rate limit.
 */
export function friendlyError(error, fallback) {
  if (!isRateLimited(error)) return fallback;
  const bucket = /rate limit exceeded for ([a-z]+):/.exec(error.message)?.[1];
  return (
    RATE_LIMIT_COPY[bucket] ??
    "You're doing that a bit too often. Give it a moment and try again."
  );
}
