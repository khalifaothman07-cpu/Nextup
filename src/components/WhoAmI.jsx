/**
 * What this account is, stated on every page.
 *
 * The founder's question was "how would I differentiate who the admin is and
 * who isn't" — before this, a signed-in admin and a signed-in listener saw an
 * identical header and had to infer their own permissions from which nav links
 * happened to render. Now the account says what it is, and the strongest role
 * wins: Admin > Curator > Artist > Listener.
 */
export function WhoAmI({ roles, memberships }) {
  if (roles === null || memberships === null) return null;

  if (roles.includes("admin"))
    return <span className="whoami is-admin">Admin</span>;
  if (roles.includes("curator"))
    return <span className="whoami is-admin">Curator</span>;
  if (memberships.length)
    return <span className="whoami is-artist">Artist</span>;
  return <span className="whoami">Listener</span>;
}
