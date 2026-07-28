import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface TradeRequest {
  artist_id?: string;
  direction?: "positive" | "negative";
  stake_cents?: number;
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

  // Verify the caller's identity with their own JWT-scoped client first —
  // the RPC below is only callable by service_role and trusts its
  // p_user_id argument completely, so this check is what stands between
  // "trade for yourself" and "trade on anyone's wallet."
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Not signed in" }, 401);
  }

  let body: TradeRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { artist_id, direction, stake_cents } = body;
  if (!artist_id) {
    return jsonResponse({ error: "artist_id is required" }, 400);
  }
  if (direction !== "positive" && direction !== "negative") {
    return jsonResponse(
      { error: "direction must be 'positive' (buy) or 'negative' (sell)" },
      400,
    );
  }
  const stakeCents = Number(stake_cents);
  if (!Number.isInteger(stakeCents) || stakeCents < 100) {
    return jsonResponse(
      { error: "stake_cents must be an integer >= 100 ($1 minimum)" },
      400,
    );
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await serviceClient.rpc("open_position", {
    p_user_id: user.id,
    p_artist_id: artist_id,
    p_direction: direction,
    p_stake_cents: stakeCents,
  });

  if (error) {
    const message = error.message.includes("insufficient wallet balance")
      ? "Not enough funds in your wallet — add funds first."
      : error.message.includes("not enough curve depth")
        ? "That sell is too large for the current market — try a smaller amount."
        : "Could not place trade.";
    return jsonResponse({ error: message }, 400);
  }

  return jsonResponse({ position: data }, 200);
});
