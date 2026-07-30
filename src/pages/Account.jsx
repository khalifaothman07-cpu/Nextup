import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient.js";
import { formatUSD } from "../lib/format.js";
import { fetchLatestMomentum } from "../lib/momentum.js";
import { useSession } from "../context/SessionContext.jsx";
import { ArtistCard } from "../components/ArtistCard.jsx";
import { Breadcrumb } from "../components/Breadcrumb.jsx";
import { PageHero } from "../components/PageHero.jsx";
import { useReveal } from "../hooks/useReveal.js";
import { usePageTitle } from "../hooks/usePageTitle.js";

export function Account() {
  usePageTitle("Account — Nextup");
  const { session, loading } = useSession();

  const [data, setData] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [nameStatus, setNameStatus] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [cancelBusyId, setCancelBusyId] = useState(null);
  const [actionStatus, setActionStatus] = useState("");

  const load = useCallback(async () => {
    if (!session) {
      setData(null);
      return;
    }
    const uid = session.user.id;
    const [
      profileRes,
      rolesRes,
      membershipsRes,
      followsRes,
      walletRes,
      withdrawalsRes,
      positionsRes,
      ownedRes,
      artistsRes,
      momentumMap,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("artist_members")
        .select("artist_id, role")
        .eq("user_id", uid),
      supabase
        .from("artist_follows")
        .select("artist_id, created_at")
        .eq("user_id", uid),
      supabase
        .from("wallets")
        .select("balance_cents")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("withdrawal_requests")
        .select("id, amount_cents, destination_address, status, requested_at")
        .eq("user_id", uid)
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
      supabase
        .from("positions")
        .select(
          "id, artist_id, direction, stake_cents, entry_price_cents, opened_at",
        )
        .eq("user_id", uid)
        .eq("status", "open")
        .order("opened_at", { ascending: false }),
      supabase
        .from("song_ownership")
        .select("track_id, price_cents, created_at")
        .eq("user_id", uid),
      supabase
        .from("artists")
        .select(
          "id, slug, name, genre, accent_from, accent_to, follower_count, sort_order",
        )
        .order("sort_order", { ascending: true }),
      fetchLatestMomentum(),
    ]);

    const ownedTrackIds = (ownedRes.data ?? []).map((o) => o.track_id);
    const { data: ownedTracks } = ownedTrackIds.length
      ? await supabase
          .from("tracks")
          .select("id, title, artist_id")
          .in("id", ownedTrackIds)
      : { data: [] };

    const artistById = new Map((artistsRes.data ?? []).map((a) => [a.id, a]));

    setDisplayName(profileRes.data?.display_name ?? "");
    setData({
      roles: (rolesRes.data ?? []).map((r) => r.role),
      memberships: (membershipsRes.data ?? []).map((m) => ({
        ...m,
        artist: artistById.get(m.artist_id),
      })),
      follows: (followsRes.data ?? [])
        .map((f) => artistById.get(f.artist_id))
        .filter(Boolean),
      balance: walletRes.data?.balance_cents ?? 0,
      withdrawals: withdrawalsRes.data ?? [],
      positions: (positionsRes.data ?? []).map((p) => ({
        ...p,
        artist: artistById.get(p.artist_id),
      })),
      owned: (ownedTracks ?? []).map((t) => ({
        ...t,
        artist: artistById.get(t.artist_id),
        purchase: (ownedRes.data ?? []).find((o) => o.track_id === t.id),
      })),
      momentum: momentumMap,
    });
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useReveal([data]);

  async function saveDisplayName(e) {
    e.preventDefault();
    if (!session) return;
    setSavingName(true);
    setNameStatus("Saving…");
    const { error } = await supabase.from("profiles").upsert({
      id: session.user.id,
      display_name: displayName.trim() || null,
    });
    setSavingName(false);
    setNameStatus(error ? "Could not save — try again." : "Saved.");
  }

  async function cancelWithdrawal(requestId) {
    setCancelBusyId(requestId);
    const { data: res, error } = await supabase.functions.invoke(
      "cancel-withdrawal",
      { body: { request_id: requestId } },
    );
    setCancelBusyId(null);
    if (error || !res?.request) {
      setActionStatus(res?.error ?? "Couldn't cancel — try again.");
      return;
    }
    setActionStatus("Withdrawal cancelled — balance returned.");
    await load();
  }

  if (loading) return <main />;

  if (!session) {
    return (
      <main>
        <Breadcrumb />
        <PageHero
          eyebrow="Account"
          title="Sign in to see your account."
          style={{ borderBottom: "none" }}
        >
          <p>
            Use the sign-in form at the top of the page — we'll email you a
            magic link, no password needed. Your follows, wallet, positions, and
            owned songs all live here once you're in.
          </p>
        </PageHero>
      </main>
    );
  }

  const isSupporter =
    data && (data.positions.length > 0 || data.owned.length > 0);

  return (
    <main className="app-shell">
      <Breadcrumb />

      <PageHero eyebrow="Account" title="Your Nextup.">
        <p>{session.user.email}</p>
      </PageHero>

      {!data ? (
        <section style={{ borderBottom: "none" }}>
          <div className="wrap">
            <p className="muted">Loading your account…</p>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="wrap">
              <div className="two-col">
                <div data-reveal>
                  <div className="section-head" style={{ marginBottom: 24 }}>
                    <div className="eyebrow">Profile</div>
                    <h2 style={{ fontSize: 26, marginTop: 12 }}>
                      Display name
                    </h2>
                    <p style={{ marginTop: 10 }}>
                      Shown where you appear publicly (early-backer credits,
                      future community features). Leave blank to stay anonymous.
                    </p>
                  </div>
                  <form
                    className="auth-form"
                    onSubmit={saveDisplayName}
                    style={{ maxWidth: 380 }}
                  >
                    <input
                      className="auth-input"
                      style={{ flex: 1, width: "auto" }}
                      type="text"
                      maxLength={40}
                      placeholder="Display name"
                      aria-label="Display name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="auth-btn"
                      disabled={savingName}
                    >
                      Save
                    </button>
                  </form>
                  <div className="pv-status" style={{ marginTop: 10 }}>
                    <span className="follow-note">{nameStatus}</span>
                  </div>

                  <div
                    className="section-head"
                    style={{ margin: "36px 0 16px" }}
                  >
                    <div className="eyebrow">Roles</div>
                  </div>
                  <div className="role-chips">
                    <span className="role-chip">Listener</span>
                    {isSupporter && (
                      <span className="role-chip on">Supporter</span>
                    )}
                    {data.roles.map((r) => (
                      <span key={r} className="role-chip on">
                        {r}
                      </span>
                    ))}
                    {data.memberships.map((m) => (
                      <span
                        key={`${m.artist_id}-${m.role}`}
                        className="role-chip on"
                      >
                        {m.artist?.name ?? "Artist"} ·{" "}
                        {m.role.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  <p className="results-note" style={{ marginTop: 14 }}>
                    Supporter status is earned by holding a position or owning a
                    song — it isn't assigned, it's derived from what you've
                    actually done.
                  </p>
                </div>

                <div data-reveal>
                  <div className="section-head" style={{ marginBottom: 24 }}>
                    <div className="eyebrow">Wallet</div>
                    <h2 style={{ fontSize: 26, marginTop: 12 }}>
                      {formatUSD(data.balance)}
                    </h2>
                    <p style={{ marginTop: 10 }}>
                      Fund it or withdraw from any artist's backing panel — the
                      balance is shared across all of Nextup.
                    </p>
                  </div>
                  <div className="positions-list">
                    {data.withdrawals.map((w) => (
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
                          onClick={() => cancelWithdrawal(w.id)}
                        >
                          {cancelBusyId === w.id ? "Cancelling…" : "Cancel"}
                        </button>
                      </div>
                    ))}
                    {!data.withdrawals.length && (
                      <p className="muted" style={{ fontSize: 14 }}>
                        No pending withdrawals.
                      </p>
                    )}
                  </div>
                  {actionStatus && (
                    <div className="action-status">{actionStatus}</div>
                  )}

                  <div
                    className="section-head"
                    style={{ margin: "36px 0 16px" }}
                  >
                    <div className="eyebrow">Open positions</div>
                  </div>
                  <div className="positions-list">
                    {data.positions.map((p) => (
                      <div className="position-row" key={p.id}>
                        <div>
                          <div className="track-title">
                            {p.direction === "positive" ? "Buy" : "Sell"} ·{" "}
                            {p.artist?.name ?? "Artist"} ·{" "}
                            {formatUSD(p.stake_cents)}
                          </div>
                          <div className="track-price">
                            Entry {formatUSD(p.entry_price_cents)}
                          </div>
                        </div>
                        {p.artist && (
                          <Link
                            className="track-buy"
                            style={{ textDecoration: "none" }}
                            to={`/artist/${encodeURIComponent(p.artist.slug)}`}
                          >
                            Manage
                          </Link>
                        )}
                      </div>
                    ))}
                    {!data.positions.length && (
                      <p className="muted" style={{ fontSize: 14 }}>
                        No open positions — find someone worth backing on{" "}
                        <Link to="/discover">Discover</Link>.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className="wrap">
              <div className="section-head" data-reveal>
                <div className="eyebrow">Your artists</div>
                <h2>Following</h2>
              </div>
              {data.follows.length ? (
                <div className="discover-grid" data-reveal>
                  {data.follows.map((a) => (
                    <ArtistCard
                      key={a.id}
                      artist={a}
                      momentum={data.momentum.get(a.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted" data-reveal>
                  You're not following anyone yet —{" "}
                  <Link to="/discover">browse the roster</Link> and hit Follow
                  on an artist page.
                </p>
              )}
            </div>
          </section>

          <section style={{ borderBottom: "none" }}>
            <div className="wrap">
              <div className="section-head" data-reveal>
                <div className="eyebrow">Side B</div>
                <h2>Songs you own</h2>
              </div>
              {data.owned.length ? (
                <ol className="tracks" data-reveal style={{ maxWidth: 640 }}>
                  {data.owned.map((t, i) => (
                    <li className="track" key={t.id}>
                      <span className="track-n">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="track-title">{t.title}</span>
                      <span className="track-price">
                        {t.artist?.name ?? "Artist"} ·{" "}
                        {formatUSD(t.purchase?.price_cents ?? 0)}
                      </span>
                      <span className="track-owned">Owned</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="muted" data-reveal>
                  No songs owned yet — every artist page lists theirs with a
                  flat price.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
