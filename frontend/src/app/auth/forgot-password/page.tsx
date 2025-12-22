"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    try {
      setLoading(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send password reset email");
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Unexpected error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check Your Email</h1>
          <p className="mt-2 text-xs text-slate-300">
            If an account with that email exists, a password reset link has been sent.
          </p>
        </div>

        <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-6">
          <p className="text-xs text-green-200 mb-4">
            We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and click the link to reset your password.
          </p>
          <p className="text-xs text-green-200">
            The link will expire in 1 hour. If you don't see the email, check your spam folder.
          </p>
        </div>

        <p className="text-xs text-slate-400 text-center">
          <a href="/auth/login" className="text-brand-400 hover:text-brand-300">
            Back to Login
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forgot Password</h1>
        <p className="mt-2 text-xs text-slate-300">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="you@example.com"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Remember your password?{" "}
          <a href="/auth/login" className="text-brand-400 hover:text-brand-300">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}

