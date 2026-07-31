import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface WithdrawRequest {
  amount_cents?: number;
  destination_address?: string;
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

  let body: WithdrawRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const amountCents = Number(body.amount_cents);
  if (!Number.isInteger(amountCents) || amountCents < 1000) {
    return jsonResponse(
      { error: "amount_cents must be an integer >= 1000 ($10 minimum)" },
      400,
    );
  }
  const destination = (body.destination_address ?? "").trim();
  if (!destination) {
    return jsonResponse({ error: "destination_address is required" }, 400);
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await serviceClient.rpc("request_withdrawal", {
    p_user_id: user.id,
    p_amount_cents: amountCents,
    p_destination_address: destination,
  });

  if (error) {
    if (rateLimited(error.message)) {
      return jsonResponse(
        {
          error:
            "You've made several withdrawal requests already. Try again in an hour — the ones you've made are still queued.",
        },
        429,
      );
    }
    const message = error.message.includes("insufficient wallet balance")
      ? "Not enough funds in your wallet."
      : "Could not submit withdrawal request.";
    return jsonResponse({ error: message }, 400);
  }

  return jsonResponse({ request: data }, 200);
});
