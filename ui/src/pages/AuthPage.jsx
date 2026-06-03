import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Fingerprint,
  Mail,
  Lock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { login as apiLogin } from "../api/auth";
import ThemeToggle from "../components/ThemeToggle";

const FEATURES = [
  {
    title: "Instant VIN decoding",
    desc: "Powered by auto.dev for live build data",
  },
  {
    title: "Collaborative notes",
    desc: "Free-text and part-number annotations",
  },
  {
    title: "Part categories",
    desc: "Organise findings by system or component",
  },
];

export default function AuthPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const field = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiLogin(form.email, form.password);
      /* res.data is already unwrapped by the Axios interceptor:
         { token: "...", refresh_token: "..." } */
      login(res.data.token, res.data.refresh_token, null);
      navigate("/");
    } catch (err) {
      /* 401 = wrong credentials — show a clean message */
      if (err.response?.status === 401) {
        setError("Invalid email or password");
      } else {
        setError(
          err.response?.data?.error ?? err.message ?? "Something went wrong",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base flex overflow-hidden">
      {/* ══ LEFT — branding panel ══════════════════════════════════ */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-[48%] relative">
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.045] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(79,142,247,0.6) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(79,142,247,0.6) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shadow-glow">
              <Fingerprint className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold text-txt-primary tracking-tight">
              VIN Decoder
            </span>
          </div>

          <h1 className="text-5xl font-extrabold text-txt-primary leading-[1.12] mb-5">
            Every VIN tells
            <br />a <span className="text-accent">story.</span>
          </h1>

          <p className="text-txt-secondary text-[15px] leading-relaxed mb-12">
            Decode, annotate, and share vehicle build data with your team — all
            in one clean interface.
          </p>

          <ul className="space-y-5">
            {FEATURES.map(({ title, desc }) => (
              <li key={title} className="flex items-start gap-3.5">
                <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-txt-primary leading-snug">
                    {title}
                  </p>
                  <p className="text-xs text-txt-muted mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ══ RIGHT — form panel ═════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 relative">
        {/* Theme toggle */}
        <div className="absolute top-4 right-5">
          <ThemeToggle />
        </div>

        {/* Mobile logo */}
        <div className="absolute top-5 left-6 lg:hidden flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-txt-primary text-sm">
            VIN Decoder
          </span>
        </div>

        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-bg-card border border-border rounded-2xl p-8 shadow-card">
            {/* Heading */}
            <div className="mb-7">
              <h2 className="text-2xl font-bold text-txt-primary">
                Welcome back
              </h2>
              <p className="text-sm text-txt-secondary mt-1">
                Sign in to access the VIN decoder
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1.5">
                  Email
                </p>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted pointer-events-none" />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={field("email")}
                    placeholder="you@example.com"
                    className="input-base pl-10"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1.5">
                  Password
                </p>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted pointer-events-none" />
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={field("password")}
                    placeholder="••••••••"
                    className="input-base pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
                  >
                    {showPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 bg-danger/10 border border-danger/25 text-danger rounded-xl px-4 py-3 text-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-accent hover:bg-accent-hover
                           disabled:opacity-50 disabled:cursor-not-allowed
                           text-white font-semibold py-3 rounded-xl text-sm
                           transition-all flex items-center justify-center gap-2 shadow-glow-sm"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Sign In
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
