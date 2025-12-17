"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { encryptFile, deriveKeyFromPassword, decryptFile, encryptTextData, decryptTextData } from "@/lib/crypto";
import { useAuth } from "@/lib/hooks/useAuth";
import AddItemModal from "@/components/vaults/AddItemModal";
import CreateMyVaultModal from "./components/CreateMyVaultModal";
import { Download, Trash2 } from "lucide-react";

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
  keyHex: string;
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
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [vaults, setVaults] = useState<MyVault[]>([]);
  const [selectedVault, setSelectedVault] = useState<MyVault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [vaultToUnlock, setVaultToUnlock] = useState<MyVault | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [vaultKeys, setVaultKeys] = useState<Map<string, VaultKey>>(new Map());

  // Check authentication
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

  // Load items when vault is selected and unlocked
  useEffect(() => {
    if (selectedVault && vaultKeys.has(selectedVault.id)) {
      loadVaultItems(selectedVault.id);
    }
  }, [selectedVault, vaultKeys]);

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
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };


  const handleUnlockVault = async (vault: MyVault, masterPassword: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Derive key from master password
      const verifierKey = await deriveKeyFromPassword(masterPassword, false);

      // Check vault-specific verifier
      const verifierKeyStorage = `vaultVerifier_${vault.id}`;
      const verifierRaw = localStorage.getItem(verifierKeyStorage);
      
      if (verifierRaw) {
        try {
          const payload = JSON.parse(verifierRaw);
          const data = await decryptTextData(payload, verifierKey);
          if (data && data.verifier === "lifevault-v1" && data.vaultId === vault.id) {
            // Verifier check passed
          } else {
            throw new Error("Invalid password for this vault");
          }
        } catch (e) {
          throw new Error("Invalid password for this vault");
        }
      }

      // Get encrypted vault key from localStorage
      const encryptedKeyStr = localStorage.getItem(`my_vault_${vault.id}`);
      if (!encryptedKeyStr) {
        throw new Error("Vault key not found. Please recreate the vault or use recovery key.");
      }

      const encryptedKey = JSON.parse(encryptedKeyStr);
      const decryptedData = await decryptTextData(encryptedKey, verifierKey);
      const keyHex = decryptedData.keyHex;

      // Store in memory
      setVaultKeys((prev) => {
        const next = new Map(prev);
        next.set(vault.id, { vaultId: vault.id, keyHex });
        return next;
      });

      // Select the vault
      setSelectedVault(vault);
      setShowUnlockModal(false);
      setUnlockPassword("");
    } catch (error) {
      console.error("Error unlocking vault:", error);
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!vaultToUnlock) return;
    
    if (!unlockPassword) {
      setUnlockError("Please enter your master password");
      return;
    }
    await handleUnlockVault(vaultToUnlock, unlockPassword);
  };

  const handleSelectVault = (vault: MyVault) => {
    // Check if vault is already unlocked
    if (vaultKeys.has(vault.id)) {
      setSelectedVault(vault);
    } else {
      // Show unlock modal
      setVaultToUnlock(vault);
      setShowUnlockModal(true);
      setUnlockPassword("");
      setUnlockError(null);
    }
  };

  const handleFileUpload = async (file: File, category: string, title: string) => {
    if (!selectedVault) {
      throw new Error("No vault selected");
    }

    const vaultKeyData = vaultKeys.get(selectedVault.id);
    if (!vaultKeyData) {
      throw new Error("Vault is not unlocked");
    }

    // Import vault key from hex
    const keyArray = new Uint8Array(
      vaultKeyData.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const vaultKey = await crypto.subtle.importKey(
      "raw",
      keyArray,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    try {
      // Encrypt file client-side
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
    } catch (error: any) {
      console.error("Error uploading file:", error);
      throw error;
    }
  };

  const handleDownload = async (item: VaultItem) => {
    if (!selectedVault) return;
    
    const vaultKeyData = vaultKeys.get(selectedVault.id);
    if (!vaultKeyData || !item.s3Key) return;

    try {
      // Import vault key from hex
      const keyArray = new Uint8Array(
        vaultKeyData.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      const vaultKey = await crypto.subtle.importKey(
        "raw",
        keyArray,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // Download encrypted blob from server
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items/${item.id}/download`);
      if (!response.ok) throw new Error("Failed to download");

      const data = await response.json();
      const { encryptedBlob, iv } = data;

      if (!iv) {
        throw new Error("IV not found - cannot decrypt");
      }

      // Decrypt file client-side (encryptedBlob is base64 string)
      const decryptedBlob = await decryptFile(encryptedBlob, iv, vaultKey);

      // Create download link
      const url = URL.createObjectURL(decryptedBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.title;
      a.click();
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

  if (!authLoading && !isAuthenticated) {
    return null;
  }

  if (loading && vaults.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">My Vaults</h1>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-xs text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Unlock Modal */}
      {showUnlockModal && vaultToUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Unlock {vaultToUnlock.name}</h2>
            <p className="text-sm text-slate-400 mb-4">
              Enter your master password to unlock this vault
            </p>
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
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
                    setVaultToUnlock(null);
                    setUnlockPassword("");
                    setUnlockError(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  disabled={unlocking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlocking || !unlockPassword}
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {unlocking ? "Unlocking..." : "Unlock Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Vault Modal */}
      {showCreateModal && (
        <CreateMyVaultModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={async (vaultId, vaultKey) => {
            // CreateMyVaultModal handles vault creation and storage
            // Export key as hex for storage in memory
            const exportedKey = await crypto.subtle.exportKey("raw", vaultKey);
            const keyArray = new Uint8Array(exportedKey);
            const keyHex = Array.from(keyArray)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            
            // Store in memory
            setVaultKeys((prev) => {
              const next = new Map(prev);
              next.set(vaultId, { vaultId, keyHex });
              return next;
            });
            
            setShowCreateModal(false);
            await loadVaults(); // Refresh vault list
            
            // Select the newly created vault after loading
            setTimeout(() => {
              const newVault = vaults.find(v => v.id === vaultId);
              if (newVault) {
                setSelectedVault(newVault);
              }
            }, 100);
          }}
        />
      )}

      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Vaults</h1>
            <p className="mt-1 text-xs text-slate-300">
              Private, client-side encrypted vaults. Each vault has its own password.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700"
          >
            + Create Vault
          </button>
        </header>

        {/* Vault List */}
        {vaults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <p className="text-sm text-slate-300 mb-4">No vaults yet. Create your first vault to get started.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Create Your First Vault
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vaults.map((vault) => {
              const isUnlocked = vaultKeys.has(vault.id);
              const isSelected = selectedVault?.id === vault.id;
              return (
                <div
                  key={vault.id}
                  onClick={() => handleSelectVault(vault)}
                  className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-brand-500 bg-slate-900"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white">{vault.name}</h3>
                      <div className="mt-2 flex gap-3 text-xs text-slate-400">
                        <span>{vault._count?.items || 0} items</span>
                        <span>•</span>
                        <span>{vault._count?.nominees || 0} nominees</span>
                      </div>
                    </div>
                    {isUnlocked && (
                      <span className="rounded-full bg-brand-500/20 px-2 py-1 text-[10px] text-brand-300">
                        Unlocked
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Vault Content */}
        {selectedVault && vaultKeys.has(selectedVault.id) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedVault.name}</h2>
                <p className="text-xs text-slate-400 mt-1">Items in this vault</p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700"
              >
                + Add item
              </button>
            </div>

            {showUploadModal && (
              <AddItemModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                vaultName={selectedVault.name}
                vaultType="my_vault"
                vaultKey={null} // We'll handle encryption in handleFileUpload
                onUpload={handleFileUpload}
              />
            )}

            <div className="grid gap-3 md:grid-cols-3">
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

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Vault Items ({items.length})</h3>
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">
                  No items yet. Upload your first encrypted file to get started.
                </div>
              ) : (
                <div className="space-y-2">
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
            </section>
          </div>
        )}
      </div>
    </>
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
      <div className="flex gap-2">
        {item.s3Key && (
          <button
            onClick={onDownload}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded-md bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900/70 flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}
