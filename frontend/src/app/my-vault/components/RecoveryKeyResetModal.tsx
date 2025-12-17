"use client";

import { useState } from "react";
import { X, AlertTriangle, Download, Copy, Check, Lock } from "lucide-react";
import {
  deriveKeyFromPassword,
  generateRecoveryKey,
  importRecoveryKey,
  encryptVaultKeyWithRecoveryKey,
  importAesKeyFromHex,
  encryptTextData,
} from "@/lib/crypto";
// Note: sendRecoveryKeyEmail is server-side only, we'll call an API route instead

type RecoveryKeyResetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  vaultName: string;
  currentVaultKeyHex: string; // The decrypted vault key (hex string) from recovery key unlock
  onSuccess: (newVaultKeyHex: string) => void; // Callback with new vault key hex after reset
};

type Step = "set-password" | "generate-recovery" | "save-recovery";

export default function RecoveryKeyResetModal({
  isOpen,
  onClose,
  vaultId,
  vaultName,
  currentVaultKeyHex,
  onSuccess,
}: RecoveryKeyResetModalProps) {
  const [step, setStep] = useState<Step>("set-password");
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [recoveryKeySaved, setRecoveryKeySaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reEncrypting, setReEncrypting] = useState(false);

  if (!isOpen) return null;

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!masterPassword) {
      setError("Master password is required");
      return;
    }

    if (masterPassword.length < 8) {
      setError("Master password must be at least 8 characters");
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);

      // IMPORTANT: Keep the SAME vault key (from recovery key unlock)
      // We only update the master password verifier and recovery key
      // The vault key itself stays the same so existing items remain accessible
      const vaultKeyHex = currentVaultKeyHex; // Use the existing vault key
      
      // Import the existing vault key as CryptoKey
      const existingVaultKey = await importAesKeyFromHex(vaultKeyHex);

      // Generate new recovery key
      const newRecoveryKeyBase64 = generateRecoveryKey();

      // Encrypt the existing vault key with new recovery key
      const recoveryKeyCrypto = await importRecoveryKey(newRecoveryKeyBase64);
      const encryptedVaultKey = await encryptVaultKeyWithRecoveryKey(
        vaultKeyHex,
        recoveryKeyCrypto
      );

      // Store recovery key encrypted vault key in localStorage (per vault)
      const recoveryKeyStorageKey = `recoveryKeyEncryptedVaultKey_${vaultId}`;
      localStorage.setItem(
        recoveryKeyStorageKey,
        JSON.stringify(encryptedVaultKey)
      );

      // Call API to update server-side recovery key and invalidate old keys
      const res = await fetch(`/api/vaults/my/${vaultId}/recovery-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // API expects this field name: newRecoveryKeyEncryptedKey
          newRecoveryKeyEncryptedKey: JSON.stringify(encryptedVaultKey),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset recovery key");
      }

      // Create verifier for new master password
      // IMPORTANT: Derive a key from the new master password to encrypt the verifier
      // This allows future unlocks with the new master password to verify correctly
      const verifierKey = `vaultVerifier_${vaultId}`;
      const newMasterPasswordKey = await deriveKeyFromPassword(masterPassword, false);
      const verifierPayload = await encryptTextData(
        { verifier: "lifevault-v1", vaultId: vaultId },
        newMasterPasswordKey
      );
      localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));

      // Store the vault key encrypted with the new master password
      // This allows unlocking with the new master password to retrieve the actual vault key.
      // NOTE: MyVault unlock flow expects a JSON object with { keyHex } encrypted via encryptTextData,
      // then stored at `my_vault_${vaultId}` and later decrypted with decryptTextData.
      const vaultKeyStorageKey = `my_vault_${vaultId}`;
      const encryptedVaultKeyWithPassword = await encryptTextData(
        { keyHex: vaultKeyHex },
        newMasterPasswordKey
      );
      localStorage.setItem(vaultKeyStorageKey, JSON.stringify(encryptedVaultKeyWithPassword));

      // Store verifier, master password-encrypted vault key, and recovery key encrypted vault key on server for cross-device access
      try {
        await fetch(`/api/vaults/my/${vaultId}/keys`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            masterPasswordVerifier: JSON.stringify(verifierPayload),
            masterPasswordEncryptedVaultKey: JSON.stringify(encryptedVaultKeyWithPassword),
            recoveryKeyEncryptedVaultKey: JSON.stringify(encryptedVaultKey),
          }),
        });
      } catch (serverError) {
        console.error("Failed to store vault keys on server:", serverError);
        // Don't fail the flow if server storage fails
      }

      // Send recovery key via email (call API route)
      try {
        await fetch("/api/auth/recovery-key/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recoveryKey: newRecoveryKeyBase64 }),
        });
      } catch (emailError) {
        console.error("Failed to send recovery key email:", emailError);
        // Don't fail the entire flow if email fails
      }

      setRecoveryKey(newRecoveryKeyBase64);
      setStep("generate-recovery");
    } catch (error) {
      console.error("Error setting new password:", error);
      setError(error instanceof Error ? error.message : "Failed to set new password");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRecoveryKey = async () => {
    if (!recoveryKey) return;
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setRecoveryKeyCopied(true);
      setTimeout(() => setRecoveryKeyCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy recovery key:", error);
      alert("Failed to copy recovery key. Please copy it manually.");
    }
  };

  const handleDownloadRecoveryKey = () => {
    if (!recoveryKey) return;
    const blob = new Blob([recoveryKey], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifevault-recovery-key-${vaultName.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirmSaved = () => {
    setRecoveryKeySaved(true);
  };

  const handleContinue = async () => {
    if (!recoveryKeySaved) {
      alert("Please confirm that you have saved your recovery key before continuing.");
      return;
    }

    try {
      setReEncrypting(true);

      // Use the existing vault key hex (from recovery key unlock)
      // This ensures all existing items remain accessible without re-encryption
      // Pass the hex string directly instead of converting to CryptoKey
      // The vault key stays the same, only the master password verifier and recovery key changed
      onSuccess(currentVaultKeyHex);

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error completing recovery reset:", error);
      setError(error instanceof Error ? error.message : "Failed to complete recovery reset");
    } finally {
      setReEncrypting(false);
    }
  };

  const handleClose = () => {
    if (step === "set-password") {
      // Allow closing if still on password step
      onClose();
    } else {
      // Don't allow closing if recovery key is shown - user must save it
      alert("Please save your recovery key before closing this window.");
    }
  };


  // Step 1: Set New Master Password
  if (step === "set-password") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Security Reset Required</h2>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-400 mb-2">
                  For your security, please set a new Master Password.
                </p>
                <p className="text-xs text-slate-300">
                  Since you used your recovery key to unlock this vault, we need to reset your master password and generate a new recovery key to keep your vault protected.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Master Password
              </label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => {
                  setMasterPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter new master password (min 8 characters)"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                autoFocus
                disabled={loading}
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Master Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Confirm new master password"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-brand-500"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !masterPassword || !confirmPassword}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Setting Password..." : "Set New Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 2: Generate and Display Recovery Key
  if (step === "generate-recovery" && recoveryKey) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Save Your Recovery Key</h2>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Lock className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-400 mb-2">
                  Great! Now let's generate a new Recovery Key to keep your vault protected.
                </p>
                <p className="text-xs text-slate-300">
                  Your new recovery key has been generated. Please save it securely before continuing.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Your Recovery Key</h3>
              <p className="text-xs text-slate-400 mb-3">
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

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-400">Recovery Key</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyRecoveryKey}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                    title="Copy to clipboard"
                  >
                    {recoveryKeyCopied ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDownloadRecoveryKey}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                    title="Download as file"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                </div>
              </div>
              <textarea
                readOnly
                value={recoveryKey}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-xs resize-none"
                rows={6}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="recoveryKeySaved"
                checked={recoveryKeySaved}
                onChange={(e) => setRecoveryKeySaved(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="recoveryKeySaved" className="text-sm text-slate-300">
                I have saved my recovery key securely
              </label>
            </div>

            {!recoveryKeySaved && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-400 text-xs">
                ⚠️ Please confirm that you have saved your recovery key before continuing.
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleContinue}
                disabled={!recoveryKeySaved || reEncrypting}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {reEncrypting ? "Re-encrypting Vault..." : "Continue to Vault"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

