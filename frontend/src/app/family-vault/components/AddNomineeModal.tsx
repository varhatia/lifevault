"use client";

import { useState, useEffect } from "react";
import { X, AlertTriangle, Plus, Copy, Check, Mail, Eye, Trash2, RefreshCw } from "lucide-react";
import {
  splitSecretTwoOfThree,
  combineTwoOfThree,
  deriveKeyFromPassword,
  encryptWithAes,
} from "@/lib/crypto";

type Nominee = {
  id: string;
  nomineeName: string;
  nomineeEmail: string | null;
  nomineePhone: string | null;
  accessTriggerDays: number;
  isActive?: boolean;
  createdAt: string;
};

type AddNomineeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vaultId: string;
  vaultName: string;
  getSMKHex: () => Promise<string | null>; // Function to get plaintext SMK hex
};

export default function AddNomineeModal({
  isOpen,
  onClose,
  onSuccess,
  vaultId,
  vaultName,
  getSMKHex,
}: AddNomineeModalProps) {
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNominees, setLoadingNominees] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [step, setStep] = useState<"form" | "confirmation">("form");
  const [nomineeName, setNomineeName] = useState("");
  const [nomineeEmail, setNomineeEmail] = useState("");
  const [nomineePhone, setNomineePhone] = useState("");
  const [accessTriggerDays, setAccessTriggerDays] = useState(90);
  const [encryptionPassword, setEncryptionPassword] = useState("");
  const [confirmEncryptionPassword, setConfirmEncryptionPassword] = useState("");
  const [dataValidated, setDataValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [viewingKeyId, setViewingKeyId] = useState<string | null>(null);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [regeneratingNomineeId, setRegeneratingNomineeId] = useState<string | null>(null);

  // Load nominees for this vault when modal opens
  useEffect(() => {
    if (isOpen && vaultId) {
      loadNominees();
    }
  }, [isOpen, vaultId]);

  const loadNominees = async () => {
    if (!vaultId) return;
    try {
      setLoadingNominees(true);
      // Include inactive nominees to show which ones need key regeneration
      const res = await fetch(`/api/nominee?vaultType=family_vault&vaultId=${vaultId}&includeInactive=true`);
      if (res.ok) {
        const data = await res.json();
        // API already filters by vaultId, so use nominees directly
        setNominees(data.nominees || []);
      }
    } catch (error) {
      console.error("Error loading nominees:", error);
    } finally {
      setLoadingNominees(false);
    }
  };

  const handleResendKey = async (nomineeId: string) => {
    try {
      const res = await fetch(`/api/nominee/${nomineeId}/resend-key`, {
        method: "POST",
      });
      if (res.ok) {
        alert("Key has been resent to the nominee's email.");
      } else {
        const data = await res.json();
        alert(`Failed to resend key: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error resending key:", error);
      alert("Failed to resend key. Please try again.");
    }
  };

  const handleViewKey = async (nomineeId: string) => {
    try {
      const res = await fetch(`/api/nominee/${nomineeId}/key`);
      if (res.ok) {
        const data = await res.json();
        setViewingKey(data.encryptedKeyPartC);
        setViewingKeyId(nomineeId);
      } else {
        const data = await res.json();
        alert(`Failed to load key: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error loading key:", error);
      alert("Failed to load key. Please try again.");
    }
  };

  const handleRegenerateKey = async (nomineeId: string) => {
    const password = prompt("Enter encryption password for the nominee key:");
    if (!password || password.trim() === "") {
      return;
    }

    try {
      setRegeneratingNomineeId(nomineeId);
      setError(null);

      // Get SMK hex from parent component
      const smkHex = await getSMKHex();
      if (!smkHex) {
        setError("Shared Master Key not available. Please unlock the vault first.");
        return;
      }

      // Split key using Shamir Secret Sharing (2-of-3)
      const shares = splitSecretTwoOfThree(smkHex);
      const serverKeyPartB = shares[1].value; // Part B stored on server
      const nomineeKeyPartC = shares[2].value; // Part C for nominee

      // Encrypt Part C with user-provided password (client-side)
      const encryptionKey = await deriveKeyFromPassword(password);
      const encryptedPartC = await encryptWithAes(nomineeKeyPartC, encryptionKey);

      // Call regenerate API
      const res = await fetch(`/api/nominee/${nomineeId}/regenerate`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomineeKeyPartC: JSON.stringify(encryptedPartC),
          serverKeyPartB,
          encryptionPassword: password, // For email notification
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to regenerate nominee keys");
      }

      alert("Nominee keys regenerated successfully! The nominee has been notified via email.");
      await loadNominees();
    } catch (err: any) {
      console.error("Error regenerating nominee keys:", err);
      setError(err.message || "Failed to regenerate nominee keys");
      alert(err.message || "Failed to regenerate nominee keys");
    } finally {
      setRegeneratingNomineeId(null);
    }
  };

  const handleDeleteNominee = async (nomineeId: string) => {
    if (!confirm("Are you sure you want to remove this nominee?")) return;

    try {
      const res = await fetch(`/api/nominee/${nomineeId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove nominee");
      }

      // Reload nominees list
      await loadNominees();
      alert("Nominee removed successfully");
    } catch (error) {
      console.error("Error removing nominee:", error);
      alert(error instanceof Error ? error.message : "Failed to remove nominee");
    }
  };

  const handleCopyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      if (viewingKeyId) {
        setCopiedKeyId(viewingKeyId);
        setTimeout(() => setCopiedKeyId(null), 2000);
      }
    } catch (error) {
      console.error("Error copying key:", error);
      alert("Failed to copy key. Please try again.");
    }
  };

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

    try {
      setLoading(true);
      setError(null);

      // Get plaintext SMK (hex string)
      const smkHex = await getSMKHex();
      if (!smkHex) {
        setError("Unable to retrieve vault key. Please unlock the vault first.");
        return;
      }

      // Split key using Shamir Secret Sharing (2-of-3)
      const shares = splitSecretTwoOfThree(smkHex);
      const serverKeyPartB = shares[1].value; // Part B stored on server
      const nomineeKeyPartC = shares[2].value; // Part C for nominee

      // Encrypt Part C with user-provided password (client-side)
      const encryptionKey = await deriveKeyFromPassword(encryptionPassword);
      const encryptedPartC = await encryptWithAes(nomineeKeyPartC, encryptionKey);

      // Send to API
      let data;
      try {
        const res = await fetch("/api/nominee", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vaultType: "family_vault",
            vaultId: vaultId,
            nomineeName: nomineeName.trim(),
            nomineeEmail: nomineeEmail.trim() || null,
            nomineePhone: nomineePhone.trim() || null,
            nomineeKeyPartC: JSON.stringify(encryptedPartC), // Store encrypted Part C
            serverKeyPartB, // Part B to be encrypted and stored server-side
            accessTriggerDays,
          }),
        });

        let responseData;
        let responseText: string | null = null;
        try {
          responseText = await res.text();
          console.log("Raw API response text:", responseText.substring(0, 200)); // Log first 200 chars
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error("Failed to parse API response:", parseError);
          console.error("Response text was:", responseText?.substring(0, 200));
          responseData = { error: `Invalid response from server (${res.status})` };
        }

        if (!res.ok) {
          console.error("API Error Response:", {
            status: res.status,
            statusText: res.statusText,
            data: responseData,
            url: res.url,
            headers: Object.fromEntries(res.headers.entries()),
          });
          const errorMsg = responseData?.error || responseData?.message || `Failed to add nominee (${res.status} ${res.statusText})`;
          throw new Error(errorMsg);
        }

        data = responseData;

        // Show warning if duplicate nominee detected (only if it's a true duplicate in the same vault)
        if (data.warning) {
          // Show warning but still proceed
          alert(`⚠️ ${data.warning}`);
        }

        // Success - reload nominees and reset form, but keep modal open
        await loadNominees();
        resetForm();
        setShowAddForm(false);

        // Call onSuccess to notify parent (but don't close modal)
        onSuccess();
      } catch (err: any) {
        console.error("Error adding nominee:", err);
        setError(err.message || "Failed to add nominee");
        return;
      }
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
    setShowAddForm(false);
    onClose();
  };

  if (!isOpen) return null;

  if (step === "confirmation") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Confirm Nominee Details</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-400 mb-2">
                    Important: Verify Information
                  </p>
                  <p className="text-xs text-slate-300">
                    Please verify that all nominee information is correct. You are responsible for the accuracy of this data.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400">Nominee Name</label>
                <p className="text-sm text-white mt-1">{nomineeName}</p>
              </div>
              {nomineeEmail && (
                <div>
                  <label className="text-xs font-medium text-slate-400">Email</label>
                  <p className="text-sm text-white mt-1">{nomineeEmail}</p>
                </div>
              )}
              {nomineePhone && (
                <div>
                  <label className="text-xs font-medium text-slate-400">Phone</label>
                  <p className="text-sm text-white mt-1">{nomineePhone}</p>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-400">Access Trigger Days</label>
                <p className="text-sm text-white mt-1">{accessTriggerDays} days of inactivity</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Vault Type</label>
                <p className="text-sm text-white mt-1">Family Vault: {vaultName}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="validate"
                checked={dataValidated}
                onChange={(e) => setDataValidated(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-brand-600 focus:ring-brand-500"
              />
              <label htmlFor="validate" className="text-sm text-slate-300">
                I confirm that the information above is correct and I take responsibility for its accuracy.
              </label>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                disabled={loading}
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || !dataValidated}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? "Adding..." : "Confirm & Add Nominee"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Nominees{vaultName ? ` for ${vaultName}` : " for Family Vault"}</h2>
            <p className="text-sm text-slate-400 mt-1">Manage nominees for this vault</p>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Key Modal */}
        {viewingKey && viewingKeyId && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Encrypted Key Part C</h3>
                <button
                  onClick={() => {
                    setViewingKey(null);
                    setViewingKeyId(null);
                  }}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-slate-300">
                  Share this encrypted key part with your nominee through a secure channel. They will also need the decryption password.
                </p>
                <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <pre className="text-xs text-slate-300 font-mono break-all whitespace-pre-wrap">
                    {viewingKey}
                  </pre>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopyKey(viewingKey)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
                  >
                    {copiedKeyId === viewingKeyId ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Key
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setViewingKey(null);
                      setViewingKeyId(null);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Nominees List */}
        {!showAddForm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Nominees ({nominees.length})
              </h3>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Nominee
              </button>
            </div>

            {loadingNominees ? (
              <div className="text-center py-8 text-slate-400">Loading nominees...</div>
            ) : nominees.length === 0 ? (
              <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-slate-400 mb-4">No nominees assigned to this vault yet.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
                >
                  Add Your First Nominee
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Email ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Phone</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Access Trigger</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nominees.map((nominee) => (
                      <tr 
                        key={nominee.id} 
                        className={`border-b border-slate-800 hover:bg-slate-800/50 ${
                          nominee.isActive === false ? 'opacity-60' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-sm text-white">
                          <div className="flex items-center gap-2">
                            {nominee.nomineeName}
                            {nominee.isActive === false && (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">
                          {nominee.nomineeEmail || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">
                          {nominee.nomineePhone || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-300">
                          {nominee.accessTriggerDays} days
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <div className="flex items-center justify-end gap-2">
                            {nominee.isActive === false ? (
                              <button
                                onClick={() => handleRegenerateKey(nominee.id)}
                                disabled={regeneratingNomineeId === nominee.id}
                                className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded text-xs"
                                title="Regenerate keys for this nominee"
                              >
                                <RefreshCw className={`w-3 h-3 ${regeneratingNomineeId === nominee.id ? 'animate-spin' : ''}`} />
                                Regenerate
                              </button>
                            ) : (
                              <>
                                {nominee.nomineeEmail && (
                                  <button
                                    onClick={() => handleResendKey(nominee.id)}
                                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                                    title="Resend key via email"
                                  >
                                    <Mail className="w-3 h-3" />
                                    Resend
                                  </button>
                                )}
                                <button
                                  onClick={() => handleViewKey(nominee.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
                                  title="View/Copy key"
                                >
                                  <Eye className="w-3 h-3" />
                                  View Key
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleDeleteNominee(nominee.id)}
                              className="p-2 text-red-400 hover:bg-red-400/10 rounded"
                              title="Delete nominee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add Nominee Form */}
        {showAddForm && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Add Nominee</h3>
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nominee Name *
                </label>
                <input
                  type="text"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                  placeholder="Full name of nominee"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={nomineeEmail}
                  onChange={(e) => setNomineeEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                  placeholder="nominee@example.com"
                />
                <p className="text-xs text-slate-400 mt-1">
                  At least email or phone is required
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={nomineePhone}
                  onChange={(e) => setNomineePhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                  placeholder="+1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Access Trigger Days
                </label>
                <input
                  type="number"
                  value={accessTriggerDays}
                  onChange={(e) => setAccessTriggerDays(parseInt(e.target.value) || 90)}
                  min={1}
                  max={365}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Days of inactivity before nominee can access vault
                </p>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Encryption Password *
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  This password will be used to encrypt the nominee's key part. Share this password with the nominee through a secure channel (phone, in person, etc.).
                </p>
                <input
                  type="password"
                  value={encryptionPassword}
                  onChange={(e) => setEncryptionPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500 mb-2"
                  placeholder="Minimum 8 characters"
                  required
                />
                <input
                  type="password"
                  value={confirmEncryptionPassword}
                  onChange={(e) => setConfirmEncryptionPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                  placeholder="Confirm encryption password"
                  required
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
                  onClick={() => {
                    resetForm();
                    setShowAddForm(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
