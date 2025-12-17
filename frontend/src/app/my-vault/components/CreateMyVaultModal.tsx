"use client";

import { useState, useMemo } from "react";
import { X, Copy, Check, Download, AlertTriangle } from "lucide-react";
import {
  deriveKeyFromPassword,
  encryptTextData,
  generateRecoveryKey,
  importRecoveryKey,
  encryptVaultKeyWithRecoveryKey,
} from "@/lib/crypto";
import { evaluatePasswordStrength } from "@/lib/passwordStrength";

type CreateMyVaultModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (vaultId: string, vaultKey: CryptoKey) => Promise<void>;
};

export default function CreateMyVaultModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateMyVaultModalProps) {
  const [name, setName] = useState("");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [recoveryKeySaved, setRecoveryKeySaved] = useState(false);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);

  // Evaluate password strength in real-time
  const passwordStrength = useMemo(() => {
    if (!masterPassword) {
      return null;
    }
    return evaluatePasswordStrength(masterPassword);
  }, [masterPassword]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Vault name is required");
      return;
    }

    if (!masterPassword) {
      setError("Master password is required");
      return;
    }

    // Validate password strength
    if (!passwordStrength || !passwordStrength.isValid) {
      const unmetRequirements = passwordStrength?.requirements
        .filter((req) => !req.met)
        .map((req) => req.message)
        .join(", ") || "Password does not meet requirements";
      setError(`Password requirements not met: ${unmetRequirements}`);
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      // Derive the encryption key from master password
      const key = await deriveKeyFromPassword(masterPassword, true); // extractable for recovery key encryption
      setVaultKey(key);
      
      // Generate recovery key
      const recoveryKeyBase64 = generateRecoveryKey();
      setRecoveryKey(recoveryKeyBase64);

      // Export vault key as hex for encryption with recovery key
      const exportedKey = await crypto.subtle.exportKey("raw", key);
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

      // Create vault on server
      const res = await fetch("/api/vaults/my", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create vault");
      }

      const data = await res.json();
      const newVaultId = data.vault.id;
      setVaultId(newVaultId);

      // Store vault key and recovery key encrypted vault key locally
      if (typeof window !== "undefined") {
        // Store vault key encrypted with master password
        const verifierKey = await deriveKeyFromPassword(masterPassword, false);
        const verifierPayload = await encryptTextData(
          { verifier: "lifevault-v1", vaultId: newVaultId },
          verifierKey
        );
        localStorage.setItem(`vaultVerifier_${newVaultId}`, JSON.stringify(verifierPayload));

        // Store master password-encrypted vault key (needed for unlock)
        const encryptedVaultKeyData = await encryptTextData(
          { keyHex: vaultKeyHex },
          verifierKey
        );
        localStorage.setItem(
          `my_vault_${newVaultId}`,
          JSON.stringify(encryptedVaultKeyData)
        );

        // Store recovery key encrypted vault key in localStorage (for this vault)
        localStorage.setItem(
          `recoveryKeyEncryptedVaultKey_${newVaultId}`,
          JSON.stringify(encryptedVaultKey)
        );
      }

      // Send recovery key via email (via API route)
      try {
        await fetch("/api/auth/recovery-key/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryKey: recoveryKeyBase64,
            vaultId: newVaultId,
            vaultName: name.trim(),
          }),
        });
      } catch (emailError) {
        console.error("Failed to send recovery key email:", emailError);
        // Don't fail setup if email fails
      }

      // Don't close yet - show recovery key to user first
    } catch (err) {
      console.error("Create vault error:", err);
      setError(err instanceof Error ? err.message : "Failed to create vault");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (vaultKey && vaultId) {
      await onSuccess(vaultId, vaultKey);
      // Reset form
      setName("");
      setMasterPassword("");
      setConfirmPassword("");
      setRecoveryKey(null);
      setRecoveryKeySaved(false);
      setVaultKey(null);
      setVaultId(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Create My Vault</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {recoveryKey ? (
          // Recovery Key Display Screen
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Save Your Recovery Key</h3>
              <p className="mt-1 text-xs text-slate-300">
                This key can unlock your vault if you forget your master password. Store it securely!
              </p>
            </div>

            <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4">
              <h3 className="mb-2 text-sm font-medium text-amber-200">⚠️ Critical Warning</h3>
              <ul className="space-y-1 text-xs text-amber-100/80">
                <li>• This is the ONLY way to recover your vault if you lose your master password.</li>
                <li>• We cannot recover this key for you.</li>
                <li>• Store it in a password manager, print it, or write it down and keep it safe.</li>
                <li>• Do NOT store it unencrypted on your computer.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Your Recovery Key</label>
              <div className="relative">
                <textarea
                  readOnly
                  value={recoveryKey}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white font-mono break-all resize-none h-32"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(recoveryKey);
                    setRecoveryKeyCopied(true);
                    setTimeout(() => setRecoveryKeyCopied(false), 2000);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs"
                >
                  {recoveryKeyCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([recoveryKey], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `lifevault-recovery-key-${name.trim()}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" /> Download Key
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryKeySaved(true)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    recoveryKeySaved
                      ? "bg-green-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  } flex items-center justify-center gap-2`}
                >
                  {recoveryKeySaved ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} I&apos;ve Saved It
                </button>
              </div>
            </div>

            {!recoveryKeySaved && (
              <p className="text-xs text-red-400">
                Please ensure you have saved your recovery key securely before continuing.
              </p>
            )}

            <button
              type="button"
              onClick={handleContinue}
              className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Continue to Vault
            </button>
          </div>
        ) : (
          // Master Password Setup Form
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Vault Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                placeholder="e.g., Personal Documents"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Master Password
              </label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                placeholder="Enter master password (12+ characters)"
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                This password encrypts your vault. You&apos;ll need it to unlock the vault.
              </p>
              
              {/* Password Strength Indicator */}
              {masterPassword && passwordStrength && (
                <div className="mt-2 space-y-2">
                  {/* Strength Bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.color === "red"
                            ? "bg-red-500"
                            : passwordStrength.color === "orange"
                            ? "bg-orange-500"
                            : passwordStrength.color === "yellow"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${passwordStrength.percentage}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-medium ${
                        passwordStrength.color === "red"
                          ? "text-red-400"
                          : passwordStrength.color === "orange"
                          ? "text-orange-400"
                          : passwordStrength.color === "yellow"
                          ? "text-yellow-400"
                          : "text-green-400"
                      }`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>

                  {/* Requirements Checklist */}
                  <div className="space-y-1">
                    {passwordStrength.requirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[10px]">
                        <span className={req.met ? "text-green-400" : "text-slate-500"}>
                          {req.met ? "✓" : "○"}
                        </span>
                        <span className={req.met ? "text-slate-300" : "text-slate-500"}>
                          {req.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                placeholder="Confirm master password"
                required
                minLength={8}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (passwordStrength ? !passwordStrength.isValid : false)}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Vault"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


