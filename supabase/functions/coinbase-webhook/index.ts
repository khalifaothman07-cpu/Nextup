import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("COMMERCE_WEBHOOK_SECRET");

async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!WEBHOOK_SECRET) {
    console.error("COMMERCE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get("X-CC-Webhook-Signature");
  if (!(await verifySignature(rawBody, signature, WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const eventType = payload?.event?.type;
  const charge = payload?.event?.data;

  if (!charge?.code) {
    return new Response("ignored", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: chargeRow, error: chargeError } = await supabase
    .from("crypto_charges")
    .select("*")
    .eq("commerce_charge_id", charge.code)
    .single();

  if (chargeError || !chargeRow) {
    console.error("Unknown charge:", charge.code);
    return new Response("unknown charge", { status: 200 });
  }

  if (eventType === "charge:failed" || eventType === "charge:delayed") {
    if (chargeRow.status === "pending") {
      await supabase.from("crypto_charges").update({ status: "failed" }).eq("id", chargeRow.id).eq(
        "status",
        "pending",
      );
    }
    return new Response("ok", { status: 200 });
  }

  if (eventType !== "charge:confirmed") {
    return new Response("ignored", { status: 200 });
  }

  const { data: updated, error: updateError } = await supabase
    .from("crypto_charges")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", chargeRow.id)
    .eq("status", "pending")
    .select();

  if (updateError) {
    console.error("Failed to update charge:", updateError);
    return new Response("update failed", { status: 500 });
  }

  if (!updated || updated.length === 0) {
    // Already processed by a concurrent webhook delivery.
    return new Response("already processed", { status: 200 });
  }

  if (chargeRow.kind === "backing") {
    const { error } = await supabase.from("backings").insert({
      user_id: chargeRow.user_id,
      artist_id: chargeRow.artist_id,
      amount_cents: chargeRow.amount_usd_cents,
    });
    if (error) console.error("Failed to insert backing:", error);
  } else {
    const { error } = await supabase.from("song_ownership").insert({
      user_id: chargeRow.user_id,
      track_id: chargeRow.track_id,
      price_cents: chargeRow.amount_usd_cents,
    });
    if (error) console.error("Failed to insert song_ownership:", error);
  }

  return new Response("ok", { status: 200 });
});
