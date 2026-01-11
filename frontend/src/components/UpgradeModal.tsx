"use client";

import { X, Sparkles, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType?: "vaults" | "nominees" | "members" | "storage";
  currentCount?: number;
  maxAllowed?: number;
  currentStorageMB?: number;
  fileSizeMB?: number;
  message?: string;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  limitType,
  currentCount,
  maxAllowed,
  currentStorageMB,
  fileSizeMB,
  message,
}: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    router.push("/upgrade-now");
  };

  const getLimitMessage = () => {
    if (message) return message;
    
    switch (limitType) {
      case "vaults":
        return `You have reached the maximum number of vaults (${maxAllowed}) for your free plan.`;
      case "nominees":
        return `Free plan allows only 1 nominee. You currently have ${currentCount} nominee${currentCount !== 1 ? 's' : ''}.`;
      case "members":
        return `Free plan allows up to 2 additional members. You currently have ${currentCount} additional member${currentCount !== 1 ? 's' : ''}.`;
      case "storage":
        const used = currentStorageMB?.toFixed(2) || "0";
        const fileSize = fileSizeMB?.toFixed(2) || "0";
        return `File size (${fileSize} MB) would exceed your 5 MB storage limit. You're currently using ${used} MB.`;
      default:
        return "You've reached a limit on your free plan.";
    }
  };

  const plusFeatures = [
    "Unlimited storage",
    "Unlimited members",
    "Multiple nominees (priority order)",
    "App & Vault password rotation reminders",
    "Priority support",
    "Export vault (PDF/ZIP for offline safekeeping)",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-8 w-8" />
            <h2 className="text-2xl font-bold">Upgrade to LivPeace Plus</h2>
          </div>
          <p className="text-blue-100 text-sm">
            {getLimitMessage()}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Unlock unlimited access with LivPeace Plus
            </h3>
            <ul className="space-y-3">
              {plusFeatures.map((feature, index) => (
                <li key={index} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pricing */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-gray-900">₹99</span>
              <span className="text-gray-600">/month</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Cancel anytime. No commitment.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Maybe Later
            </button>
            <button
              onClick={handleUpgrade}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

