import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.js";
import { TradingPanel } from "./TradingPanel.jsx";

// The tradable, continuously-priced Buy/Sell mechanic is a `regulatedOfferings`
// surface (docs/ASSUMPTIONS.md #1) and only renders once the
// regulated_offerings feature flag is on.
export function BackingPanel({ artist, slug }) {
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("feature_flags")
      .select("enabled")
      .eq("key", "regulated_offerings")
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEnabled(!!data?.enabled);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled === null) return null;

  if (!enabled) {
    return (
      <div className="backing-panel">
        <h3>Backing isn't open yet</h3>
        <p className="lede">
          Support for {artist.name} is still being built. Join the waitlist on
          the homepage and we'll let you know when it's ready.
        </p>
      </div>
    );
  }

  return <TradingPanel artist={artist} slug={slug} />;
}
