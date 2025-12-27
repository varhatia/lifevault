"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type DeleteVaultModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vaultName: string;
  vaultId: string;
  vaultType: "my_vault" | "family_vault";
  itemsCount: number;
  membersCount?: number;
  nomineesCount: number;
  onDelete: () => Promise<void>;
};

export default function DeleteVaultModal({
  isOpen,
  onClose,
  vaultName,
  vaultId,
  vaultType,
  itemsCount,
  membersCount,
  nomineesCount,
  onDelete,
}: DeleteVaultModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const hasContent = itemsCount > 0 || (membersCount && membersCount > 1) || nomineesCount > 0;
  const isConfirmed = confirmText.trim() === vaultName;
  const vaultTypeLabel = vaultType === "my_vault" ? "Personal Vault" : "Family Vault";

  const handleDelete = async () => {
    if (!isConfirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await onDelete();
      onClose();
      setConfirmText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vault");
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) {
      setConfirmText("");
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-red-500/20 p-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Delete {vaultTypeLabel}</h2>
              <p className="text-sm text-slate-400 mt-1">This action cannot be undone.</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={deleting}
            className="text-slate-400 hover:text-slate-200 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {hasContent && (
          <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-sm font-medium text-amber-400 mb-2">
              Warning: This vault contains:
            </p>
            <ul className="text-xs text-amber-300 space-y-1 list-disc list-inside">
              {itemsCount > 0 && (
                <li>{itemsCount} item{itemsCount !== 1 ? "s" : ""} (including encrypted files)</li>
              )}
              {membersCount !== undefined && membersCount > 1 && (
                <li>{membersCount} member{membersCount !== 1 ? "s" : ""}</li>
              )}
              {nomineesCount > 0 && (
                <li>{nomineesCount} nominee{nomineesCount !== 1 ? "s" : ""}</li>
              )}
            </ul>
            <p className="text-xs text-amber-300 mt-2">
              All of this will be permanently deleted.
            </p>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm text-slate-300 mb-3">
            To confirm deletion, type the vault name <strong className="text-white">{vaultName}</strong> below:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={vaultName}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            disabled={deleting}
            autoFocus
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={deleting}
            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || deleting}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting..." : "Delete Vault"}
          </button>
        </div>
      </div>
    </div>
  );
}

