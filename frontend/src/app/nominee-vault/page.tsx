"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { importAesKeyFromHex, decryptFile } from "@/lib/crypto";

type VaultItem = {
  id: string;
  category: string;
  title: string;
  tags: string[];
  s3Key?: string | null;
  iv?: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function NomineeVaultPage() {
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vaultType, setVaultType] = useState<"my_vault" | "family_vault" | null>(null);
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [vaultName, setVaultName] = useState<string | null>(null);

  useEffect(() => {
    // Load reconstructed key and vault info from sessionStorage
    const keyHex = sessionStorage.getItem("nomineeReconstructedKey");
    const storedVaultType = sessionStorage.getItem("nomineeVaultType") as "my_vault" | "family_vault" | null;
    const storedVaultId = sessionStorage.getItem("nomineeVaultId");
    const storedVaultName = sessionStorage.getItem("nomineeVaultName");

    if (!keyHex) {
      setError(
        "Nominee key not found. Please unlock the vault again from the Nominee Access page."
      );
      return;
    }

    setVaultType(storedVaultType || "my_vault");
    setVaultId(storedVaultId);
    setVaultName(storedVaultName);

    const initKey = async () => {
      try {
        const key = await importAesKeyFromHex(keyHex);
        setVaultKey(key);
      } catch (e: any) {
        console.error("Failed to import nominee key:", e);
        setError(
          "Failed to initialize decryption key. Please unlock the vault again."
        );
      }
    };

    initKey();
  }, []);

  useEffect(() => {
    if (!vaultKey || !vaultType) return;
    const fetchItems = async () => {
      try {
        setLoading(true);
        // Fetch items based on vault type
        const url = vaultType === "family_vault" && vaultId
          ? `/api/nominee/vault?type=family_vault&vaultId=${vaultId}`
          : "/api/nominee/vault?type=my_vault";
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to fetch nominee vault items");
        }
        setItems(data.items || []);
      } catch (err: any) {
        console.error("Error fetching nominee vault items:", err);
        setError(err.message || "Failed to fetch nominee vault items");
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [vaultKey, vaultType, vaultId]);

  const handleDownload = async (item: VaultItem) => {
    if (!vaultKey || !item.id) return;

    try {
      // Build download URL with vault type info
      const url = vaultType === "family_vault" && vaultId
        ? `/api/nominee/vault/${item.id}/download?type=family_vault&vaultId=${vaultId}`
        : `/api/nominee/vault/${item.id}/download?type=my_vault`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to download file");
      }

      const { encryptedBlob, iv, metadata } = data;
      if (!encryptedBlob || !iv) {
        throw new Error("Missing encrypted data or IV");
      }

      const decryptedBlob = await decryptFile(encryptedBlob, iv, vaultKey);

      // Use filename from metadata if available, otherwise use title
      const downloadFilename = metadata?.filename || item.title;
      
      // Convert Blob to ArrayBuffer to create new Blob with proper MIME type
      const arrayBuffer = await decryptedBlob.arrayBuffer();
      const blob = metadata?.type 
        ? new Blob([arrayBuffer], { type: metadata.type })
        : new Blob([arrayBuffer]);

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      console.error("Error downloading nominee file:", err);
      alert(err.message || "Failed to download file");
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nominee Vault (Read-Only)
        </h1>
        <div className="rounded-xl border border-red-800/50 bg-red-900/20 p-4 text-sm text-red-200">
          <p className="mb-2">{error}</p>
          <button
            onClick={() => router.push("/nominee-access")}
            className="mt-2 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            Go to Nominee Access
          </button>
        </div>
      </div>
    );
  }

  if (!vaultKey) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Nominee Vault (Read-Only)
        </h1>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-xs text-slate-300">
            Initializing decryption key. If this takes too long, please unlock
            the vault again from the Nominee Access page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Nominee Vault (Read-Only)
          </h1>
          <p className="mt-1 text-xs text-slate-300">
            You are viewing this {vaultType === "family_vault" ? "Family Vault" : "Personal Vault"} in read-only mode as an approved nominee.
            {vaultName && <span className="ml-1 font-medium">({vaultName})</span>}
          </p>
        </div>
        <button
          onClick={() => {
            // Clear nominee session on client side
            sessionStorage.removeItem("nomineeReconstructedKey");
            sessionStorage.removeItem("nomineeVaultType");
            sessionStorage.removeItem("nomineeVaultId");
            sessionStorage.removeItem("nomineeVaultName");
            router.push("/nominee-access");
          }}
          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
        >
          Exit Nominee View
        </button>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Vault Items ({items.length})</h2>
        {loading ? (
          <p className="text-xs text-slate-400">Loading...</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">
            No items available in this vault.
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-100">
                      {item.title}
                    </span>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                      {item.category}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    {item.tags && item.tags.length > 0 && (
                      <span>• {item.tags.join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Download button - read-only access for nominees */}
                  {item.s3Key && item.iv && (
                    <button
                      onClick={() => handleDownload(item)}
                      className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}


