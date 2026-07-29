import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("COMMERCE_WEBHOOK_SECRET");

async function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// deno-lint-ignore no-explicit-any
async function handleSongCharge(
  supabase: SupabaseClient,
  chargeRow: any,
  eventType: string,
) {
  if (eventType === "charge:failed" || eventType === "charge:delayed") {
    if (chargeRow.status === "pending") {
      await supabase
        .from("crypto_charges")
        .update({ status: "failed" })
        .eq("id", chargeRow.id)
        .eq("status", "pending");
    }
    return;
  }
  if (eventType !== "charge:confirmed" || chargeRow.status === "confirmed") {
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("crypto_charges")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", chargeRow.id)
    .eq("status", "pending")
    .select();
  if (updateError) {
    console.error("Failed to update crypto_charges:", updateError);
    return;
  }
  if (!updated || updated.length === 0) return; // already processed

  const { error } = await supabase.from("song_ownership").insert({
    user_id: chargeRow.user_id,
    track_id: chargeRow.track_id,
    price_cents: chargeRow.amount_usd_cents,
  });
  if (error) console.error("Failed to insert song_ownership:", error);
}

// deno-lint-ignore no-explicit-any
async function handleDeposit(
  supabase: SupabaseClient,
  deposit: any,
  eventType: string,
) {
  if (eventType === "charge:failed" || eventType === "charge:delayed") {
    if (deposit.status === "pending") {
      await supabase
        .from("wallet_deposits")
        .update({ status: "failed" })
        .eq("id", deposit.id)
        .eq("status", "pending");
    }
    return;
  }
  if (eventType !== "charge:confirmed" || deposit.status === "confirmed") {
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("wallet_deposits")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", deposit.id)
    .eq("status", "pending")
    .select();
  if (updateError) {
    console.error("Failed to update wallet_deposits:", updateError);
    return;
  }
  if (!updated || updated.length === 0) return; // already processed

  const { error } = await supabase.rpc("credit_wallet", {
    p_user_id: deposit.user_id,
    p_amount_cents: deposit.amount_usd_cents,
  });
  if (error) console.error("Failed to credit wallet:", error);
}

// deno-lint-ignore no-explicit-any
async function handleSupportPayment(
  supabase: SupabaseClient,
  payment: any,
  eventType: string,
) {
  if (eventType === "charge:failed" || eventType === "charge:delayed") {
    if (payment.status === "pending") {
      await supabase
        .from("support_payments")
        .update({ status: "failed" })
        .eq("id", payment.id)
        .eq("status", "pending");
    }
    return;
  }
  if (eventType !== "charge:confirmed" || payment.status === "confirmed") {
    return;
  }

  const { data: updated, error: updateError } = await supabase
    .from("support_payments")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select();
  if (updateError) {
    console.error("Failed to update support_payments:", updateError);
    return;
  }
  if (!updated || updated.length === 0) return; // already processed

  const { data: tier, error: tierError } = await supabase
    .from("support_tiers")
    .select("billing_frequency")
    .eq("id", payment.tier_id)
    .single();
  if (tierError || !tier) {
    console.error("Failed to look up tier for support payment:", tierError);
    return;
  }

  const { error } = await supabase.rpc("record_support_payment_confirmed", {
    p_user_id: payment.user_id,
    p_artist_id: payment.artist_id,
    p_tier_id: payment.tier_id,
    p_billing_frequency: tier.billing_frequency,
  });
  if (error) console.error("Failed to record support subscription:", error);
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

  // A charge.code is unique across all three flows, so exactly one of these
  // lookups will hit — check which flow this charge belongs to.
  const { data: songCharge } = await supabase
    .from("crypto_charges")
    .select("*")
    .eq("commerce_charge_id", charge.code)
    .maybeSingle();

  if (songCharge) {
    await handleSongCharge(supabase, songCharge, eventType);
    return new Response("ok", { status: 200 });
  }

  const { data: deposit } = await supabase
    .from("wallet_deposits")
    .select("*")
    .eq("commerce_charge_id", charge.code)
    .maybeSingle();

  if (deposit) {
    await handleDeposit(supabase, deposit, eventType);
    return new Response("ok", { status: 200 });
  }

  const { data: supportPayment } = await supabase
    .from("support_payments")
    .select("*")
    .eq("commerce_charge_id", charge.code)
    .maybeSingle();

  if (supportPayment) {
    await handleSupportPayment(supabase, supportPayment, eventType);
    return new Response("ok", { status: 200 });
  }

  console.error("Unknown charge:", charge.code);
  return new Response("unknown charge", { status: 200 });
});
