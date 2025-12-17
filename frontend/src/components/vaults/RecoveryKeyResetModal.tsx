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
  decryptTextData,
} from "@/lib/crypto";

export type VaultType = "my_vault" | "family_vault";

type RecoveryKeyResetModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  vaultName: string;
  vaultType: VaultType;
  currentKeyHex: string; // The decrypted key (vault key for MyVault, SMK for FamilyVault)
  onSuccess: (newKeyHex: string) => void; // Callback with new key hex after reset
};

type Step = "set-password" | "generate-recovery" | "save-recovery";

export default function RecoveryKeyResetModal({
  isOpen,
  onClose,
  vaultId,
  vaultName,
  vaultType,
  currentKeyHex,
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

      // IMPORTANT: Keep the SAME key (from recovery key unlock)
      // We only update the master password verifier and recovery key
      // The key itself stays the same so existing items remain accessible
      const keyHex = currentKeyHex; // Use the existing key
      
      // Import the existing key as CryptoKey
      const existingKey = await importAesKeyFromHex(keyHex);

      // Generate new recovery key
      const newRecoveryKeyBase64 = generateRecoveryKey();

      // Encrypt the existing key with new recovery key
      const recoveryKeyCrypto = await importRecoveryKey(newRecoveryKeyBase64);
      const encryptedKey = await encryptVaultKeyWithRecoveryKey(
        keyHex,
        recoveryKeyCrypto
      );

      // Store recovery key encrypted key in localStorage (per vault)
      const recoveryKeyStorageKey = `recoveryKeyEncryptedKey_${vaultType}_${vaultId}`;
      localStorage.setItem(
        recoveryKeyStorageKey,
        JSON.stringify(encryptedKey)
      );

      // Create verifier for new master password
      // IMPORTANT: Derive a key from the new master password to encrypt the verifier
      // This allows future unlocks with the new master password to verify correctly
      const newMasterPasswordKey = await deriveKeyFromPassword(masterPassword, false);
      
      let newEncryptedPrivateKey: string | null = null;
      
      if (vaultType === "my_vault") {
        // MyVault: Store verifier and encrypted vault key
        const verifierKey = `vaultVerifier_${vaultId}`;
        const verifierPayload = await encryptTextData(
          { verifier: "lifevault-v1", vaultId: vaultId },
          newMasterPasswordKey
        );
        localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));

        // Store master password-encrypted vault key (needed for unlock)
        const vaultKeyStorageKey = `my_vault_${vaultId}`;
        const encryptedVaultKeyWithPassword = await encryptTextData(
          { keyHex: keyHex },
          newMasterPasswordKey
        );
        localStorage.setItem(vaultKeyStorageKey, JSON.stringify(encryptedVaultKeyWithPassword));

        // Note: Server storage will happen after API call succeeds (see below)
      } else {
        // Family Vault: Need to get private key and re-encrypt it with new password
        // First, try to get private key from localStorage (if available and can be decrypted)
        // If not available, we'll need to fetch from server and decrypt with old password
        // But since we don't have old password, we'll fetch encrypted private key and store it temporarily
        // Then re-encrypt with new password
        
        // Fetch member data to get encrypted private key from server
        try {
          const membersRes = await fetch(`/api/family/vaults/${vaultId}/members`);
          if (membersRes.ok) {
            const membersData = await membersRes.json();
            const userRes = await fetch("/api/auth/me");
            if (userRes.ok) {
              const userData = await userRes.json();
              const currentUserMember = membersData.members.find(
                (m: any) => m.user.id === userData.user?.id
              );
              
              if (currentUserMember?.encryptedPrivateKey) {
                // We have the encrypted private key from server (encrypted with old password)
                // We can't decrypt it, but we can store it temporarily and re-encrypt later
                // Actually, we need to get the plaintext private key somehow
                // Let's try localStorage first
                const stored = localStorage.getItem(`family_vault_${vaultId}`);
                let privateKey: string | null = null;
                
                if (stored) {
                  try {
                    const encryptedData = JSON.parse(stored);
                    // Try to decrypt with new password (won't work if encrypted with old password)
                    // But if it was stored after a previous unlock, it might work
                    const { decryptTextData } = await import("@/lib/crypto");
                    try {
                      const decryptedData = await decryptTextData(encryptedData, newMasterPasswordKey);
                      privateKey = decryptedData.privateKey;
                    } catch (e) {
                      // Can't decrypt with new password - need to get from server
                      // But we can't decrypt from server without old password
                      // So we'll need to generate a new key pair or handle this differently
                      console.warn("Cannot decrypt private key from localStorage with new password");
                    }
                  } catch (e) {
                    console.error("Error parsing localStorage data:", e);
                  }
                }
                
                // If we don't have private key, we need to fetch it from server
                // But it's encrypted with old password, so we can't decrypt it
                // Solution: We'll need to generate a new RSA key pair and update the server
                // But that would break the existing encrypted SMK on server
                // Actually, wait - we have the SMK in plaintext (from recovery key)
                // So we can generate a new RSA key pair, encrypt the SMK with the new public key,
                // and update both the public key and encrypted SMK on server
                
                // Note: We can't decrypt the private key from server because it's encrypted with old password
                // So we'll generate a new RSA key pair in the API call section below
                
                // Encrypt private key with new master password
                if (privateKey) {
                  const { encryptTextData } = await import("@/lib/crypto");
                  const encryptedPrivateKeyData = await encryptTextData(
                    { privateKey },
                    newMasterPasswordKey
                  );
                  newEncryptedPrivateKey = JSON.stringify(encryptedPrivateKeyData);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error fetching member data for private key update:", e);
        }
        
        // Create verifier for Family Vault
        const verifierKey = `familyVaultVerifier_${vaultId}`;
        const verifierPayload = await encryptTextData(
          { verifier: "lifevault-v1", vaultId: vaultId },
          newMasterPasswordKey
        );
        localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));
      }

      // For Family Vault, if we couldn't get the private key, we need to generate new RSA key pair
      let newPublicKey: string | null = null;
      let newEncryptedSMK: string | null = null;
      let newPrivateKeyPlaintext: string | null = null;
      
      if (vaultType === "family_vault" && !newEncryptedPrivateKey) {
        // We need to generate new RSA key pair and update server
        // This happens when we can't decrypt the old private key (encrypted with old password)
        const { generateRSAKeyPair, encryptWithRSAPublicKey } = await import("@/lib/crypto-rsa");
        const rsaKeys = await generateRSAKeyPair();
        newPublicKey = rsaKeys.publicKey;
        newPrivateKeyPlaintext = rsaKeys.privateKey;
        
        // Encrypt SMK with new public key
        newEncryptedSMK = await encryptWithRSAPublicKey(keyHex, newPublicKey);
        
        // Encrypt new private key with new master password
        const { encryptTextData } = await import("@/lib/crypto");
        const encryptedPrivateKeyData = await encryptTextData(
          { privateKey: rsaKeys.privateKey },
          newMasterPasswordKey
        );
        newEncryptedPrivateKey = JSON.stringify(encryptedPrivateKeyData);
      }

      // Call API to update server-side recovery key and encrypted private key
      const apiPath = vaultType === "my_vault" 
        ? `/api/vaults/my/${vaultId}/recovery-reset`
        : `/api/vaults/family/${vaultId}/recovery-reset`;
      
      const res = await fetch(apiPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRecoveryKeyEncryptedKey: JSON.stringify(encryptedKey),
          ...(newEncryptedPrivateKey && { newEncryptedPrivateKey }),
          ...(newPublicKey && { newPublicKey }),
          ...(newEncryptedSMK && { newEncryptedSMK }),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset recovery key");
      }

      // For MyVault, ensure verifier and encrypted vault key are stored on server for cross-device access
      // This must happen AFTER the API call succeeds to ensure everything is in sync
      if (vaultType === "my_vault") {
        // Get the verifier and encrypted vault key we stored earlier
        const verifierKey = `vaultVerifier_${vaultId}`;
        const verifierPayloadStr = localStorage.getItem(verifierKey);
        const vaultKeyStorageKey = `my_vault_${vaultId}`;
        const encryptedVaultKeyWithPasswordStr = localStorage.getItem(vaultKeyStorageKey);
        
        // Store on server for cross-device access (if we have the values)
        if (verifierPayloadStr && encryptedVaultKeyWithPasswordStr) {
          try {
            await fetch(`/api/vaults/my/${vaultId}/keys`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                masterPasswordVerifier: verifierPayloadStr,
                masterPasswordEncryptedVaultKey: encryptedVaultKeyWithPasswordStr,
                recoveryKeyEncryptedVaultKey: JSON.stringify(encryptedKey),
              }),
            });
          } catch (serverError) {
            console.error("Failed to store vault keys on server:", serverError);
            // Don't fail the flow if server storage fails
          }
        }
      }

      // For Family Vault, store private key and SMK in localStorage with new password
      if (vaultType === "family_vault") {
        // If we have the private key (either from localStorage or newly generated)
        let privateKeyToStore: string | null = null;
        if (newPrivateKeyPlaintext) {
          privateKeyToStore = newPrivateKeyPlaintext;
        } else if (newEncryptedPrivateKey) {
          // Try to decrypt the newly encrypted private key to get plaintext for localStorage
          try {
            const encryptedData = JSON.parse(newEncryptedPrivateKey);
            const decryptedData = await decryptTextData(encryptedData, newMasterPasswordKey);
            privateKeyToStore = decryptedData.privateKey;
          } catch (e) {
            console.error("Failed to decrypt private key for localStorage storage:", e);
          }
        }
        
        if (privateKeyToStore) {
          // Store SMK and private key in localStorage encrypted with new master password
          const encryptedLocalData = await encryptTextData(
            { smkHex: keyHex, privateKey: privateKeyToStore },
            newMasterPasswordKey
          );
          localStorage.setItem(
            `family_vault_${vaultId}`,
            JSON.stringify(encryptedLocalData)
          );
        }
      }
      // Note: MyVault keys are already stored in localStorage and on server above (lines 104-121 and 265-293)

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

      // Use the existing key hex (from recovery key unlock)
      // This ensures all existing items remain accessible without re-encryption
      // Pass the hex string directly instead of converting to CryptoKey
      // The key stays the same, only the master password verifier and recovery key changed
      onSuccess(currentKeyHex);

      // Close modal
      onClose();
    } catch (error) {
      console.error("Error completing recovery reset:", error);
      setError(error instanceof Error ? error.message : "Failed to complete recovery reset");
    } finally {
      setReEncrypting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {step === "set-password" && "Set New Master Password"}
            {step === "generate-recovery" && "Save Your Recovery Key"}
            {step === "save-recovery" && "Confirm Recovery Key Saved"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {step === "set-password" && (
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                New Master Password
              </label>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Enter new master password"
                required
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
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Confirm new master password"
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {loading ? "Setting Password..." : "Continue"}
            </button>
          </form>
        )}

        {step === "generate-recovery" && recoveryKey && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-400 mb-2">
                <strong>Important:</strong> Save this recovery key in a secure location. You'll need it if you forget your master password.
              </p>
            </div>

            <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Recovery Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={recoveryKey}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopyRecoveryKey}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                  title="Copy recovery key"
                >
                  {recoveryKeyCopied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadRecoveryKey}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                  title="Download recovery key"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="recoveryKeySaved"
                checked={recoveryKeySaved}
                onChange={(e) => setRecoveryKeySaved(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="recoveryKeySaved" className="text-sm text-slate-300">
                I have saved my recovery key in a secure location
              </label>
            </div>

            <button
              onClick={handleContinue}
              disabled={!recoveryKeySaved || reEncrypting}
              className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-lg font-medium"
            >
              {reEncrypting ? "Re-encrypting Vault..." : "Continue to Vault"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

