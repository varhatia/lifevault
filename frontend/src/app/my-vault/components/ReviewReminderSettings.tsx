"use client";

import { useState, useEffect } from "react";
import { X, Save, Bell } from "lucide-react";

type ReviewReminderSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  onSettingsUpdated: () => void;
};

export default function ReviewReminderSettings({
  isOpen,
  onClose,
  vaultId,
  onSettingsUpdated,
}: ReviewReminderSettingsProps) {
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "biannual">("monthly");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && vaultId) {
      loadSettings();
    }
  }, [isOpen, vaultId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vaults/my/${vaultId}/review/reminder`);
      if (res.ok) {
        const data = await res.json();
        setFrequency(data.reviewReminderFrequency || "monthly");
      }
    } catch (error) {
      console.error("Error loading reminder settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/vaults/my/${vaultId}/review/reminder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save settings");
      }

      onSettingsUpdated();
      onClose();
    } catch (error) {
      console.error("Error saving reminder settings:", error);
      alert(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "monthly":
        return "Every month";
      case "quarterly":
        return "Every 3 months";
      case "biannual":
        return "Every 6 months";
      default:
        return freq;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-xl border border-gray-200 shadow-large w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-brand-600" />
            <h2 className="text-xl font-semibold text-gray-900">Review Reminder Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading settings...</p>
            </div>
          ) : (
            <>
              {/* Frequency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reminder Frequency
                </label>
                <div className="space-y-2">
                  {(["monthly", "quarterly", "biannual"] as const).map((freq) => (
                    <label
                      key={freq}
                      className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                        frequency === freq
                          ? "bg-brand-50 border-brand-500/50"
                          : "bg-white border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="frequency"
                        value={freq}
                        checked={frequency === freq}
                        onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                        className="w-4 h-4 text-brand-500"
                      />
                      <span className="text-sm font-medium text-gray-900">
                        {getFrequencyLabel(freq)}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  You will receive email reminders and in-app notifications once the configured period has passed since your last review.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="px-4 py-2 text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

