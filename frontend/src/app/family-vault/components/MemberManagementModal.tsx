"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Shield, Edit, Eye } from "lucide-react";
import {
  generateRSAKeyPair,
  encryptWithRSAPublicKey,
} from "@/lib/crypto-rsa";

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
  members: Member[];
};

type MemberManagementModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vault: Vault;
  onUpdate: () => void;
  getSMKHex: () => Promise<string | null>; // Function to get plaintext SMK (hex string)
};

export default function MemberManagementModal({
  isOpen,
  onClose,
  vault,
  onUpdate,
  getSMKHex,
}: MemberManagementModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("viewer");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadMembers();
    }
  }, [isOpen, vault.id]);

  const loadMembers = async () => {
    try {
      const res = await fetch(`/api/family/vaults/${vault.id}/members`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  const handleAddMember = async () => {
    if (!email && !phone) {
      setError("Either email or phone is required");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Generate RSA key pair for new member (client-side)
      const { publicKey, privateKey } = await generateRSAKeyPair();

      // Get plaintext SMK (hex string) - this will prompt for password if needed
      const smkHex = await getSMKHex();
      if (!smkHex) {
        setError("Unable to retrieve vault key. Please unlock the vault first.");
        return;
      }

      // Encrypt SMK with new member's public key (client-side)
      const encryptedSMK = await encryptWithRSAPublicKey(smkHex, publicKey);

      // Encrypt private key with member's email (temporary password for onboarding)
      // Member will decrypt this with their email, then re-encrypt with their master password
      const tempPassword = email || phone || "temp-password";
      const { deriveKeyFromPassword, encryptTextData } = await import("@/lib/crypto");
      const tempKey = await deriveKeyFromPassword(tempPassword);
      const encryptedPrivateKeyTemp = await encryptTextData(
        { privateKey },
        tempKey
      );

      const res = await fetch(`/api/family/vaults/${vault.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email || undefined,
          phone: phone || undefined,
          role,
          memberPublicKey: publicKey,
          encryptedSMK: encryptedSMK, // SMK encrypted with new member's public key
          encryptedPrivateKeyTemp: JSON.stringify(encryptedPrivateKeyTemp), // Private key encrypted with email (temporary)
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add member");
      }

      setEmail("");
      setPhone("");
      setRole("viewer");
      setShowAddForm(false);
      loadMembers();
      onUpdate();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(
        `/api/family/vaults/${vault.id}/members/${memberId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!res.ok) throw new Error("Failed to update role");
      loadMembers();
      onUpdate();
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update member role");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const res = await fetch(
        `/api/family/vaults/${vault.id}/members/${memberId}`,
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-4 h-4 text-purple-400" />;
      case "editor":
        return <Edit className="w-4 h-4 text-blue-400" />;
      case "viewer":
        return <Eye className="w-4 h-4 text-green-400" />;
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Manage Members</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Members</h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Member
            </button>
          </div>

          {showAddForm && (
            <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-3">Add New Member</h4>
              <div className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                >
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="editor">Editor (Add/Edit)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
                {error && (
                  <div className="text-red-400 text-sm">{error}</div>
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
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
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
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getRoleIcon(member.role)}
                  <div>
                    <div className="text-white font-medium">
                      {member.user.fullName || member.user.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 capitalize">
                        {member.role}
                      </span>
                      {!member.acceptedAt && (
                        <span className="text-xs px-2 py-0.5 bg-amber-900/30 text-amber-400 rounded border border-amber-800/50">
                          Pending Setup
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={member.role}
                    onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-white text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded"
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

