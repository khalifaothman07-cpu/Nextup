#!/usr/bin/env bash
#
# Pulls the full migration history out of the Supabase project into
# supabase/migrations/.
#
# THE DATABASE SCHEMA IS NOT IN THIS REPOSITORY. It lives in Supabase's own
# migration history, which is where every migration in this project was applied
# from. Run this before anything else — until you do, the repo is an app with
# no database behind it, and the SQL that defines the money functions, the
# row-level security policies and the ledger exists in exactly one place.
#
# Usage:
#   npm i -g supabase          # or: brew install supabase/tap/supabase
#   supabase login
#   bash scripts/pull-schema.sh <project-ref>
#
# <project-ref> is the identifier in the project's dashboard URL. It is not in
# this repo on purpose; whoever hands the project over gives it to you along
# with dashboard access.
set -euo pipefail

REF="${1:-}"
if [ -z "$REF" ]; then
  echo "usage: bash scripts/pull-schema.sh <project-ref>" >&2
  exit 2
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found — install it first (npm i -g supabase)" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

supabase link --project-ref "$REF"
supabase db pull

echo
echo "Pulled into supabase/migrations/. Commit it — this repo should not be"
echo "one dashboard deletion away from losing its schema."
echo
echo "Sanity check: 'ledger_entries', 'open_position' and 'private.has_role'"
echo "should all appear somewhere under supabase/migrations/."
