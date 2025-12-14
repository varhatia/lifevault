"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  deriveKeyFromPassword, 
  encryptTextData,
  generateRecoveryKey,
  importRecoveryKey,
  encryptVaultKeyWithRecoveryKey,
} from "@/lib/crypto";
import { useAuth } from "@/lib/hooks/useAuth";
import { Copy, Check, Download, AlertTriangle } from "lucide-react";

export default function SetupVaultPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, user } = useAuth();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(null);
  const [checkingVerification, setCheckingVerification] = useState(true);

  // Check authentication first - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Check email verification status
  useEffect(() => {
    const checkEmailVerification = async () => {
      if (!isAuthenticated || !user) {
        setCheckingVerification(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setEmailVerified(data.user?.emailVerified || false);
        }
      } catch (error) {
        console.error("Error checking email verification:", error);
      } finally {
        setCheckingVerification(false);
      }
    };

    if (isAuthenticated) {
      checkEmailVerification();
    }
  }, [isAuthenticated, user]);

  const [masterPassword, setMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [recoveryKeySaved, setRecoveryKeySaved] = useState(false);

  // Don't show loading message - render content immediately
  // Auth check happens in background, will redirect if needed
  if (!authLoading && !isAuthenticated) {
    return null; // Will redirect, don't render anything
  }

  // Show email verification required message
  if (!checkingVerification && emailVerified === false) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Verification Required</h1>
          <p className="mt-2 text-xs text-slate-300">
            Please verify your email address before setting up your vault.
          </p>
        </div>
        <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-6">
          <h3 className="mb-2 text-sm font-medium text-amber-200">⚠️ Email Not Verified</h3>
          <p className="mb-4 text-xs text-amber-100/80">
            We sent a verification email to your inbox. Please check your email and click the verification link to continue.
          </p>
          <div className="space-y-2">
            <a
              href="/auth/verify-email"
              className="block w-full rounded-md bg-brand-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-700"
            >
              Resend Verification Email
            </a>
            <a
              href="/auth/login"
              className="block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Back to Login
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Show recovery key screen after setup
  if (recoveryKey) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Save Your Recovery Key</h1>
          <p className="mt-2 text-xs text-slate-300">
            Your vault has been set up successfully! Below is your <strong>Recovery Key</strong> that you can use to unlock your vault if you forget your master password.
          </p>
        </div>

        <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-200 mb-2">⚠️ Save This Recovery Key Securely</h3>
              <ul className="space-y-1 text-xs text-amber-100/80">
                <li>• Store it in a password manager or secure location</li>
                <li>• Print it and keep it in a safe place</li>
                <li>• Do not share it with anyone</li>
                <li>• You will need this if you forget your master password</li>
                <li>• A copy has been sent to your email address</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300">Recovery Key</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(recoveryKey);
                      setRecoveryKeyCopied(true);
                      setTimeout(() => setRecoveryKeyCopied(false), 2000);
                    } catch (err) {
                      console.error("Failed to copy:", err);
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white border border-slate-600 rounded hover:bg-slate-800 transition-colors"
                >
                  {recoveryKeyCopied ? (
                    <>
                      <Check className="h-3 w-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([recoveryKey], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lifevault-recovery-key-${new Date().toISOString().split('T')[0]}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setRecoveryKeySaved(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:text-white border border-slate-600 rounded hover:bg-slate-800 transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Download
                </button>
              </div>
            </div>
            <div className="bg-slate-950 border border-slate-800 rounded p-3 font-mono text-xs text-slate-200 break-all select-all">
              {recoveryKey}
            </div>
            {recoveryKeySaved && (
              <p className="text-xs text-green-400 mt-2">✓ Recovery key downloaded</p>
            )}
          </div>

          {!recoveryKeySaved && (
            <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-3 mb-4">
              <p className="text-xs text-amber-200">
                <strong>⚠️ Important:</strong> Please save your recovery key before continuing. If you forget your master password, you'll need this key to access your vault.
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setRecoveryKeySaved(true);
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                recoveryKeySaved
                  ? "border border-green-700 bg-green-900/30 text-green-300"
                  : "border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {recoveryKeySaved ? "✓ I've Saved It" : "I've Saved It"}
            </button>
            <button
              type="button"
              onClick={() => {
                router.push("/my-vault");
              }}
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Continue to Vault
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-4">
          <p className="text-xs text-green-200">
            <strong>✓ Vault Setup Complete</strong><br />
            Your encrypted vault is ready. A copy of your recovery key has been sent to your email address.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!masterPassword) {
      setError("Master password is required");
      return;
    }

    if (masterPassword.length < 8) {
      setError("Master password must be at least 8 characters");
      return;
    }

    if (masterPassword !== confirmMasterPassword) {
      setError("Master passwords do not match");
      return;
    }

    try {
      setLoading(true);

      // Derive the encryption key from master password
      const vaultKey = await deriveKeyFromPassword(masterPassword, true); // extractable for recovery key encryption

      // Generate recovery key
      const recoveryKeyBase64 = generateRecoveryKey();
      setRecoveryKey(recoveryKeyBase64);

      // Export vault key as hex for encryption with recovery key
      const exportedKey = await crypto.subtle.exportKey("raw", vaultKey);
      const keyArray = new Uint8Array(exportedKey);
      const vaultKeyHex = Array.from(keyArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Encrypt vault key with recovery key
      const recoveryKeyCrypto = await importRecoveryKey(recoveryKeyBase64);
      const encryptedVaultKey = await encryptVaultKeyWithRecoveryKey(
        vaultKeyHex,
        recoveryKeyCrypto
      );

      if (typeof window !== 'undefined') {
        // Create a client-side verifier encrypted with the master password–derived key.
        // This allows us to detect incorrect master passwords on this device without
        // ever sending the password or key to the server.
        try {
          // Re-derive key with extractable=false for verifier
          const verifierKey = await deriveKeyFromPassword(masterPassword, false);
          const verifierPayload = await encryptTextData(
            { verifier: "lifevault-v1" },
            verifierKey
          );
          localStorage.setItem("vaultVerifier", JSON.stringify(verifierPayload));
        } catch (verifierError) {
          console.error("Failed to create vault verifier:", verifierError);
        }

        // Store a flag that master password is set (client-side)
        localStorage.setItem("vaultKeyInitialized", "true");
      }

      // Mark vault setup as completed on server and store recovery key encrypted vault key
      const setupRes = await fetch("/api/auth/vault-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryKeyEncryptedVaultKey: JSON.stringify(encryptedVaultKey),
        }),
      });

      if (!setupRes.ok) {
        console.warn("Failed to mark vault setup as completed on server");
        // Continue anyway - client-side flag is set
      }

      // Send recovery key via email (via API route)
      try {
        await fetch("/api/auth/recovery-key/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryKey: recoveryKeyBase64,
          }),
        });
      } catch (emailError) {
        console.error("Failed to send recovery key email:", emailError);
        // Don't fail setup if email fails - user can still see the key on screen
      }

      // Don't redirect yet - show recovery key to user first
      // User will click "Continue" after saving the key
    } catch (err) {
      console.error("Setup error:", err);
      setError("Failed to set up vault. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set Up Your Vault</h1>
        <p className="mt-2 text-xs text-slate-300">
          Your master password encrypts all your vault data. It <strong>never leaves your browser</strong> and we cannot recover it if you forget it.
        </p>
      </div>

      <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4">
        <h3 className="mb-2 text-sm font-medium text-amber-200">⚠️ Important</h3>
        <ul className="space-y-1 text-xs text-amber-100/80">
          <li>• This password encrypts your vault data</li>
          <li>• Use a strong, memorable password</li>
          <li>• You'll need this password every time you access your vault</li>
          <li>• A recovery key will be generated and sent to your email</li>
          <li>• Save the recovery key securely - you'll need it if you forget your password</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Master Password</label>
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="Enter your master password"
            required
            autoFocus
          />
          <p className="mt-1 text-[11px] text-slate-400">
            Minimum 8 characters. This encrypts all your vault data.
          </p>
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Confirm Master Password</label>
          <input
            type="password"
            value={confirmMasterPassword}
            onChange={(e) => setConfirmMasterPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="Confirm your master password"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "Setting up vault..." : "Set Up Vault"}
        </button>

        <p className="text-xs text-slate-400">
          After setup, you'll be able to start adding encrypted files to your vault.
        </p>
      </form>
    </div>
  );
}

