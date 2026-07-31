import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const COMMERCE_API_KEY = Deno.env.get("COMMERCE_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://nextup.exchange";
const MIN_DEPOSIT_CENTS = 1000; // $10

interface DepositRequest {
  amount_usd_cents?: number;
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

  let body: DepositRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const amountCents = Number(body.amount_usd_cents);
  if (!Number.isInteger(amountCents) || amountCents < MIN_DEPOSIT_CENTS) {
    return jsonResponse(
      { error: `amount_usd_cents must be an integer >= ${MIN_DEPOSIT_CENTS}` },
      400,
    );
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
      name: "Add funds to Nextup wallet",
      description: "Crypto deposit to your Nextup trading balance.",
      pricing_type: "fixed_price",
      local_price: { amount: (amountCents / 100).toFixed(2), currency: "USD" },
      metadata: { user_id: user.id, purpose: "wallet_deposit" },
      redirect_url: `${SITE_URL}/artist/${encodeURIComponent(body.slug ?? "")}?deposit=success`,
      cancel_url: `${SITE_URL}/artist/${encodeURIComponent(body.slug ?? "")}?deposit=cancelled`,
    }),
  });

  if (!commerceRes.ok) {
    console.error("Coinbase Commerce error:", await commerceRes.text());
    return jsonResponse({ error: "Could not create charge" }, 502);
  }

  const commerceData = await commerceRes.json();
  const charge = commerceData.data;

  const { error: insertError } = await supabase.from("wallet_deposits").insert({
    user_id: user.id,
    amount_usd_cents: amountCents,
    commerce_charge_id: charge.code,
    status: "pending",
  });

  if (insertError) {
    if (rateLimited(insertError.message)) {
      return jsonResponse(
        {
          error:
            "You've started several deposits recently. Try again in an hour.",
        },
        429,
      );
    }
    console.error("Failed to record deposit:", insertError);
    return jsonResponse({ error: "Could not record deposit" }, 500);
  }

  return jsonResponse({ hosted_url: charge.hosted_url }, 200);
});
