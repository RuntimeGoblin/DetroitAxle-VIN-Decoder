import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Clock, ArrowRight, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import Navbar from "../components/NavBar";

const VIN_LEN = 17;
const STORAGE_KEY = "vin_history";

const getHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
};

const pushHistory = (vin) => {
  try {
    const next = [vin, ...getHistory().filter((v) => v !== vin)].slice(0, 8);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable or quota exceeded — silently skip persistence
  }
};

const removeHistory = (vin) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(getHistory().filter((v) => v !== vin)),
    );
  } catch {
    // storage unavailable — silently skip
  }
};

export default function SearchPage() {
  const [raw, setRaw] = useState("");
  const [history, setHistory] = useState(getHistory);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e) =>
    setRaw(
      e.target.value
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, VIN_LEN),
    );

  const doSearch = (vin) => {
    const target = vin ?? raw;
    if (target.length !== VIN_LEN) return;
    pushHistory(target);
    setHistory(getHistory());
    navigate(`/v/${target}`);
  };

  const clearItem = (vin, e) => {
    e.stopPropagation();
    removeHistory(vin);
    setHistory(getHistory());
  };

  const progress = (raw.length / VIN_LEN) * 100;
  const isReady = raw.length === VIN_LEN;

  return (
    <div className="min-h-screen bg-bg-base flex flex-col relative overflow-hidden">
      {/* ── Background grid ─────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(79,142,247,0.6) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(79,142,247,0.6) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }}
      />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <Navbar user={user} logout={logout} />

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-xl animate-slide-up">
          {/* Compact title */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold text-txt-primary">
              Decode any vehicle
            </h1>
            <p className="text-txt-muted text-sm mt-1.5">
              Enter a 17-character VIN to pull full build specs
            </p>
          </div>

          {/* ── Search card ───────────────────────────────────────── */}
          <div className="bg-bg-card border border-border rounded-2xl shadow-card overflow-hidden">
            {/* Input */}
            <div className="px-5 pt-5 pb-4 flex items-center gap-3">
              <Search
                className={`w-5 h-5 shrink-0 transition-colors duration-200 ${isReady ? "text-success" : "text-txt-muted"}`}
              />
              <input
                ref={inputRef}
                value={raw}
                onChange={handleChange}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="e.g. 1HGBH41JXMN109186"
                spellCheck={false}
                className="flex-1 bg-transparent outline-none font-mono text-lg tracking-widest
                           text-txt-primary
                           placeholder:text-txt-muted/40 placeholder:font-sans
                           placeholder:text-sm placeholder:tracking-normal"
              />
              {raw && (
                <button
                  onClick={() => setRaw("")}
                  className="text-txt-muted hover:text-txt-secondary transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Progress bar — flush to the divider */}
            <div className="h-[3px] bg-bg-elevated">
              <div
                className={`h-full rounded-full transition-all duration-300 ${isReady ? "bg-success" : "bg-accent"}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Footer row: char count + decode button */}
            <div className="px-5 py-3.5 flex items-center justify-between gap-4 bg-bg-elevated/40">
              <div className="flex items-center gap-3">
                <span className="text-xs text-txt-muted tabular-nums">
                  {raw.length} / {VIN_LEN} chars
                </span>
                {isReady && (
                  <span className="flex items-center gap-1 text-xs text-success font-semibold">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" />
                    Ready
                  </span>
                )}
              </div>
              <button
                disabled={!isReady}
                onClick={() => doSearch()}
                className="flex items-center gap-2 px-5 py-2 bg-accent hover:bg-accent-hover
                           disabled:opacity-30 disabled:cursor-not-allowed
                           text-white text-sm font-semibold rounded-xl
                           transition-all shadow-glow-sm"
              >
                Decode
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Recent searches — horizontal chips ────────────────── */}
          {history.length > 0 && (
            <div className="mt-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-2.5">
                <Clock className="w-3.5 h-3.5 text-txt-muted" />
                <span className="text-xs font-semibold text-txt-muted uppercase tracking-widest">
                  Recent
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((v) => (
                  <button
                    key={v}
                    onClick={() => doSearch(v)}
                    className="group flex items-center gap-2 px-3 py-1.5
                               bg-bg-card border border-border-subtle hover:border-accent/40
                               rounded-lg transition-all"
                  >
                    <span className="font-mono text-xs text-txt-secondary group-hover:text-txt-primary transition-colors tracking-widest">
                      {v}
                    </span>
                    <span
                      role="button"
                      onClick={(e) => clearItem(v, e)}
                      className="text-txt-muted hover:text-danger transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-txt-muted/40 mt-7">
            Powered by auto.dev · valid 17-character VINs only
          </p>
        </div>
      </main>
    </div>
  );
}
