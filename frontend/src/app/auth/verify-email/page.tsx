"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<"verifying" | "success" | "error" | "idle">("idle");
  const [message, setMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = searchParams.get("token");
    const emailParam = searchParams.get("email");
    
    if (emailParam) {
      setEmail(emailParam);
    }
    
    if (token) {
      verifyEmail(token);
    } else {
      setStatus("idle");
    }
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      setStatus("verifying");
      const res = await fetch(`/api/auth/verify-email?token=${token}`);
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage("Email verified successfully! Redirecting to login...");
        // Redirect to login page after a short delay
        setTimeout(() => {
          router.push("/auth/login");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(data.error || "Failed to verify email");
      }
    } catch (error) {
      console.error("Verification error:", error);
      setStatus("error");
      setMessage("An error occurred while verifying your email");
    }
  };

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

  if (status === "verifying") {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Verifying Email</h1>
          <p className="mt-2 text-xs text-gray-600">Please wait while we verify your email address...</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Email Verified!</h1>
          <p className="mt-2 text-xs text-gray-600 text-green-600">{message}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <p className="text-xs text-green-700">✓ Your email has been verified successfully.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Verification Failed</h1>
          <p className="mt-2 text-xs text-gray-600 text-red-600">{message}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-xs text-red-700 mb-4">
            The verification link may have expired or is invalid. You can request a new verification email below.
          </p>
          <form onSubmit={handleResend} className="space-y-3">
            <div className="space-y-1 text-xs">
              <label className="block text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={resending}
              className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {resending ? "Sending..." : "Resend Verification Email"}
            </button>
          </form>
          {message && (
            <p className={`mt-3 text-xs ${message.includes("sent") ? "text-green-600" : "text-red-600"}`}>
              {message}
            </p>
          )}
        </div>
        <p className="text-xs text-gray-600 text-center">
          <a href="/auth/login" className="text-brand-600 hover:text-brand-700">
            Back to Login
          </a>
        </p>
      </div>
    );
  }

  // No token provided - show resend form
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Verify Your Email</h1>
        <p className="mt-2 text-xs text-gray-600">
          Enter your email address to receive a verification link.
        </p>
      </div>
      <form onSubmit={handleResend} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-soft">
        <div className="space-y-1 text-xs">
          <label className="block text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
            placeholder="you@example.com"
            required
          />
        </div>
        {message && (
          <p className={`text-xs ${message.includes("sent") ? "text-green-600" : "text-red-600"}`}>
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={resending}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {resending ? "Sending..." : "Send Verification Email"}
        </button>
        <p className="text-xs text-gray-600 text-center">
          <a href="/auth/login" className="text-brand-600 hover:text-brand-700">
            Back to Login
          </a>
        </p>
      </form>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Verifying Email</h1>
          <p className="mt-2 text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}

