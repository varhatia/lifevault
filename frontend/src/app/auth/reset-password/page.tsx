"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string>("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    }
    // Mark component as ready after we've inspected the URL once
    setIsReady(true);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("Reset token is missing. Please use the link from your email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/auth/login");
      }, 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      setError("Unexpected error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (!isReady) {
    // Avoid flashing an "invalid link" state before we know whether a token exists
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="mt-2 text-xs text-slate-300">Preparing your reset link...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Password Reset Successful!</h1>
          <p className="mt-2 text-xs text-slate-300 text-green-400">
            Your password has been reset successfully. Redirecting to login...
          </p>
        </div>
        <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-6">
          <p className="text-xs text-green-200">
            ✓ Your password has been reset. You can now log in with your new password.
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invalid Reset Link</h1>
          <p className="mt-2 text-xs text-slate-300 text-red-400">
            The reset link is invalid or missing. Please request a new password reset.
          </p>
        </div>
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-6">
          <p className="text-xs text-red-200 mb-4">
            The password reset link may be invalid or expired. Please request a new one.
          </p>
          <a
            href="/auth/forgot-password"
            className="block w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 text-center"
          >
            Request New Reset Link
          </a>
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
        <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
        <p className="mt-2 text-xs text-slate-300">
          Enter your new password below. Make sure it's at least 8 characters long.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="Enter new password"
            required
            minLength={8}
          />
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="Confirm new password"
            required
            minLength={8}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Resetting Password..." : "Reset Password"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          <a href="/auth/login" className="text-brand-400 hover:text-brand-300">
            Back to Login
          </a>
        </p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
          <p className="mt-2 text-xs text-slate-300">Loading...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

