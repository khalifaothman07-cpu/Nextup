import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

interface ClosePositionRequest {
  position_id?: string;
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

  let body: ClosePositionRequest;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.position_id) {
    return jsonResponse({ error: "position_id is required" }, 400);
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // close_position itself re-checks `user_id = p_user_id` on the row, so a
  // caller can never close someone else's position by guessing an id.
  const { data, error } = await serviceClient.rpc("close_position", {
    p_user_id: user.id,
    p_position_id: body.position_id,
  });

  if (error) {
    const message = error.message.includes("position not found")
      ? "Position not found."
      : error.message.includes("already closed")
        ? "That position is already closed."
        : "Could not close position.";
    return jsonResponse({ error: message }, 400);
  }

  return jsonResponse({ position: data }, 200);
});
