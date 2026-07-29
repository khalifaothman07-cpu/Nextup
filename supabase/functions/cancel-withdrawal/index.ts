import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface CancelWithdrawalRequest {
  request_id?: string;
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

  let body: CancelWithdrawalRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.request_id) {
    return jsonResponse({ error: "request_id is required" }, 400);
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await serviceClient.rpc("cancel_withdrawal_request", {
    p_user_id: user.id,
    p_request_id: body.request_id,
  });

  if (error) {
    const message = error.message.includes("not found")
      ? "Withdrawal request not found."
      : error.message.includes("no longer pending")
        ? "That request has already been processed."
        : "Could not cancel withdrawal request.";
    return jsonResponse({ error: message }, 400);
  }

  return jsonResponse({ request: data }, 200);
});
