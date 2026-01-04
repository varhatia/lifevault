"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateDeviceFingerprint, getDeviceName } from "@/lib/device-fingerprint";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [requiresDeviceAuth, setRequiresDeviceAuth] = useState(false);
  const [deviceAuthLoading, setDeviceAuthLoading] = useState(false);
  const [deviceAuthMessage, setDeviceAuthMessage] = useState<string | null>(null);

  // Generate device fingerprint on mount
  useEffect(() => {
    const initDevice = async () => {
      try {
        const fingerprint = await generateDeviceFingerprint();
        setDeviceFingerprint(fingerprint.fingerprint);
        setDeviceName(getDeviceName(fingerprint.deviceInfo.userAgent));
      } catch (err) {
        console.error("Failed to generate device fingerprint:", err);
      }
    };
    initDevice();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRequiresDeviceAuth(false);

    if (!deviceFingerprint) {
      setError("Device fingerprint not available. Please refresh the page.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          deviceFingerprint,
          deviceName: deviceName || "Unknown Device",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requiresDeviceAuthorization) {
          // Device needs authorization
          setRequiresDeviceAuth(true);
          setError(null); // Clear any previous errors
          // Automatically request device authorization
          await requestDeviceAuthorization();
          return;
        }
        setError(data.error || "Failed to login");
        setDeviceAuthMessage(null); // Clear device auth message on other errors
        return;
      }

      // On successful login, clear device auth message
      setDeviceAuthMessage(null);
      setRequiresDeviceAuth(false);

      // Check if there's a pending my vault invitation
      const myVaultInviteData = sessionStorage.getItem('myVaultInvite');
      if (myVaultInviteData) {
        try {
          const { token, vaultId } = JSON.parse(myVaultInviteData);
          sessionStorage.removeItem('myVaultInvite');
          // Redirect to my vault setup page
          router.push(`/my-vault/setup?token=${token}&vaultId=${vaultId}`);
          return;
        } catch (e) {
          console.error('Error parsing my vault invite data:', e);
        }
      }

      // Check if there's a pending family vault invitation
      const familyVaultInviteData = sessionStorage.getItem('familyVaultInvite');
      if (familyVaultInviteData) {
        try {
          const { token, vaultId } = JSON.parse(familyVaultInviteData);
          sessionStorage.removeItem('familyVaultInvite');
          // Redirect to family vault setup page
          router.push(`/family-vault/setup?token=${token}&vaultId=${vaultId}`);
          return;
        } catch (e) {
          console.error('Error parsing family vault invite data:', e);
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

  const requestDeviceAuthorization = async () => {
    if (!deviceFingerprint || !deviceName || !email || !password) return;

    try {
      setDeviceAuthLoading(true);
      const res = await fetch("/api/auth/device/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceFingerprint,
          deviceName,
          email, // Include email for verification
          password, // Include password for verification (since user isn't logged in yet)
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Failed to request device authorization:", data.error);
        setError(data.error || "Failed to request device authorization. Please try again.");
        setDeviceAuthMessage(null);
        return;
      }

      // Show persistent success message - don't clear it
      setError(null);
      setDeviceAuthMessage("An authorization email has been sent to your email address. Please check your inbox and click the authorization link to approve this device. You can then log in again.");
    } catch (err) {
      console.error("Error requesting device authorization:", err);
      setError("An error occurred while requesting device authorization. Please try again.");
      setDeviceAuthMessage(null);
    } finally {
      setDeviceAuthLoading(false);
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
          <div className="flex items-center justify-between">
            <label className="block text-slate-200">Password</label>
            <a href="/auth/forgot-password" className="text-brand-400 hover:text-brand-300 text-xs">
              Forgot password?
            </a>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {deviceAuthMessage && (
          <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
            <p className="text-xs text-blue-300 mb-2">{deviceAuthMessage}</p>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={requestDeviceAuthorization}
                disabled={deviceAuthLoading}
                className="text-xs text-brand-400 hover:text-brand-300 underline"
              >
                {deviceAuthLoading ? "Sending..." : "Resend authorization email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeviceAuthMessage(null);
                  setRequiresDeviceAuth(false);
                }}
                className="text-xs text-slate-400 hover:text-slate-300 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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


