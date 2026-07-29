import { Link } from "react-router-dom";

export function Breadcrumb({ to = "/", label = "← Back to Nextup" }) {
  return (
    <Link
      to={to}
      className="breadcrumb wrap"
      style={{ display: "inline-flex", marginTop: 28 }}
    >
      {label}
    </Link>
  );
}
