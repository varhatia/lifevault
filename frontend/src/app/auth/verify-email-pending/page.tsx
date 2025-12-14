"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyEmailPendingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState<string>("");
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  // Countdown timer for resend (prevent spam)
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setMessage("Please enter your email address");
      return;
    }

    try {
      setResending(true);
      setMessage("");
      const res = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Verification email sent! Please check your inbox.");
        setCountdown(60); // 60 second cooldown before allowing another resend
      } else {
        setMessage(data.error || "Failed to resend verification email");
      }
    } catch (error) {
      console.error("Resend error:", error);
      setMessage("An error occurred while sending the verification email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check Your Email</h1>
        <p className="mt-2 text-xs text-slate-300">
          Verify your email to complete onboarding and setting up your digital vault.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-brand-600/20 flex items-center justify-center">
              <svg
                className="h-5 w-5 text-brand-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-slate-200">
              We've sent a verification link to <strong className="text-white">{email || "your email"}</strong>
            </p>
            <p className="text-xs text-slate-400">
              Click the link in the email to verify your account and continue setting up your vault.
            </p>
            <div className="rounded-md bg-amber-900/20 border border-amber-800/50 p-3 mt-3">
              <p className="text-xs text-amber-200">
                ⏱️ <strong>Important:</strong> The verification link expires in <strong>30 minutes</strong>. 
                If you don't receive the email, check your spam folder or resend it below.
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <p className="text-xs text-slate-400 mb-3">
            Didn't receive the email?
          </p>
          <form onSubmit={handleResend} className="space-y-3">
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
            <button
              type="submit"
              disabled={resending || (countdown !== null && countdown > 0)}
              className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending
                ? "Sending..."
                : countdown !== null && countdown > 0
                ? `Resend in ${countdown}s`
                : "Resend Verification Email"}
            </button>
          </form>
          {message && (
            <p
              className={`mt-3 text-xs ${
                message.includes("sent") ? "text-green-400" : "text-red-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-xs text-slate-400">
          Already verified?{" "}
          <a href="/auth/login" className="text-brand-400 hover:text-brand-300">
            Log in
          </a>
        </p>
        <p className="text-xs text-slate-500">
          Need help? Check your spam folder or contact support.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Check Your Email</h1>
          <p className="mt-2 text-xs text-slate-300">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}

