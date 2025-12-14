"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to login");
        return;
      }

      // Check if there's a pending family vault invitation
      const inviteData = sessionStorage.getItem('familyVaultInvite');
      if (inviteData) {
        try {
          const { token, vaultId } = JSON.parse(inviteData);
          sessionStorage.removeItem('familyVaultInvite');
          // Redirect to family vault setup page
          router.push(`/family-vault/setup?token=${token}&vaultId=${vaultId}`);
          return;
        } catch (e) {
          console.error('Error parsing invite data:', e);
        }
      }

      // On success, always redirect to Dashboard
      router.push("/");
    } catch (err) {
      console.error("Login error:", err);
      setError("Unexpected error during login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-2 text-xs text-slate-300">
          Log into your LifeVault account. Your vault contents remain encrypted
          end-to-end and require your master password on the MyVault screen.
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

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Log in"}
        </button>

        <p className="text-xs text-slate-400">
          New to LifeVault?{" "}
          <a href="/auth/signup" className="text-brand-400 hover:text-brand-300">
            Create an account
          </a>
        </p>
      </form>
    </div>
  );
}


