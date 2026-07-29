import { supabase } from "./supabaseClient.js";

/**
 * Latest momentum snapshot per artist, keyed by artist_id. Snapshots are
 * computed daily (pg_cron) from real platform activity only — see
 * docs/DATA_MODEL.md for the score formula.
 */
export async function fetchLatestMomentum() {
  const { data, error } = await supabase
    .from("artist_momentum_daily")
    .select(
      "artist_id, day, score, follows_7d, trades_7d, purchases_7d, trade_volume_cents_7d, followers_total",
    )
    .order("day", { ascending: false });
  const byArtist = new Map();
  if (error || !data) return byArtist;
  for (const row of data) {
    if (!byArtist.has(row.artist_id)) byArtist.set(row.artist_id, row);
  }
  return byArtist;
}

/** Latest snapshot for a single artist, or null. */
export async function fetchArtistMomentum(artistId) {
  const { data } = await supabase
    .from("artist_momentum_daily")
    .select(
      "artist_id, day, score, follows_7d, trades_7d, purchases_7d, trade_volume_cents_7d, followers_total",
    )
    .eq("artist_id", artistId)
    .order("day", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
