"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";

type AddNomineeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vaultKey: CryptoKey | null;
};

export default function AddNomineeModal({
  isOpen,
  onClose,
  onSuccess,
  vaultKey,
}: AddNomineeModalProps) {
  const [step, setStep] = useState<"form" | "confirmation">("form");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeEmail, setNomineeEmail] = useState("");
  const [nomineePhone, setNomineePhone] = useState("");
  const [accessTriggerDays, setAccessTriggerDays] = useState(90);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [confirmEncryptionPassword, setConfirmEncryptionPassword] = useState("");
  const [dataValidated, setDataValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!nomineeName.trim()) {
      setError("Nominee name is required");
      return;
    }

    if (!nomineeEmail.trim() && !nomineePhone.trim()) {
      setError("Either email or phone number is required");
      return;
    }

    if (nomineeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nomineeEmail)) {
      setError("Invalid email format");
      return;
    }

    // Validate encryption password
    if (!encryptionPassword || encryptionPassword.length < 8) {
      setError("Encryption password must be at least 8 characters");
      return;
    }

    if (encryptionPassword !== confirmEncryptionPassword) {
      setError("Encryption passwords do not match");
      return;
    }

    // Move to confirmation step
    setStep("confirmation");
  };

  const handleConfirm = async () => {
    if (!dataValidated) {
      setError("Please confirm that the information is correct");
      return;
    }

    if (!vaultKey) {
      setError("Vault key not initialized. Please unlock your vault first.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Verify key is extractable before proceeding
      let keyMaterial: ArrayBuffer;
      try {
        keyMaterial = await crypto.subtle.exportKey("raw", vaultKey);
      } catch (exportError: any) {
        if (exportError.name === "InvalidAccessError" || exportError.message?.includes("not extractable")) {
          setError("Vault key is not extractable. Please close this modal and unlock your vault again by entering your master password on the Nominee page.");
          setLoading(false);
          return;
        }
        throw exportError;
      }

      // Generate nominee key part C using Shamir Secret Sharing
      const { splitSecretTwoOfThree, deriveKeyFromPassword, encryptWithAes } = await import("@/lib/crypto");
      const keyArray = new Uint8Array(keyMaterial);
      const keyString = Array.from(keyArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Split the secret (2-of-3 Shamir)
      const shares = splitSecretTwoOfThree(keyString);
      const nomineeKeyPartC = shares[2].value; // Part C for nominee
      const serverKeyPartB = shares[1].value; // Part B for service (will be stored server-side)

      // Encrypt Part C with user-provided password before storing
      const encryptionKey = await deriveKeyFromPassword(encryptionPassword, false);
      const encryptedPartC = await encryptWithAes(nomineeKeyPartC, encryptionKey);

      // Send to API
      // Note: encryptionPassword is NOT sent - it's only used client-side
      // User must share password separately with nominee via secure channel
      // Part B is sent to server to be encrypted and stored securely
      const res = await fetch("/api/nominee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomineeName: nomineeName.trim(),
          nomineeEmail: nomineeEmail.trim() || null,
          nomineePhone: nomineePhone.trim() || null,
          nomineeKeyPartC: JSON.stringify(encryptedPartC), // Store encrypted Part C
          serverKeyPartB, // Part B to be encrypted and stored server-side
          accessTriggerDays,
          // notifyNominee removed - email is always sent if email is provided
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add nominee");
      }

      // Success
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Error adding nominee:", err);
      setError(err.message || "Failed to add nominee");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep("form");
    setNomineeName("");
    setNomineeEmail("");
    setNomineePhone("");
    setAccessTriggerDays(90);
    setEncryptionPassword("");
    setConfirmEncryptionPassword("");
    setDataValidated(false);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (step === "confirmation") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Confirm Nominee Details</h2>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-4 mb-4">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <h3 className="text-sm font-medium text-amber-200">Important: Verify Information</h3>
            </div>
            <p className="text-xs text-amber-100/80 mb-3">
              Please carefully review the nominee information below. It is <strong>your responsibility</strong> to ensure this information is correct.
            </p>
            <div className="space-y-2 text-xs text-amber-100/90">
              <div>
                <strong>Name:</strong> {nomineeName}
              </div>
              {nomineeEmail && (
                <div>
                  <strong>Email:</strong> {nomineeEmail}
                </div>
              )}
              {nomineePhone && (
                <div>
                  <strong>Phone:</strong> {nomineePhone}
                </div>
              )}
              <div>
                <strong>Access Trigger:</strong> {accessTriggerDays} days of inactivity
              </div>
              <div className="mt-2 pt-2 border-t border-amber-700/50">
                <p className="text-xs text-amber-100/90">
                  <strong>Important:</strong> You will need to share the encryption password with your nominee 
                  through a secure channel (phone call, in person, etc.). They will need it to decrypt Part C.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dataValidated}
                onChange={(e) => setDataValidated(e.target.checked)}
                className="mt-1 rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-xs text-slate-300">
                I confirm that the nominee information above is correct and I take full responsibility for its accuracy.
              </span>
            </label>

            {nomineeEmail && (
              <div className="rounded-xl border border-blue-800/50 bg-blue-900/20 p-3">
                <p className="text-xs text-blue-100/90">
                  <strong>Note:</strong> The encrypted key Part C will automatically be sent to {nomineeEmail} via email when you add this nominee. 
                  You will still need to share the decryption password separately through a secure channel.
                </p>
              </div>
            )}
            {!nomineeEmail && nomineePhone && (
              <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-3">
                <p className="text-xs text-amber-100/90">
                  <strong>Warning:</strong> No email address provided. The encrypted key Part C will be stored but not automatically delivered. 
                  You must manually share it with the nominee using the "View/Copy Key" option after adding them.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => setStep("form")}
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !dataValidated}
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Adding..." : "Confirm & Add Nominee"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Add Nominee</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          Add a trusted contact who can access your vault in read-only mode under specific circumstances.
        </p>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Nominee Name *</label>
            <input
              type="text"
              value={nomineeName}
              onChange={(e) => setNomineeName(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Email</label>
            <input
              type="email"
              value={nomineeEmail}
              onChange={(e) => setNomineeEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="nominee@example.com"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              At least one of email or phone is required
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Phone Number</label>
            <input
              type="tel"
              value={nomineePhone}
              onChange={(e) => setNomineePhone(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="+1234567890"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Use E.164 format (e.g., +1234567890)
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Access Trigger (Days)</label>
            <input
              type="number"
              value={accessTriggerDays}
              onChange={(e) => setAccessTriggerDays(parseInt(e.target.value) || 90)}
              min={1}
              max={365}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Number of days of inactivity before nominee access is triggered
            </p>
          </div>

          <div className="rounded-xl border border-blue-800/50 bg-blue-900/20 p-4">
            <h3 className="text-sm font-medium text-blue-200 mb-2">Encryption Password</h3>
            <p className="text-xs text-blue-100/80 mb-3">
              Create a password to encrypt Part C. Share this password securely with your nominee (via phone, in person, etc.). 
              They will need it to decrypt Part C when accessing your vault.
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="block text-xs text-slate-200">Encryption Password *</label>
                <input
                  type="password"
                  value={encryptionPassword}
                  onChange={(e) => setEncryptionPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-slate-200">Confirm Encryption Password *</label>
                <input
                  type="password"
                  value={confirmEncryptionPassword}
                  onChange={(e) => setConfirmEncryptionPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
                  placeholder="Confirm password"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

