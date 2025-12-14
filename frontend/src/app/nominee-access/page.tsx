"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle, Lock, Unlock } from "lucide-react";

function NomineeAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"request" | "unlock">("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Request form state (Use Case 1)
  const [userEmail, setUserEmail] = useState("");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeEmail, setNomineeEmail] = useState("");
  const [nomineePhone, setNomineePhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [reasonForAccess, setReasonForAccess] = useState("");
  const [selectedNomineeId, setSelectedNomineeId] = useState<string | null>(null);
  const [availableVaults, setAvailableVaults] = useState<any[]>([]);
  const [showVaultSelection, setShowVaultSelection] = useState(false);

  // Unlock form state (Both use cases)
  const [accessRequestId, setAccessRequestId] = useState("");
  const [encryptedPartC, setEncryptedPartC] = useState("");
  const [decryptionPassword, setDecryptionPassword] = useState("");

  // Check for approval/rejection status from URL
  useEffect(() => {
    const approved = searchParams.get("approved");
    const rejected = searchParams.get("rejected");
    if (approved === "true") {
      setSuccess("Your access request has been approved! You can now unlock the vault.");
      setMode("unlock");
    } else if (rejected === "true") {
      setError("Your access request has been rejected by the vault owner.");
    }
  }, [searchParams]);

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/nominee/access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail,
          nomineeName,
          nomineeEmail: nomineeEmail || null,
          nomineePhone: nomineePhone || null,
          relationship,
          reasonForAccess,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit access request");
      }

      // Check if multiple vaults found - show selection UI
      if (data.multipleVaults && data.nominees) {
        setAvailableVaults(data.nominees);
        setShowVaultSelection(true);
        return; // Don't reset form yet, wait for vault selection
      }

      setSuccess(
        "Access request submitted successfully! The vault owner will be notified and you'll receive an email once they respond."
      );
      // Reset form
      setUserEmail("");
      setNomineeName("");
      setNomineeEmail("");
      setNomineePhone("");
      setRelationship("");
      setReasonForAccess("");
      setSelectedNomineeId(null);
      setShowVaultSelection(false);
    } catch (err: any) {
      setError(err.message || "Failed to submit access request");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/nominee/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessRequestId,
          encryptedPartC,
          decryptionPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unlock vault");
      }

      // Store reconstructed key and vault info in sessionStorage for use in nominee vault page
      if (data.reconstructedKeyHex) {
        sessionStorage.setItem("nomineeReconstructedKey", data.reconstructedKeyHex);
        sessionStorage.setItem("nomineeVaultType", data.vaultType || "my_vault");
        if (data.vaultId) {
          sessionStorage.setItem("nomineeVaultId", data.vaultId);
        }
        if (data.vaultName) {
          sessionStorage.setItem("nomineeVaultName", data.vaultName);
        }
      }

      setSuccess("Vault unlocked successfully! Redirecting to read-only vault view...");

      // Redirect to nominee vault (read-only view) based on vault type
      setTimeout(() => {
        router.push("/nominee-vault");
      }, 800);
    } catch (err: any) {
      setError(err.message || "Failed to unlock vault");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Nominee Access</h1>
        <p className="mt-2 text-sm text-slate-300">
          Request access to a LifeVault or unlock an approved vault
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-1">
        <button
          onClick={() => {
            setMode("request");
            setError(null);
            setSuccess(null);
          }}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            mode === "request"
              ? "bg-brand-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Request Access
        </button>
        <button
          onClick={() => {
            setMode("unlock");
            setError(null);
            setSuccess(null);
          }}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
            mode === "unlock"
              ? "bg-brand-600 text-white"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Unlock Vault
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-200">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-4">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        </div>
      )}

      {/* Vault Selection UI (when multiple vaults found) */}
      {showVaultSelection && availableVaults.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Select Vault</h2>
            <p className="mt-1 text-xs text-slate-400">
              You are a nominee for multiple vaults. Please select which vault you want to request access for.
            </p>
          </div>
          <div className="space-y-2">
            {availableVaults.map((vault) => (
              <button
                key={vault.id}
                type="button"
                onClick={async () => {
                  setSelectedNomineeId(vault.id);
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await fetch("/api/nominee/access/request", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userEmail,
                        nomineeName,
                        nomineeEmail: nomineeEmail || null,
                        nomineePhone: nomineePhone || null,
                        relationship,
                        reasonForAccess,
                        nomineeId: vault.id,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data.error || "Failed to submit access request");
                    }
                    setSuccess(
                      "Access request submitted successfully! The vault owner will be notified and you'll receive an email once they respond."
                    );
                    setShowVaultSelection(false);
                    setUserEmail("");
                    setNomineeName("");
                    setNomineeEmail("");
                    setNomineePhone("");
                    setRelationship("");
                    setReasonForAccess("");
                    setSelectedNomineeId(null);
                  } catch (err: any) {
                    setError(err.message || "Failed to submit access request");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full rounded-md border border-slate-700 bg-slate-800 p-4 text-left hover:border-brand-500 hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">{vault.vaultName}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {vault.vaultType === 'family_vault' ? 'Family Vault' : 'Personal Vault'}
                    </p>
                  </div>
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowVaultSelection(false);
              setAvailableVaults([]);
            }}
            className="mt-4 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Request Access Form (Use Case 1) */}
      {mode === "request" && !showVaultSelection && (
        <form onSubmit={handleRequestAccess} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Request Access</h2>
            <p className="mt-1 text-xs text-slate-400">
              Fill out this form to request read-only access to a LifeVault. The vault owner will be notified and can approve or reject your request.
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Vault Owner Email *</label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="owner@example.com"
              required
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Your Name *</label>
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
            <label className="block text-slate-200">Your Email</label>
            <input
              type="email"
              value={nomineeEmail}
              onChange={(e) => setNomineeEmail(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="you@example.com"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              At least one of email or phone is required
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Your Phone</label>
            <input
              type="tel"
              value={nomineePhone}
              onChange={(e) => setNomineePhone(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="+1234567890"
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Relationship to Vault Owner *</label>
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="e.g., Spouse, Child, Attorney, Friend"
              required
            />
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Reason for Access *</label>
            <textarea
              value={reasonForAccess}
              onChange={(e) => setReasonForAccess(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="Please explain why you need access to this vault..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Submit Access Request"}
          </button>
        </form>
      )}

      {/* Unlock Vault Form (Both Use Cases) */}
      {mode === "unlock" && (
        <form onSubmit={handleUnlockVault} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Unlock Vault</h2>
            <p className="mt-1 text-xs text-slate-400">
              Unlock the vault using your Access Request ID (from the approval email), encrypted key part (Part C), and the decryption password shared with you by the vault owner.
            </p>
          </div>

          <div className="rounded-xl border border-amber-800/50 bg-amber-900/20 p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-100/80">
                You must have an approved access request to unlock the vault. Check your email for the Access Request ID after your request is approved.
              </p>
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Access Request ID *</label>
            <input
              type="text"
              value={accessRequestId}
              onChange={(e) => setAccessRequestId(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none font-mono"
              placeholder="Enter Access Request ID from approval email"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This ID was sent to you in the approval email
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Encrypted Key Part C *</label>
            <textarea
              value={encryptedPartC}
              onChange={(e) => setEncryptedPartC(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none font-mono"
              placeholder="Paste your encrypted Part C (JSON string)..."
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The encrypted key part you received via email or from the vault owner
            </p>
          </div>

          <div className="space-y-1 text-xs">
            <label className="block text-slate-200">Decryption Password *</label>
            <input
              type="password"
              value={decryptionPassword}
              onChange={(e) => setDecryptionPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
              placeholder="Password shared by vault owner"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The password shared with you separately by the vault owner (via phone, in person, etc.)
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Unlocking...
              </>
            ) : (
              <>
                <Unlock className="h-4 w-4" />
                Unlock Vault
              </>
            )}
          </button>
        </form>
      )}

      {/* Info Section */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
        <h3 className="mb-2 text-sm font-semibold text-slate-100">How It Works</h3>
        <ul className="space-y-2 text-slate-300">
          <li>
            <strong>Request Access:</strong> Submit a request to the vault owner. They will receive an email and can approve or reject your request.
          </li>
          <li>
            <strong>Unlock Vault:</strong> Once approved or notified due to inactivity, use your encrypted key part (Part C) and decryption password to unlock the vault in read-only mode.
          </li>
          <li>
            <strong>Read-Only Access:</strong> Nominees can only view vault contents, not modify or delete anything.
          </li>
        </ul>
      </div>
    </div>
  );
}

export default function NomineeAccessPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <NomineeAccessContent />
    </Suspense>
  );
}

