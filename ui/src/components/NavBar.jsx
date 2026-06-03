import { Fingerprint, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

/* ── Shared navbar ─────────────────────────────────────────────────── */
function Navbar({ user, logout }) {
  return (
    <header className="sticky top-0 z-40 bg-bg-base/90 backdrop-blur-md border-b border-border-subtle">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-glow-sm">
            <Fingerprint className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-extrabold text-txt-primary hidden sm:block tracking-tight">
            VIN Decoder
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 ml-2">
          {[
            { to: "/", label: "Search" },

            ...(user?.isAdmin
              ? [
                  { to: "/listings", label: "Listings" },
                  { to: "/history", label: "History" },
                  { to: "/listing-error", label: "Listings Error" },
                  { to: "/admin", label: "Admin" },
                ]
              : []),
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                window.location.pathname === to ||
                (to !== "/" && window.location.pathname.startsWith(to))
                  ? "bg-bg-elevated text-txt-primary"
                  : "text-txt-muted hover:text-txt-primary hover:bg-bg-elevated"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {user && (
            <span className="hidden md:block text-sm font-semibold text-txt-secondary">
              {user.username}
            </span>
          )}
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-sm text-txt-muted hover:text-txt-primary transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
