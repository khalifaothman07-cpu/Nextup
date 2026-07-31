/**
 * Sanitization gate for the board appendix.
 *
 * docs/board-appendix.html goes to people outside the company. Everything
 * below is either an operational identifier, an implementation detail, or a
 * description of a security control specific enough to be useful to someone
 * attacking it. None of it belongs in a board document, and the failure mode
 * is silent — an edit adds a sentence, nobody re-reads 700 lines, and an
 * environment reference ships to a board member's inbox.
 *
 * Run: node scripts/check-board-appendix.mjs
 */
import { readFileSync } from "node:fs";

const BANNED = [
  // infrastructure identity
  "djnsjtlkjgjqmfcucjqp",
  "khalifaothman07",
  "ap-south-1",
  "supabase.co",
  // implementation specifics
  "regulated_offerings",
  "open_position",
  "close_position",
  "request_withdrawal",
  "admin_mark_withdrawal_paid",
  "admin_list_withdrawals",
  "rate_counters",
  "has_role",
  "service_role",
  "pg_cron",
  "cf-connecting-ip",
  "P0001",
  "SECURITY DEFINER",
  "row-level security",
  "RLS",
  "PostgREST",
  // deployment
  "supabase functions deploy",
  "supabase secrets set",
  "npm run",
  // vendor and links
  "Coinbase",
  "claude.ai/code/artifact",
  "nextup.exchange",
];

const src = readFileSync(
  new URL("../docs/board-appendix.html", import.meta.url),
  "utf8",
).toLowerCase();

const hits = BANNED.filter((term) => src.includes(term.toLowerCase()));

if (hits.length) {
  console.error(
    "Board appendix leaks internal detail:\n  " + hits.join("\n  "),
  );
  process.exit(1);
}
console.log(`board appendix: clean (${BANNED.length} terms checked)`);
