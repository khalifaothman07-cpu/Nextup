import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD } from "../lib/format.js";
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

  async function handleAddFunds() {
    const amount = window.prompt(
      "Add how many US dollars (paid in crypto)? Minimum $10.",
    );
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(cents) || cents < 1000) return;
    const { data, error } = await supabase.functions.invoke("deposit", {
      body: { amount_usd_cents: cents, slug },
    });
    if (error || !data?.hosted_url) {
      alert(data?.error ?? "Could not start deposit — try again.");
      return;
    }
    window.location.href = data.hosted_url;
  }

  async function handleWithdraw() {
    const amount = window.prompt(
      "Withdraw how many US dollars? Minimum $10. This submits a request — it's paid out manually, not instantly.",
    );
    const cents = Math.round(Number(amount) * 100);
    if (!Number.isInteger(cents) || cents < 1000) return;
    const destination = window.prompt(
      "Destination crypto address to receive the funds:",
    );
    if (!destination || !destination.trim()) return;
    const { data, error } = await supabase.functions.invoke("withdraw", {
      body: { amount_cents: cents, destination_address: destination.trim() },
    });
    if (error || !data?.request) {
      alert(data?.error ?? "Could not submit withdrawal — try again.");
      return;
    }
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
      alert(data?.error ?? "Could not cancel — try again.");
      return;
    }
    await refreshWallet();
  }

  async function handleClosePosition(positionId) {
    setCloseBusyId(positionId);
    const { data, error } = await supabase.functions.invoke("close-position", {
      body: { position_id: positionId },
    });
    setCloseBusyId(null);
    if (error || !data?.position) {
      alert(data?.error ?? "Could not close position — try again.");
      return;
    }
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
        ? (data?.error ?? "Could not place trade — try again.")
        : `${direction === "positive" ? "Bought" : "Sold"} ${formatUSD(selectedAmount)} of ${artist.name}.`,
    );
    if (!error) await refreshWallet();
  }

  return (
    <>
      <div className="backing-panel">
        <h3>Put a stake behind their career</h3>
        <p className="lede">
          A live price that moves with demand — buy if you think {artist.name}{" "}
          is heating up, sell if you think the opposite. Paid from your Nextup
          wallet, funded by crypto.
        </p>
        <div className="price-ticker">
          {priceCents != null ? formatUSD(priceCents) : "—"}
        </div>
        <div className="wallet-bar">
          {session ? (
            <>
              <span>Wallet: {formatUSD(wallet ?? 0)}</span>
              <span style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="wallet-add-btn"
                  onClick={handleAddFunds}
                >
                  Add funds
                </button>
                <button
                  type="button"
                  className="wallet-add-btn"
                  onClick={handleWithdraw}
                >
                  Withdraw
                </button>
              </span>
            </>
          ) : null}
        </div>
        <div className="direction-toggle">
          <button
            type="button"
            className={`direction-btn${direction === "positive" ? " active" : ""}`}
            onClick={() => setDirection("positive")}
          >
            Buy
          </button>
          <button
            type="button"
            className={`direction-btn${direction === "negative" ? " active" : ""}`}
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
              onClick={() => setSelectedAmount(chip.cents)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="back-btn"
          disabled={tradeBusy}
          onClick={handleTrade}
        >
          {session
            ? direction === "positive"
              ? "Buy"
              : "Sell"
            : "Sign in to trade"}
        </button>
        <div className="action-status">{tradeStatus}</div>
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
