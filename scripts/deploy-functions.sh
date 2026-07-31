#!/usr/bin/env bash
# Deploy the Nextup edge functions.
#
# `trade` is already deployed. The rest are listed here so they can go up in
# one run instead of one approval prompt at a time.
#
# Prerequisites: the Supabase CLI, and `supabase login` once.
#   https://supabase.com/docs/guides/local-development/cli/getting-started
#
# Run from the repo root:  bash scripts/deploy-functions.sh
set -euo pipefail

PROJECT_REF="djnsjtlkjgjqmfcucjqp"

# coinbase-webhook is deliberately absent from this list — it is deployed
# separately below with JWT verification OFF, because Coinbase calls it, not a
# signed-in user. It authenticates the request itself by verifying the
# X-CC-Webhook-Signature HMAC before it trusts one byte of the body.
FUNCTIONS=(
  create-charge
  deposit
  withdraw
  cancel-withdrawal
  close-position
  trade
)

echo "Deploying to project ${PROJECT_REF}"

for fn in "${FUNCTIONS[@]}"; do
  echo "  → ${fn}"
  supabase functions deploy "${fn}" --project-ref "${PROJECT_REF}"
done

echo "  → coinbase-webhook (no JWT verification — see comment above)"
supabase functions deploy coinbase-webhook \
  --project-ref "${PROJECT_REF}" \
  --no-verify-jwt

echo
echo "Done. Verify with:  supabase functions list --project-ref ${PROJECT_REF}"
echo
echo "Nothing can take a payment until these two secrets are set — until then"
echo "the charge endpoints return a clean 503 rather than half-working:"
echo "  supabase secrets set COMMERCE_API_KEY=...       --project-ref ${PROJECT_REF}"
echo "  supabase secrets set COMMERCE_WEBHOOK_SECRET=... --project-ref ${PROJECT_REF}"
