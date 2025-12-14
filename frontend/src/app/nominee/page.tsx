"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { deriveKeyFromPassword } from "@/lib/crypto";
import AddNomineeModal from "./components/AddNomineeModal";

type Nominee = {
  id: string;
  vaultType: string;
  vaultId: string | null;
  nomineeName: string;
  nomineeEmail: string | null;
  nomineePhone: string | null;
  accessTriggerDays: number;
  createdAt: string;
  updatedAt: string;
  familyVault?: {
    id: string;
    name: string;
  } | null;
};

export default function NomineePage() {
  const { loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [nominees, setNominees] = useState<Nominee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Check if vault key is needed
  // Always require password entry on nominee page to ensure extractable key
  useEffect(() => {
    if (isAuthenticated) {
      // Check if vault is set up
      const vaultKeyInitialized = localStorage.getItem("vaultKeyInitialized");
      if (!vaultKeyInitialized) {
        router.push("/auth/setup-vault");
        return;
      }
      // Always show password prompt to ensure we derive extractable key
      if (!vaultKey) {
        setShowPasswordPrompt(true);
      }
    }
  }, [isAuthenticated, router]);

  // Fetch nominees
  useEffect(() => {
    if (isAuthenticated) {
      fetchNominees();
    }
  }, [isAuthenticated]);

  const fetchNominees = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/nominee");
      if (!res.ok) throw new Error("Failed to fetch nominees");
      const data = await res.json();
      setNominees(data.nominees || []);
      // Note: groupedNominees is also available in data.groupedNominees if needed for UI
    } catch (error) {
      console.error("Error fetching nominees:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeVaultKey = async () => {
    if (!masterPassword) return;
    try {
      // Derive key with extractable=true so we can export it for Shamir splitting
      const key = await deriveKeyFromPassword(masterPassword, true);
      setVaultKey(key);
      setShowPasswordPrompt(false);
    } catch (error) {
      console.error("Failed to initialize vault key:", error);
    }
  };

  // Don't show loading message - render content immediately
  // Auth check happens in background, will redirect if needed
  if (!authLoading && !isAuthenticated) {
    return null; // Will redirect, don't render anything
  }

  if (showPasswordPrompt) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nominee Access</h1>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="mb-2 text-sm font-medium">Enter Master Password</h2>
          <p className="mb-4 text-xs text-slate-300">
            Your master password is required to generate the nominee key.
          </p>
          <input
            type="password"
            value={masterPassword}
            onChange={(e) => setMasterPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") initializeVaultKey();
            }}
            placeholder="Master password"
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={initializeVaultKey}
            className="mt-3 w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Unlock Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nominee Access
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            Configure who can access a read-only version of your vault if you are
            no longer able to.
          </p>
        </div>
        <button
          onClick={async () => {
            if (!vaultKey) {
              setShowPasswordPrompt(true);
              return;
            }
            
            // Verify key is extractable before opening modal
            try {
              await crypto.subtle.exportKey("raw", vaultKey);
              setShowAddModal(true);
            } catch (error) {
              // Key is not extractable, require password entry
              console.warn("Vault key is not extractable, requiring password entry");
              setVaultKey(null); // Clear non-extractable key
              setShowPasswordPrompt(true);
            }
          }}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700"
        >
          + Add Nominee
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">
            Access Workflow
          </h2>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-slate-300">
            <li>You add a nominee (email or mobile).</li>
            <li>LifeVault generates and delivers Nominee Key (Part C).</li>
            <li>
              On trigger, nominee uploads their key and combines with
              service-held Part B.
            </li>
            <li>Vault unlocks in read-only mode for the nominee.</li>
          </ol>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <h2 className="text-sm font-semibold text-slate-100">
            How It Works
          </h2>
          <p className="mt-2 text-slate-300">
            Your master key is split into 3 parts using Shamir Secret Sharing (2-of-3):
          </p>
          <ul className="mt-2 space-y-1 text-slate-300">
            <li>• <strong>Part A:</strong> You (stored locally)</li>
            <li>• <strong>Part B:</strong> Service (encrypted, sealed)</li>
            <li>• <strong>Part C:</strong> Nominee (sent securely)</li>
          </ul>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Current Nominees ({nominees.length})</h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : nominees.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">
            No nominees configured yet. Click "Add Nominee" to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {nominees.map((nominee) => (
              <NomineeCard
                key={nominee.id}
                nominee={nominee}
                onResendKey={async () => {
                  try {
                    const res = await fetch(`/api/nominee/${nominee.id}/resend-key`, {
                      method: 'POST',
                    });
                    const data = await res.json();
                    if (res.ok) {
                      alert('Nominee key has been resent successfully!');
                    } else {
                      alert(data.error || 'Failed to resend key');
                    }
                  } catch (error) {
                    console.error('Error resending key:', error);
                    alert('Failed to resend key');
                  }
                }}
                onViewKey={async () => {
                  try {
                    const res = await fetch(`/api/nominee/${nominee.id}/get-key`);
                    const data = await res.json();
                    if (res.ok) {
                      // Show key in a modal or copy to clipboard
                      const keyText = `Encrypted Key Part C for ${nominee.nomineeName}:\n\n${data.nominee.encryptedPartC}\n\nInstructions:\n${data.instructions.steps.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`;
                      
                      // Copy to clipboard
                      await navigator.clipboard.writeText(data.nominee.encryptedPartC);
                      alert(`Encrypted key part copied to clipboard!\n\nYou can now share it with ${nominee.nomineeName} through a secure channel.\n\nRemember to share the decryption password separately!`);
                    } else {
                      alert(data.error || 'Failed to retrieve key');
                    }
                  } catch (error) {
                    console.error('Error retrieving key:', error);
                    alert('Failed to retrieve key');
                  }
                }}
              />
            ))}
          </div>
        )}
      </section>

      {showAddModal && vaultKey && (
        <AddNomineeModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            fetchNominees();
            setShowAddModal(false);
          }}
          vaultKey={vaultKey}
        />
      )}
      
      {showAddModal && !vaultKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Vault Not Unlocked</h2>
            <p className="text-xs text-slate-300 mb-4">
              Please unlock your vault by entering your master password before adding a nominee.
            </p>
            <button
              onClick={() => {
                setShowAddModal(false);
                setShowPasswordPrompt(true);
              }}
              className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Unlock Vault
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NomineeCard({ 
  nominee, 
  onResendKey, 
  onViewKey 
}: { 
  nominee: Nominee;
  onResendKey: () => void;
  onViewKey: () => void;
}) {
  const vaultTypeLabel = nominee.vaultType === 'family_vault' 
    ? (nominee.familyVault ? 'Family Vault: ' + nominee.familyVault.name : 'Family Vault')
    : 'Personal Vault (My Vault)';
  
  const vaultTypeBadgeColor = nominee.vaultType === 'family_vault' 
    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
    : 'bg-blue-500/20 text-blue-300 border-blue-500/50';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-100">
              {nominee.nomineeName}
            </h3>
            <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${vaultTypeBadgeColor}`}>
              {vaultTypeLabel}
            </span>
          </div>
          <div className="mt-2 space-y-1 text-slate-300">
            {nominee.nomineeEmail && (
              <div>
                <strong>Email:</strong> {nominee.nomineeEmail}
              </div>
            )}
            {nominee.nomineePhone && (
              <div>
                <strong>Phone:</strong> {nominee.nomineePhone}
              </div>
            )}
            <div>
              <strong>Access Trigger:</strong> {nominee.accessTriggerDays} days of inactivity
            </div>
            <div className="text-[11px] text-slate-400">
              Added: {new Date(nominee.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-700">
        {nominee.nomineeEmail && (
          <button
            onClick={onResendKey}
            className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
          >
            Resend Key
          </button>
        )}
        <button
          onClick={onViewKey}
          className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
        >
          View/Copy Key
        </button>
      </div>
      
      {nominee.nomineeEmail && (
        <p className="mt-2 text-[10px] text-slate-400">
          Key was sent via email when nominee was added
        </p>
      )}
    </div>
  );
}
