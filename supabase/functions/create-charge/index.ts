import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const COMMERCE_API_KEY = Deno.env.get("COMMERCE_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://nextup.exchange";

interface ChargeRequest {
  kind?: "backing" | "song";
  artist_id?: string;
  track_id?: string;
  amount_usd_cents?: number;
  slug?: string;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not signed in" }, 401);
  }

  let body: ChargeRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { kind, artist_id, track_id, slug } = body;

  if (kind !== "backing" && kind !== "song") {
    return jsonResponse({ error: "kind must be 'backing' or 'song'" }, 400);
  }

  let amountCents: number;
  let name: string;
  let description: string;

  if (kind === "backing") {
    if (!artist_id) {
      return jsonResponse({ error: "artist_id is required for backing" }, 400);
    }
    const rawAmount = Number(body.amount_usd_cents);
    if (!Number.isInteger(rawAmount) || rawAmount < 2500) {
      return jsonResponse(
        { error: "amount_usd_cents must be an integer >= 2500" },
        400,
      );
    }
    const { data: artist, error: artistError } = await supabase
      .from("artists")
      .select("id, name")
      .eq("id", artist_id)
      .single();
    if (artistError || !artist) {
      return jsonResponse({ error: "Artist not found" }, 404);
    }
    amountCents = rawAmount;
    name = `Back ${artist.name} on Nextup`;
    description = `Backing ${artist.name}'s career.`;
  } else {
    if (!track_id) {
      return jsonResponse({ error: "track_id is required for song" }, 400);
    }
    const { data: track, error: trackError } = await supabase
      .from("tracks")
      .select("id, title, price_cents")
      .eq("id", track_id)
      .single();
    if (trackError || !track) {
      return jsonResponse({ error: "Track not found" }, 404);
    }
    const { data: alreadyOwned } = await supabase
      .from("track_ownership_public")
      .select("track_id")
      .eq("track_id", track_id)
      .maybeSingle();
    if (alreadyOwned) {
      return jsonResponse({ error: "Track is already owned" }, 409);
    }
    amountCents = track.price_cents;
    name = `Own "${track.title}" on Nextup`;
    description = `Song ownership for "${track.title}".`;
  }

  if (!COMMERCE_API_KEY) {
    return jsonResponse(
      {
        error:
          "Crypto payments aren't configured yet. Set COMMERCE_API_KEY to enable checkout.",
      },
      503,
    );
  }

  const commerceRes = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": COMMERCE_API_KEY,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name,
      description,
      pricing_type: "fixed_price",
      local_price: { amount: (amountCents / 100).toFixed(2), currency: "USD" },
      metadata: {
        user_id: user.id,
        kind,
        artist_id: artist_id ?? "",
        track_id: track_id ?? "",
      },
      redirect_url: `${SITE_URL}/artist.html?slug=${encodeURIComponent(slug ?? "")}&charge=success`,
      cancel_url: `${SITE_URL}/artist.html?slug=${encodeURIComponent(slug ?? "")}&charge=cancelled`,
    }),
  });

  if (!commerceRes.ok) {
    console.error("Coinbase Commerce error:", await commerceRes.text());
    return jsonResponse({ error: "Could not create charge" }, 502);
  }

  const commerceData = await commerceRes.json();
  const charge = commerceData.data;

  const { error: insertError } = await supabase.from("crypto_charges").insert({
    user_id: user.id,
    kind,
    artist_id: kind === "backing" ? artist_id : null,
    track_id: kind === "song" ? track_id : null,
    amount_usd_cents: amountCents,
    commerce_charge_id: charge.code,
    status: "pending",
  });

  if (insertError) {
    console.error("Failed to record charge:", insertError);
    return jsonResponse({ error: "Could not record charge" }, 500);
  }

  return jsonResponse({ hosted_url: charge.hosted_url }, 200);
});
