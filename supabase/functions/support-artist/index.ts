import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const COMMERCE_API_KEY = Deno.env.get("COMMERCE_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://nextup.exchange";

interface SupportRequest {
  tier_id?: string;
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

  let body: SupportRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.tier_id) {
    return jsonResponse({ error: "tier_id is required" }, 400);
  }

  const { data: tier, error: tierError } = await supabase
    .from("support_tiers")
    .select(
      "id, artist_id, name, price_cents, billing_frequency, active, artists(name)",
    )
    .eq("id", body.tier_id)
    .single();
  if (tierError || !tier || !tier.active) {
    return jsonResponse({ error: "Support tier not found" }, 404);
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

  // deno-lint-ignore no-explicit-any
  const artistName = (tier as any).artists?.name ?? "this artist";
  const cadence =
    tier.billing_frequency === "monthly" ? " (renews monthly)" : "";

  const commerceRes = await fetch("https://api.commerce.coinbase.com/charges", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": COMMERCE_API_KEY,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: `${tier.name} — back ${artistName} on Nextup`,
      description: `${tier.name} support tier for ${artistName}${cadence}.`,
      pricing_type: "fixed_price",
      local_price: {
        amount: (tier.price_cents / 100).toFixed(2),
        currency: "USD",
      },
      metadata: {
        user_id: user.id,
        tier_id: tier.id,
        artist_id: tier.artist_id,
      },
      redirect_url: `${SITE_URL}/artist.html?slug=${encodeURIComponent(body.slug ?? "")}&support=success`,
      cancel_url: `${SITE_URL}/artist.html?slug=${encodeURIComponent(body.slug ?? "")}&support=cancelled`,
    }),
  });

  if (!commerceRes.ok) {
    console.error("Coinbase Commerce error:", await commerceRes.text());
    return jsonResponse({ error: "Could not create charge" }, 502);
  }

  const commerceData = await commerceRes.json();
  const charge = commerceData.data;

  const { error: insertError } = await supabase
    .from("support_payments")
    .insert({
      user_id: user.id,
      artist_id: tier.artist_id,
      tier_id: tier.id,
      amount_usd_cents: tier.price_cents,
      commerce_charge_id: charge.code,
      status: "pending",
    });

  if (insertError) {
    console.error("Failed to record support payment:", insertError);
    return jsonResponse({ error: "Could not record payment" }, 500);
  }

  return jsonResponse({ hosted_url: charge.hosted_url }, 200);
});
