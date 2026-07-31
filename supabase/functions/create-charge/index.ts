import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const COMMERCE_API_KEY = Deno.env.get("COMMERCE_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://nextup.exchange";

interface ChargeRequest {
  track_id?: string;
  slug?: string;
}

/** The DB rate limiter raises this; surface it as 429, not a generic failure. */
function rateLimited(message: string | undefined): boolean {
  return (message ?? "").includes("rate limit exceeded");
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

  const { track_id, slug } = body;
  if (!track_id) {
    return jsonResponse({ error: "track_id is required" }, 400);
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
      name: `Own "${track.title}" on Nextup`,
      description: `Song ownership for "${track.title}".`,
      pricing_type: "fixed_price",
      local_price: {
        amount: (track.price_cents / 100).toFixed(2),
        currency: "USD",
      },
      metadata: { user_id: user.id, track_id },
      redirect_url: `${SITE_URL}/artist/${encodeURIComponent(slug ?? "")}?charge=success`,
      cancel_url: `${SITE_URL}/artist/${encodeURIComponent(slug ?? "")}?charge=cancelled`,
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
    track_id,
    amount_usd_cents: track.price_cents,
    commerce_charge_id: charge.code,
    status: "pending",
  });

  if (insertError) {
    if (rateLimited(insertError.message)) {
      return jsonResponse(
        {
          error:
            "You've started several checkouts recently. Try again in an hour.",
        },
        429,
      );
    }
    console.error("Failed to record charge:", insertError);
    return jsonResponse({ error: "Could not record charge" }, 500);
  }

  return jsonResponse({ hosted_url: charge.hosted_url }, 200);
});
