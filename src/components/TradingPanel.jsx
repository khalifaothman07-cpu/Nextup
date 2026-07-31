import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD } from "../lib/format.js";
import { friendlyError } from "../lib/errors.js";
import { useSession } from "../context/SessionContext.jsx";

const AMOUNT_CHIPS = [
  { cents: 500, label: "$5" },
  { cents: 2000, label: "$20" },
  { cents: 10000, label: "$100" },
];

export function TradingPanel({ artist, slug }) {
  const { session } = useSession();
  const [priceCents, setPriceCents] = useState(null);
  const [direction, setDirection] = useState("positive");
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [positions, setPositions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [tradeStatus, setTradeStatus] = useState("");
  const [tradeBusy, setTradeBusy] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState(null);
  const [closeBusyId, setCloseBusyId] = useState(null);
  const [mode, setMode] = useState(null); // null | "deposit" | "withdraw"
  const [formAmount, setFormAmount] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("artist_curves")
      .select("supply, base_price_cents, k")
      .eq("artist_id", artist.id)
      .single()
      .then(({ data: curve }) => {
        if (cancelled || !curve) return;
        setPriceCents(
          Math.round(curve.base_price_cents * Math.exp(curve.k * curve.supply)),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [artist.id]);

  async function refreshWallet() {
    if (!session) {
      setWallet(null);
      setPositions([]);
      setWithdrawals([]);
      return;
    }
    const { data: w } = await supabase
      .from("wallets")
      .select("balance_cents")
      .eq("user_id", session.user.id)
      .maybeSingle();
    setWallet(w?.balance_cents ?? 0);

    const { data: withdrawalRows } = await supabase
      .from("withdrawal_requests")
      .select("id, amount_cents, destination_address, status, requested_at")
      .eq("user_id", session.user.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    setWithdrawals(withdrawalRows ?? []);

    const { data: positionRows } = await supabase
      .from("positions")
      .select("id, direction, units, stake_cents, entry_price_cents, status")
      .eq("user_id", session.user.id)
      .eq("artist_id", artist.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false });
    setPositions(positionRows ?? []);
  }

  useEffect(() => {
    refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, artist.id]);

  /**
   * Deposits and withdrawals were window.prompt() chains. Two native dialogs
   * to move real money, with a crypto destination address typed into a box
   * that shows no validation and cannot be reviewed before submitting — a
   * mistyped address there is unrecoverable. They are inline forms now, with
   * the minimum stated up front, the parsed amount echoed back, and the
   * address visible while you check it.
   */
  function openForm(next) {
    setMode(next);
    setFormAmount("");
    setFormAddress("");
    setFormError("");
  }

  function parsedCents() {
    const n = Number(formAmount);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 100);
  }

  async function submitDeposit(e) {
    e.preventDefault();
    const cents = parsedCents();
    if (cents === null) return setFormError("Enter an amount in dollars.");
    if (cents < 1000) return setFormError("Minimum deposit is $10.");
    setFormBusy(true);
    setFormError("");
    const { data, error } = await supabase.functions.invoke("deposit", {
      body: { amount_usd_cents: cents, slug },
    });
    setFormBusy(false);
    if (error || !data?.hosted_url) {
      setFormError(
        friendlyError(
          error,
          data?.error ?? "Couldn't start the deposit — try again.",
        ),
      );
      return;
    }
    window.location.href = data.hosted_url;
  }

  async function submitWithdrawal(e) {
    e.preventDefault();
    const cents = parsedCents();
    if (cents === null) return setFormError("Enter an amount in dollars.");
    if (cents < 1000) return setFormError("Minimum withdrawal is $10.");
    if (cents > (wallet ?? 0))
      return setFormError(
        `That's more than your balance of ${formatUSD(wallet ?? 0)}.`,
      );
    const destination = formAddress.trim();
    if (!destination) return setFormError("Enter a destination address.");
    setFormBusy(true);
    setFormError("");
    const { data, error } = await supabase.functions.invoke("withdraw", {
      body: { amount_cents: cents, destination_address: destination },
    });
    setFormBusy(false);
    if (error || !data?.request) {
      setFormError(
        friendlyError(
          error,
          data?.error ?? "Couldn't submit that — try again.",
        ),
      );
      return;
    }
    setMode(null);
    setTradeStatus(
      `Withdrawal requested — ${formatUSD(cents)} debited and pending.`,
    );
    await refreshWallet();
  }

  async function handleCancelWithdrawal(requestId) {
    setCancelBusyId(requestId);
    const { data, error } = await supabase.functions.invoke(
      "cancel-withdrawal",
      { body: { request_id: requestId } },
    );
    setCancelBusyId(null);
    if (error || !data?.request) {
      setTradeStatus(data?.error ?? "Couldn't cancel — try again.");
      return;
    }
    setTradeStatus("Withdrawal cancelled — balance returned.");
    await refreshWallet();
  }

  async function handleClosePosition(positionId) {
    setCloseBusyId(positionId);
    const { data, error } = await supabase.functions.invoke("close-position", {
      body: { position_id: positionId },
    });
    setCloseBusyId(null);
    if (error || !data?.position) {
      setTradeStatus(
        data?.error ?? "Couldn't close that position — try again.",
      );
      return;
    }
    setTradeStatus("Position closed — proceeds returned to your wallet.");
    await refreshWallet();
  }

  async function handleTrade() {
    if (!session) {
      setTradeStatus("Sign in at the top of the page first.");
      return;
    }
    if (!selectedAmount) {
      setTradeStatus("Pick an amount first.");
      return;
    }
    setTradeBusy(true);
    setTradeStatus("Placing order…");
    const { data, error } = await supabase.functions.invoke("trade", {
      body: {
        artist_id: artist.id,
        direction,
        stake_cents: selectedAmount,
      },
    });
    setTradeBusy(false);
    setTradeStatus(
      error
        ? friendlyError(
            error,
            data?.error ?? "Couldn't place that trade — try again.",
          )
        : `${direction === "positive" ? "Bought" : "Sold"} ${formatUSD(selectedAmount)} of ${artist.name}.`,
    );
    if (!error) await refreshWallet();
  }

  return (
    <>
      <div className="backing-panel">
        {/* Price first. It is the reason anyone opens this panel, and it was
            buried under two lines of explanation. */}
        <div className="bp-price">
          <span className="bp-label">Live price</span>
          <div className="price-ticker">
            {priceCents != null ? formatUSD(priceCents) : "—"}
          </div>
        </div>

        {session && (
          <div className="wallet-bar">
            <span>
              <span className="bp-label">Wallet</span>
              {formatUSD(wallet ?? 0)}
            </span>
            <span className="bp-wallet-actions">
              <button
                type="button"
                className="wallet-add-btn"
                onClick={() => openForm("deposit")}
              >
                Add funds
              </button>
              <button
                type="button"
                className="wallet-add-btn"
                onClick={() => openForm("withdraw")}
              >
                Withdraw
              </button>
            </span>
          </div>
        )}

        {mode && (
          <form
            className="bp-form"
            onSubmit={mode === "deposit" ? submitDeposit : submitWithdrawal}
          >
            <label>
              <span className="bp-label">
                {mode === "deposit" ? "Add (USD)" : "Withdraw (USD)"} · min $10
              </span>
              <input
                type="number"
                inputMode="decimal"
                min="10"
                step="0.01"
                autoFocus
                placeholder="25.00"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
              />
            </label>

            {mode === "withdraw" && (
              <label>
                <span className="bp-label">Destination address</span>
                <input
                  type="text"
                  spellCheck="false"
                  autoComplete="off"
                  placeholder="0x…"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                />
              </label>
            )}

            <p className="bp-note">
              {mode === "deposit"
                ? "Opens a crypto checkout. Your balance updates once the payment confirms on-chain."
                : "Debits your balance now and queues a payout. Sending is a manual step, so it isn't instant — and we cannot recover funds sent to a wrong address, so check it."}
            </p>

            {formError && <div className="action-status err">{formError}</div>}

            <div className="bp-form-actions">
              <button type="submit" className="back-btn" disabled={formBusy}>
                {formBusy
                  ? "Working…"
                  : mode === "deposit"
                    ? "Continue to checkout"
                    : "Request withdrawal"}
              </button>
              <button
                type="button"
                className="bp-cancel"
                onClick={() => setMode(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {!mode && (
          <>
            <div
              className="direction-toggle"
              role="group"
              aria-label="Direction"
            >
              <button
                type="button"
                className={`direction-btn${direction === "positive" ? " active" : ""}`}
                aria-pressed={direction === "positive"}
                onClick={() => setDirection("positive")}
              >
                Buy
              </button>
              <button
                type="button"
                className={`direction-btn${direction === "negative" ? " active" : ""}`}
                aria-pressed={direction === "negative"}
                onClick={() => setDirection("negative")}
              >
                Sell
              </button>
            </div>

            <div className="amount-row">
              {AMOUNT_CHIPS.map((chip) => (
                <button
                  key={chip.cents}
                  type="button"
                  className={`amount-chip${selectedAmount === chip.cents ? " active" : ""}`}
                  aria-pressed={selectedAmount === chip.cents}
                  onClick={() => setSelectedAmount(chip.cents)}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="back-btn bp-submit"
              disabled={tradeBusy}
              onClick={handleTrade}
            >
              {session
                ? direction === "positive"
                  ? `Buy ${selectedAmount ? formatUSD(selectedAmount) : ""}`.trim()
                  : `Sell ${selectedAmount ? formatUSD(selectedAmount) : ""}`.trim()
                : "Sign in to trade"}
            </button>
          </>
        )}
        <div className="action-status">{tradeStatus}</div>

        <p className="bp-note">
          The price moves with demand. Paid from your Nextup wallet, funded by
          crypto. You can be wrong and lose the stake.
        </p>
      </div>

      <div className="positions-list">
        {withdrawals.map((w) => (
          <div className="position-row" key={w.id}>
            <div>
              <div className="track-title">
                Withdrawal · {formatUSD(w.amount_cents)}
              </div>
              <div className="track-price">
                Pending — to {w.destination_address.slice(0, 10)}…
              </div>
            </div>
            <button
              type="button"
              className="track-buy"
              disabled={cancelBusyId === w.id}
              onClick={() => handleCancelWithdrawal(w.id)}
            >
              {cancelBusyId === w.id ? "Cancelling…" : "Cancel"}
            </button>
          </div>
        ))}
      </div>

      <div className="positions-list">
        {positions.map((p) => (
          <div className="position-row" key={p.id}>
            <div>
              <div className="track-title">
                {p.direction === "positive" ? "Buy" : "Sell"} ·{" "}
                {formatUSD(p.stake_cents)}
              </div>
              <div className="track-price">
                Entry {formatUSD(p.entry_price_cents)}
              </div>
            </div>
            <button
              type="button"
              className="track-buy"
              disabled={closeBusyId === p.id}
              onClick={() => handleClosePosition(p.id)}
            >
              {closeBusyId === p.id ? "Closing…" : "Close"}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
