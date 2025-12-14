"use client";

import { useState } from "react";
import { encryptFile } from "@/lib/crypto";

type AddItemModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vaultName: string;
  vaultType: "my_vault" | "family_vault";
  // MyVault props
  vaultKey?: CryptoKey | null;
  onUpload?: (file: File, category: string, title: string) => Promise<void>;
  // Family Vault props
  vaultId?: string;
  getSMK?: () => Promise<CryptoKey | null>;
  onSuccess?: () => void;
  // Access text customization
  accessText?: string;
};

export default function AddItemModal({
  isOpen,
  onClose,
  vaultName,
  vaultType,
  vaultKey,
  onUpload,
  vaultId,
  getSMK,
  onSuccess,
  accessText,
}: AddItemModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("Misc");
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const defaultAccessText =
    vaultType === "my_vault"
      ? "All files are encrypted client-side. Only you and authorized nominees can access vault items."
      : "All files are encrypted client-side. Only vault members and authorized nominees can access vault items.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please select a file");
      return;
    }

    if (vaultType === "my_vault") {
      // MyVault: Use callback pattern
      if (!vaultKey || !onUpload) {
        setError("Vault key missing or upload handler not provided");
        return;
      }

      setUploading(true);
      try {
        await onUpload(file, category, title);
        setFile(null);
        setTitle("");
        onClose();
      } catch (error) {
        console.error("Upload error:", error);
        setError(error instanceof Error ? error.message : "Failed to upload file");
      } finally {
        setUploading(false);
      }
    } else {
      // Family Vault: Handle encryption and upload internally
      if (!vaultId || !getSMK || !onSuccess) {
        setError("Vault ID, SMK getter, or success handler not provided");
        return;
      }

      setUploading(true);
      try {
        // Get SMK
        const smk = await getSMK();
        if (!smk) {
          setError("Vault is locked. Please unlock it first.");
          return;
        }

        // Encrypt file with SMK (client-side)
        const { encryptedBlob, iv, metadata } = await encryptFile(file, smk);

        // Upload to server
        const res = await fetch(`/api/family/vaults/${vaultId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category,
            title,
            tags: [],
            encryptedBlob,
            iv,
            metadata,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Failed to upload item");
        }

        // Reset form
        setCategory("Misc");
        setTitle("");
        setFile(null);
        onSuccess();
        onClose();
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to upload item");
      } finally {
        setUploading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Add items to '{vaultName}'</h2>
          <p className="mt-1 text-xs text-slate-400">
            {accessText || defaultAccessText}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              File
            </label>
            <input
              type="file"
              onChange={(e) => {
                const selectedFile = e.target.files?.[0];
                setFile(selectedFile || null);
                if (selectedFile && !title) {
                  setTitle(selectedFile.name);
                }
              }}
              className="block w-full text-xs text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white file:hover:bg-brand-700"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter title"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-brand-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="Finance">Finance</option>
              <option value="Insurance">Insurance</option>
              <option value="Loans">Loans</option>
              <option value="Identity">Identity</option>
              <option value="Medical">Medical</option>
              <option value="Misc">Misc</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

