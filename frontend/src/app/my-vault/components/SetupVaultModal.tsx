"use client";

import { useState } from "react";
import { X, Copy, Check, Download, AlertTriangle } from "lucide-react";
import {
  deriveKeyFromPassword,
  encryptTextData,
  generateRecoveryKey,
  importRecoveryKey,
  encryptVaultKeyWithRecoveryKey,
} from "@/lib/crypto";

type SetupVaultModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vaultKey: CryptoKey) => void;
};

export default function SetupVaultModal({
  isOpen,
  onClose,
  onSuccess,
}: SetupVaultModalProps) {
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [recoveryKeySaved, setRecoveryKeySaved] = useState(false);

  if (!isOpen) return null;

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
      }

      // Don't call onSuccess yet - show recovery key first
    } catch (err) {
      console.error("Setup error:", err);
      setError("Failed to set up vault. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!recoveryKey) return;
    
    // Re-derive vault key from master password
    deriveKeyFromPassword(masterPassword, false).then((vaultKey) => {
      onSuccess(vaultKey);
      // Reset state
      setMasterPassword("");
      setConfirmMasterPassword("");
      setRecoveryKey(null);
      setRecoveryKeySaved(false);
      setRecoveryKeyCopied(false);
    });
  };

  // Show recovery key screen
  if (recoveryKey) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Save Your Recovery Key</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Your vault has been set up successfully! Below is your <strong>Recovery Key</strong> that you can use to unlock your vault if you forget your master password.
            </p>

            <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4">
              <div className="flex items-start gap-3 mb-3">
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

              <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
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
                <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-3 mt-4">
                  <p className="text-xs text-amber-200">
                    <strong>⚠️ Important:</strong> Please save your recovery key before continuing. If you forget your master password, you'll need this key to access your vault.
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
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
                  onClick={handleContinue}
                  className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Continue to Vault
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show master password setup form
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Set Up Your Vault</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4 mb-4">
          <h3 className="mb-2 text-sm font-medium text-amber-200">⚠️ Important</h3>
          <ul className="space-y-1 text-xs text-amber-100/80">
            <li>• This password encrypts your vault data</li>
            <li>• Use a strong, memorable password</li>
            <li>• You'll need this password every time you access your vault</li>
            <li>• A recovery key will be generated and sent to your email</li>
            <li>• Save the recovery key securely - you'll need it if you forget your password</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Master Password
            </label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
              placeholder="Enter your master password"
              required
              autoFocus
            />
            <p className="mt-1 text-xs text-slate-400">
              Minimum 8 characters. This encrypts all your vault data.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Confirm Master Password
            </label>
            <input
              type="password"
              value={confirmMasterPassword}
              onChange={(e) => setConfirmMasterPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
              placeholder="Confirm your master password"
              required
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? "Setting up..." : "Set Up Vault"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


