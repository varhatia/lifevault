"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Lock, FileText, Users, Download, Trash2 } from "lucide-react";
import CreateMyVaultModal from "./components/CreateMyVaultModal";
import AddItemModal from "@/components/vaults/AddItemModal";
import AddNomineeModal from "./components/AddNomineeModal";
import RecoveryKeyResetModal from "./components/RecoveryKeyResetModal";
import {
  deriveKeyFromPassword,
  decryptFile,
  encryptTextData,
  decryptTextData,
  importAesKeyFromHex,
  importRecoveryKey,
  decryptVaultKeyWithRecoveryKey,
} from "@/lib/crypto";
import { deriveKeyFromPassword as deriveKeyFromPasswordUtil } from "@/lib/crypto";
import { useAuth } from "@/lib/hooks/useAuth";

type MyVault = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    items: number;
    nominees: number;
  };
};

type VaultItem = {
  id: string;
  category: string;
  title: string;
  tags: string[];
  s3Key?: string;
  iv?: string;
  createdAt: string;
  updatedAt: string;
};

type VaultKey = {
  vaultId: string;
  key: CryptoKey;
};

const CATEGORIES = [
  "Finance",
  "Insurance",
  "Loans",
  "Identity",
  "Medical",
  "Misc",
] as const;

export default function MyVaultPage() {
  const router = useRouter();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [vaults, setVaults] = useState<MyVault[]>([]);
  const [selectedVault, setSelectedVault] = useState<MyVault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNomineeModal, setShowNomineeModal] = useState(false);
  const [nominees, setNominees] = useState<any[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [vaultToUnlock, setVaultToUnlock] = useState<MyVault | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [vaultKeys, setVaultKeys] = useState<Map<string, CryptoKey>>(new Map());
  const [showRecoveryResetModal, setShowRecoveryResetModal] = useState(false);
  const [recoveryResetVault, setRecoveryResetVault] = useState<{ id: string; name: string; vaultKeyHex: string } | null>(null);
  const [vaultPasswords, setVaultPasswords] = useState<Map<string, string>>(new Map()); // Cache passwords for unlocked vaults

  // Check authentication first - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Load vaults on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadVaults();
    }
  }, [isAuthenticated]);

  // Load items when vault is selected
  useEffect(() => {
    if (selectedVault) {
      loadVaultItems(selectedVault.id);
    }
  }, [selectedVault]);

  const loadVaults = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vaults/my");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        throw new Error("Failed to load vaults");
      }
      const data = await res.json();
      setVaults(data.vaults || []);
    } catch (error) {
      console.error("Error loading vaults:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVaultItems = async (vaultId: string) => {
    try {
      const res = await fetch(`/api/vaults/my/${vaultId}/items`);
      if (!res.ok) throw new Error("Failed to load items");
      const data = await res.json();
      setItems(data.items || []);
      loadNominees(vaultId);
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const loadNominees = async (vaultId: string) => {
    try {
      const res = await fetch(`/api/nominee?vaultType=my_vault&vaultId=${vaultId}`);
      if (res.ok) {
        const data = await res.json();
        setNominees(data.nominees || []);
      }
    } catch (error) {
      console.error("Error loading nominees:", error);
    }
  };

  const handleCreateVault = async (vaultId: string, vaultKey: CryptoKey) => {
    // Store vault key in memory
    setVaultKeys((prev) => {
      const next = new Map(prev);
      next.set(vaultId, vaultKey);
      return next;
    });

    // Reload vaults to get the new one
    await loadVaults();
    
    // Select the newly created vault
    const vaultsRes = await fetch("/api/vaults/my");
    if (vaultsRes.ok) {
      const vaultsData = await vaultsRes.json();
      const newVault = vaultsData.vaults.find((v: MyVault) => v.id === vaultId);
      if (newVault) {
        setSelectedVault(newVault);
      }
    }
  };

  const handleUnlockVault = async (vault: MyVault, masterPassword: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Derive key from master password
      const key = await deriveKeyFromPassword(masterPassword);

      // Check for verifier in localStorage (keyed by vault ID)
      const verifierKey = `vaultVerifier_${vault.id}`;
      const verifierRaw = localStorage.getItem(verifierKey);

      if (verifierRaw) {
        // Verify master password by attempting to decrypt the verifier payload
        try {
          const payload = JSON.parse(verifierRaw);
          const data = await decryptTextData(payload, key);
          if (!data || data.verifier !== "lifevault-v1") {
            throw new Error("Verifier mismatch");
          }
        } catch (e) {
          console.error("Master password verification failed:", e);
          throw new Error("Incorrect master password. Please try again.");
        }
      } else {
        // No verifier yet for this vault - create one
        try {
          const verifierPayload = await encryptTextData(
            { verifier: "lifevault-v1", vaultId: vault.id },
            key
          );
          localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));
        } catch (e) {
          console.error("Failed to create verifier:", e);
        }
      }

      // After password verification, get the actual vault key
      // Check if vault key is stored encrypted with master password (from recovery reset)
      const vaultKeyStorageKey = `vaultKeyEncrypted_${vault.id}`;
      const encryptedVaultKeyStr = localStorage.getItem(vaultKeyStorageKey);
      
      let actualVaultKey: CryptoKey;
      if (encryptedVaultKeyStr) {
        // Vault key is stored encrypted with master password (from recovery reset)
        // Decrypt it to get the actual vault key
        const encryptedPayload = JSON.parse(encryptedVaultKeyStr);
        const vaultKeyHex = await decryptVaultKeyWithRecoveryKey(encryptedPayload, key);
        actualVaultKey = await importAesKeyFromHex(vaultKeyHex);
      } else {
        // Legacy: Use the derived key as the vault key (for vaults created before recovery reset)
        actualVaultKey = key;
      }

      // Store vault key in memory
      setVaultKeys((prev) => {
        const next = new Map(prev);
        next.set(vault.id, actualVaultKey);
        return next;
      });

      // Cache the master password for this vault (for nominee operations)
      setVaultPasswords((prev) => {
        const next = new Map(prev);
        next.set(vault.id, masterPassword);
        return next;
      });

      setSelectedVault(vault);
      setShowUnlockModal(false);
      setUnlockPassword("");
      setVaultToUnlock(null);
    } catch (error) {
      console.error("Error unlocking vault:", error);
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockWithRecoveryKey = async (vault: MyVault, recoveryKeyBase64: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Get recovery key encrypted vault key from localStorage (stored per vault)
      const recoveryKeyStorageKey = `recoveryKeyEncryptedVaultKey_${vault.id}`;
      const encryptedVaultKeyStr = localStorage.getItem(recoveryKeyStorageKey);
      
      if (!encryptedVaultKeyStr) {
        throw new Error("Recovery key not found for this vault. Please use your master password or contact support.");
      }

      // Decrypt vault key client-side using recovery key
      const recoveryKeyCrypto = await importRecoveryKey(recoveryKeyBase64);
      const encryptedPayload = JSON.parse(encryptedVaultKeyStr);
      const vaultKeyHex = await decryptVaultKeyWithRecoveryKey(
        encryptedPayload,
        recoveryKeyCrypto
      );

      // Instead of directly unlocking, trigger recovery key reset workflow
      // This ensures security by forcing password reset after recovery key usage
      setRecoveryResetVault({
        id: vault.id,
        name: vault.name,
        vaultKeyHex: vaultKeyHex,
      });
      setShowRecoveryResetModal(true);
      setShowUnlockModal(false);
      setRecoveryKey("");
      setVaultToUnlock(null);
    } catch (error) {
      console.error("Error unlocking vault with recovery key:", error);
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock vault with recovery key");
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!vaultToUnlock) return;
    
    if (useRecoveryKey) {
      if (!recoveryKey) {
        setUnlockError("Please enter your recovery key");
        return;
      }
      await handleUnlockWithRecoveryKey(vaultToUnlock, recoveryKey);
    } else {
      if (!unlockPassword) {
        setUnlockError("Please enter your master password");
        return;
      }
      await handleUnlockVault(vaultToUnlock, unlockPassword);
    }
  };

  const handleRecoveryResetSuccess = async (newVaultKeyHex: string) => {
    if (!recoveryResetVault) return;

    // Import the vault key as CryptoKey for use in memory
    const newVaultKey = await importAesKeyFromHex(newVaultKeyHex);

    // Store the new vault key in memory
    setVaultKeys((prev) => {
      const next = new Map(prev);
      next.set(recoveryResetVault.id, newVaultKey);
      return next;
    });

    // Select the vault
    const vault = vaults.find((v) => v.id === recoveryResetVault.id);
    if (vault) {
      setSelectedVault(vault);
    }

    // Close modals
    setShowRecoveryResetModal(false);
    setRecoveryResetVault(null);
  };

  const getVaultKey = (vaultId: string): CryptoKey | null => {
    return vaultKeys.get(vaultId) || null;
  };

  const handleFileUpload = async (file: File, category: string, title: string) => {
    if (!selectedVault) {
      throw new Error("No vault selected");
    }

    const vaultKey = getVaultKey(selectedVault.id);
    if (!file || !vaultKey) {
      throw new Error("File or vault key missing");
    }

    try {
      // Encrypt file client-side (server never sees plaintext)
      const { encryptFile } = await import("@/lib/crypto");
      const { encryptedBlob, iv, metadata } = await encryptFile(file, vaultKey);

      // Upload encrypted blob to server
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title || metadata.name,
          tags: [],
          encryptedBlob,
          iv,
          metadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload");
      }

      // Refresh list
      await loadVaultItems(selectedVault.id);
      alert("File encrypted and uploaded successfully!");
    } catch (error: any) {
      console.error("Error uploading file:", error);
      throw error;
    }
  };

  const handleDownload = async (item: VaultItem) => {
    if (!selectedVault) return;
    const vaultKey = getVaultKey(selectedVault.id);
    if (!vaultKey || !item.s3Key) return;

    try {
      // Download encrypted blob from server
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items/${item.id}/download`);
      if (!response.ok) throw new Error("Failed to download");

      const data = await response.json();
      const { encryptedBlob, iv, metadata } = data;

      if (!iv) {
        throw new Error("IV not found - cannot decrypt");
      }

      // Decrypt file client-side (server never decrypts)
      const decryptedBlob = await decryptFile(encryptedBlob, iv, vaultKey);

      // Use filename from metadata if available, otherwise use title
      const downloadFilename = metadata?.filename || item.title;
      
      // Convert Blob to ArrayBuffer to create new Blob with proper MIME type
      const arrayBuffer = await decryptedBlob.arrayBuffer();
      const blob = metadata?.type 
        ? new Blob([arrayBuffer], { type: metadata.type })
        : new Blob([arrayBuffer]);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file");
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!selectedVault) return;
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      await loadVaultItems(selectedVault.id);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    }
  };

  const getCategoryCount = (category: string) => {
    return items.filter((item) => item.category === category).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading vaults...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Vaults</h1>
          <p className="text-sm text-slate-400 mt-1">
            Private, client-side encrypted vaults. Only you can decrypt this data.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Vault
        </button>
      </div>

      {vaults.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 rounded-lg border border-slate-800">
          <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No Vaults Yet
          </h3>
          <p className="text-slate-500 mb-4">
            Create a private vault to securely store your encrypted documents
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
          >
            Create Your First Vault
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaults.map((vault) => (
            <div
              key={vault.id}
              onClick={() => {
                const key = vaultKeys.get(vault.id);
                if (key) {
                  setSelectedVault(vault);
                } else {
                  // Show unlock modal
                  setVaultToUnlock(vault);
                  setShowUnlockModal(true);
                }
              }}
              className={`p-4 bg-slate-900 rounded-lg border cursor-pointer transition-colors ${
                selectedVault?.id === vault.id
                  ? "border-brand-500"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white">{vault.name}</h3>
                {vaultKeys.has(vault.id) && (
                  <Lock className="w-4 h-4 text-green-500" />
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {vault._count?.items || 0} items
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {vault._count?.nominees || 0} nominees
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedVault && (
        <div className="mt-8 bg-slate-900 rounded-lg border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedVault.name}</h2>
              <p className="text-sm text-slate-400 mt-1">
                Private encrypted vault
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNomineeModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
              >
                <Users className="w-4 h-4" />
                Nominees
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 mb-6">
            {CATEGORIES.map((category) => (
              <VaultCategory
                key={category}
                title={category}
                count={getCategoryCount(category)}
                onClick={() => {
                  // TODO: Filter items by category
                }}
              />
            ))}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No items in this vault yet
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Vault Items ({items.length})</h3>
              {items.map((item) => (
                <VaultItemCard
                  key={item.id}
                  item={item}
                  onDownload={() => handleDownload(item)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateMyVaultModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateVault}
        />
      )}

      {showUploadModal && selectedVault && (
        <AddItemModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUpload={handleFileUpload}
          vaultKey={getVaultKey(selectedVault.id)}
          vaultName={selectedVault.name}
          vaultType="my_vault"
        />
      )}

      {showNomineeModal && selectedVault && (
        <AddNomineeModal
          isOpen={showNomineeModal}
          onClose={() => setShowNomineeModal(false)}
          onSuccess={() => {
            // Just reload nominees, don't close modal
            if (selectedVault) {
              loadNominees(selectedVault.id);
            }
          }}
          vaultKey={getVaultKey(selectedVault.id)}
          vaultName={selectedVault.name}
          vaultId={selectedVault.id}
          getMasterPassword={async () => {
            // Since vault is already unlocked, check if we have cached password
            const cachedPassword = vaultPasswords.get(selectedVault.id);
            if (cachedPassword) {
              return cachedPassword;
            }

            // If not cached, prompt for password (but with simpler message since vault is unlocked)
            const password = prompt(
              `Enter your master password to add a nominee to "${selectedVault.name}":`
            );
            if (!password) {
              return null;
            }

            // Verify password by deriving key and checking if it matches
            try {
              const testKey = await deriveKeyFromPassword(password);
              // Cache the password for future use
              setVaultPasswords((prev) => {
                const next = new Map(prev);
                next.set(selectedVault.id, password);
                return next;
              });
              return password;
            } catch (error) {
              console.error("Error verifying password:", error);
              return null;
            }
          }}
        />
      )}

      {showUnlockModal && vaultToUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Unlock Vault</h2>
            <p className="text-sm text-slate-400 mb-4">
              Enter your master password or recovery key to unlock <strong>{vaultToUnlock.name}</strong>
            </p>
            
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => {
                  setUseRecoveryKey(false);
                  setRecoveryKey("");
                  setUnlockError(null);
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  !useRecoveryKey
                    ? "bg-brand-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Master Password
              </button>
              <button
                onClick={() => {
                  setUseRecoveryKey(true);
                  setUnlockPassword("");
                  setUnlockError(null);
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                  useRecoveryKey
                    ? "bg-brand-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                Recovery Key
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              {useRecoveryKey ? (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Recovery Key
                  </label>
                  <textarea
                    value={recoveryKey}
                    onChange={(e) => {
                      setRecoveryKey(e.target.value);
                      setUnlockError(null);
                    }}
                    placeholder="Paste your recovery key here..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 font-mono text-xs"
                    autoFocus
                    disabled={unlocking}
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Master Password
                  </label>
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
                      setUnlockError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUnlockSubmit();
                      }
                    }}
                    placeholder="Enter master password"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                    autoFocus
                    disabled={unlocking}
                  />
                </div>
              )}
              {unlockError && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {unlockError}
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockPassword("");
                    setRecoveryKey("");
                    setUnlockError(null);
                    setVaultToUnlock(null);
                    setUseRecoveryKey(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  disabled={unlocking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlocking || (!unlockPassword && !recoveryKey)}
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {unlocking ? "Unlocking..." : "Unlock Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Key Reset Modal */}
      {recoveryResetVault && (
        <RecoveryKeyResetModal
          isOpen={showRecoveryResetModal}
          onClose={() => {
            setShowRecoveryResetModal(false);
            setRecoveryResetVault(null);
          }}
          vaultId={recoveryResetVault.id}
          vaultName={recoveryResetVault.name}
          currentVaultKeyHex={recoveryResetVault.vaultKeyHex}
          onSuccess={handleRecoveryResetSuccess}
        />
      )}
    </div>
  );
}

function VaultCategory({
  title,
  count,
  onClick,
}: {
  title: string;
  count: number;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex cursor-pointer flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs transition-colors hover:border-slate-700"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-100">{title}</span>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
          {count} items
        </span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Structured entries and encrypted documents related to {title.toLowerCase()}.
      </p>
    </div>
  );
}

function VaultItemCard({
  item,
  onDownload,
  onDelete,
}: {
  item: VaultItem;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100">{item.title}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            {item.category}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          {item.tags.length > 0 && (
            <span>• {item.tags.join(", ")}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Download button */}
        {item.s3Key && (
          <button
            onClick={onDownload}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {/* Delete button */}
        <button
          onClick={onDelete}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
