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
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-500 text-base font-semibold text-white">
              LV
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your LifeVault account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-8 shadow-soft">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="you@example.com"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <a 
                href="/auth/forgot-password" 
                className="text-sm text-brand-500 hover:text-brand-600 transition-colors"
              >
                Forgot password?
              </a>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {deviceAuthMessage && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-700 mb-3">{deviceAuthMessage}</p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={requestDeviceAuthorization}
                  disabled={deviceAuthLoading}
                  className="text-sm text-brand-500 hover:text-brand-600 transition-colors disabled:opacity-50"
                >
                  {deviceAuthLoading ? "Sending..." : "Resend authorization email"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeviceAuthMessage(null);
                    setRequiresDeviceAuth(false);
                  }}
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div className="pt-4 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <a 
                href="/auth/signup" 
                className="font-medium text-brand-500 hover:text-brand-600 transition-colors"
              >
                Sign up
              </a>
            </p>
          </div>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Your vault contents remain encrypted end-to-end and require your master password on the MyVault screen.
          </p>
        </div>
      </div>
    </div>
  );
}


