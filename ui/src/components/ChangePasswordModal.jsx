import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { resetPassword } from "../api/auth";

export default function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ oldPassword: "", newPassword: "" });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [success, setSuccess] = useState(false);

  const f = (key) => (e) => setForm((v) => ({ ...v, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: () => resetPassword(form.oldPassword, form.newPassword),
    onSuccess: () => setSuccess(true),
  });

  const valid = form.oldPassword.length > 0 && form.newPassword.length >= 6;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="w-full max-w-sm bg-bg-card border border-border rounded-2xl shadow-modal p-8 flex flex-col items-center gap-4 animate-pop">
          <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/25 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <div className="text-center">
            <p className="font-bold text-txt-primary text-lg">Password updated</p>
            <p className="text-sm text-txt-muted mt-1">Your new password is active.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl text-sm transition-all shadow-glow-sm"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-bg-card border border-border rounded-2xl shadow-modal animate-pop overflow-hidden">
        {/* Accent stripe */}
        <div className="h-[3px] bg-gradient-to-r from-accent via-violet-500 to-accent" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-bold text-txt-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-accent" />
              Change Password
            </h2>
            <button
              onClick={onClose}
              className="text-txt-muted hover:text-txt-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Old password */}
            <div>
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1.5">
                Current Password
              </p>
              <div className="relative">
                <input
                  type={showOld ? "text" : "password"}
                  autoComplete="current-password"
                  value={form.oldPassword}
                  onChange={f("oldPassword")}
                  placeholder="Enter current password"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowOld((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
                >
                  {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <p className="text-xs font-semibold text-txt-muted uppercase tracking-wider mb-1.5">
                New Password
                <span className="normal-case font-normal tracking-normal text-txt-muted/50 ml-1">
                  (min 6 characters)
                </span>
              </p>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.newPassword}
                  onChange={f("newPassword")}
                  placeholder="Enter new password"
                  className="input-base pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-secondary transition-colors"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {mutation.isError && (
            <div className="flex items-center gap-2 mt-4 bg-danger/10 border border-danger/25 text-danger rounded-xl px-3 py-2 text-xs animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {mutation.error?.response?.data?.error ?? "Something went wrong"}
            </div>
          )}

          {/* Forgot password hint */}
          <p className="text-xs text-txt-muted/60 mt-4 text-center">
            Forgot your current password? Contact your admin.
          </p>

          {/* Actions */}
          <div className="flex gap-2 mt-5">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-border-subtle rounded-xl text-sm text-txt-secondary hover:border-border transition-all"
            >
              Cancel
            </button>
            <button
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate()}
              className="flex-1 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-glow-sm flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
