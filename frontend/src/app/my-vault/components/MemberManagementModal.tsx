"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import {
  generateRSAKeyPair,
  encryptWithRSAPublicKey,
} from "@/lib/crypto-rsa";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import { canAddMember } from "@/lib/plan-limits";

type Member = {
  id: string;
  role: string;
  acceptedAt: Date | null;
  user: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type Vault = {
  id: string;
  name: string;
  members?: Member[]; // Optional, will be loaded from API
};

type MemberManagementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  onUpdate: () => void;
  getVaultKeyHex: () => Promise<string | null>; // Function to get plaintext vault key (hex string)
  onLimitReached?: (
    limitType: "members",
    currentCount: number,
    maxAllowed: number,
    message: string
  ) => void;
};

export default function MemberManagementModal({
  isOpen,
  onClose,
  vault,
  onUpdate,
  getVaultKeyHex,
  onLimitReached,
}: MemberManagementModalProps) {
  const { plan, usage, refetch } = usePlanUsage();
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, vault.id]);

  const loadMembers = async () => {
    try {
      const res = await fetch(`/api/vaults/my/${vault.id}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  const handleAddMember = async () => {
    // Validation: Both email and phone are required
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email format");
      return;
    }

    // Validate phone number format (must be exactly 10 digits)
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return;
    }
    if (!/^\d{10}$/.test(phone)) {
      setError("Phone number should only contain digits");
      return;
    }

    // Check plan limits before proceeding (per-vault, excluding owner)
    const currentVaultMemberCount = members.length;
    if (!canAddMember(plan, currentVaultMemberCount)) {
      const maxAllowed = plan === "free" ? 2 : Infinity;
      const message =
        plan === "free"
          ? "Free plan allows up to 2 members per vault. Please upgrade to LifeVault Plus to add unlimited members."
          : "Unable to add member. Please contact support.";

      if (onLimitReached) {
        onLimitReached("members", currentVaultMemberCount, maxAllowed, message);
      } else {
        setError(message);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Generate RSA key pair for new member (client-side)
      const { publicKey, privateKey } = await generateRSAKeyPair();

      // Get plaintext vault key (hex string) - this will prompt for password if needed
      const vaultKeyHex = await getVaultKeyHex();
      if (!vaultKeyHex) {
        setError("Unable to retrieve vault key. Please unlock the vault first.");
        return;
      }

      // Encrypt vault key with new member's public key (client-side)
      const encryptedSMK = await encryptWithRSAPublicKey(vaultKeyHex, publicKey);

      // Encrypt private key with member's email (temporary password for onboarding)
      // Member will decrypt this with their email, then re-encrypt with their master password
      const tempPassword = email;
      const { deriveKeyFromPassword, encryptTextData } = await import("@/lib/crypto");
      const tempKey = await deriveKeyFromPassword(tempPassword);
      const encryptedPrivateKeyTemp = await encryptTextData(
        { privateKey },
        tempKey
      );

      // Combine country code with phone number
      const fullPhone = `${countryCode}${phone.trim()}`;

      const res = await fetch(`/api/vaults/my/${vault.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phone: fullPhone,
          memberPublicKey: publicKey,
          encryptedSMK: encryptedSMK, // Vault key encrypted with new member's public key
          encryptedPrivateKeyTemp: JSON.stringify(encryptedPrivateKeyTemp), // Private key encrypted with email (temporary)
        }),
      });

      if (!res.ok) {
        let errorData: any = {};
        try {
          const text = await res.text();
          errorData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          errorData = { error: `Server error (${res.status} ${res.statusText})` };
        }

        // Handle member limit errors from API
        if (errorData.limitReached && errorData.limitType === "members") {
          const currentCount =
            errorData.currentCount ?? currentVaultMemberCount;
          const maxAllowed =
            errorData.maxAllowed ?? (plan === "free" ? 2 : Infinity);
          const message =
            errorData.message ||
            (plan === "free"
              ? "Free plan allows up to 2 members per vault. Please upgrade to LifeVault Plus to add unlimited members."
              : "Unable to add member. Please contact support.");

          if (onLimitReached) {
            onLimitReached("members", currentCount, maxAllowed, message);
            // Close the member modal so upgrade modal is visible
            onClose();
          } else {
            setError(message);
          }
          return;
        }

        // For other errors, show the actual error message
        const errorMessage = errorData.error || errorData.message || `Failed to add member (${res.status})`;
        throw new Error(errorMessage);
      }

      setEmail("");
      setPhone("");
      setCountryCode("+91");
      setShowAddForm(false);
      await loadMembers();
      await refetch(); // Refresh usage stats so member count/limits stay in sync
      onUpdate();
    } catch (error) {
      console.error("Error adding member:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to add member";
      setError(errorMessage);
      // Don't close the form on error - let user see the error and retry
    } finally {
      setLoading(false);
    }
  };


  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch(
        `/api/vaults/my/${vault.id}/members/${memberId}`,
        { method: "DELETE" }
      );

      if (!res.ok) throw new Error("Failed to remove member");
      loadMembers();
      onUpdate();
    } catch (error) {
      console.error("Error removing member:", error);
      alert("Failed to remove member");
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto shadow-large">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Manage Members</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">Members</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>

          {showAddForm && (
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Add New Member</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="member@example.com"
                    required
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-32 rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-900 focus:border-brand-500 focus:outline-none"
                    >
                      <option value="+1">🇺🇸 United States (+1)</option>
                      <option value="+44">🇬🇧 United Kingdom (+44)</option>
                      <option value="+91">🇮🇳 India (+91)</option>
                      <option value="+61">🇦🇺 Australia (+61)</option>
                      <option value="+65">🇸🇬 Singapore (+65)</option>
                      <option value="+971">🇦🇪 UAE (+971)</option>
                    </select>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(/\D/g, "");
                        if (digitsOnly.length <= 10) {
                          setPhone(digitsOnly);
                        }
                      }}
                      placeholder="10-digit phone"
                      maxLength={10}
                      required
                      className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Format: country code + 10-digit number
                  </p>
                </div>
                {error && (
                  <div className="text-red-600 text-sm">{error}</div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddMember}
                    disabled={loading}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {loading ? "Adding..." : "Add Member"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setError(null);
                      setEmail("");
                      setPhone("");
                      setCountryCode("+91");
                    }}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="text-gray-900 font-medium">
                      {member.user.fullName || member.user.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        Member
                      </span>
                      {!member.acceptedAt && (
                        <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                          Pending Setup
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

