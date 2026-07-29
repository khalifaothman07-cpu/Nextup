import { formatUSD } from "../lib/format.js";

/**
 * Explainable momentum: the score plus every component that produced it,
 * straight from the daily snapshot — per the "no opaque numbers" rule.
 */
export function MomentumPanel({ momentum }) {
  if (!momentum) return null;
  const volumeBonus = Math.floor(momentum.trade_volume_cents_7d / 1000);
  return (
    <div className="momentum-panel" data-reveal>
      <div className="mp-head">
        MOMENTUM — LAST 7 DAYS <span>recomputed daily</span>
      </div>
      <div className={`mp-score${momentum.score > 0 ? "" : " zero"}`}>
        ▲ {momentum.score}
      </div>
      <div className="mp-rows">
        <div className="mp-row">
          <span>
            {momentum.follows_7d} new follow
            {momentum.follows_7d === 1 ? "" : "s"} × 3
          </span>
          <span className="v">+{momentum.follows_7d * 3}</span>
        </div>
        <div className="mp-row">
          <span>
            {momentum.trades_7d} position
            {momentum.trades_7d === 1 ? "" : "s"} opened × 5
          </span>
          <span className="v">+{momentum.trades_7d * 5}</span>
        </div>
        <div className="mp-row">
          <span>
            {momentum.purchases_7d} song
            {momentum.purchases_7d === 1 ? "" : "s"} purchased × 8
          </span>
          <span className="v">+{momentum.purchases_7d * 8}</span>
        </div>
        <div className="mp-row">
          <span>
            {formatUSD(momentum.trade_volume_cents_7d)} traded (+1 per $10)
          </span>
          <span className="v">+{volumeBonus}</span>
        </div>
      </div>
      <p className="mp-note">
        Computed daily from real platform activity only — follows, trades, and
        song purchases. No streaming stats, no editorial boosts, no seeded
        numbers.
      </p>
    </div>
  );
}
