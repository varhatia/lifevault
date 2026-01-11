"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, Gift, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePlanUsage } from "@/hooks/usePlanUsage";

export default function UpgradeNowPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { refetch: refetchPlan } = usePlanUsage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirmUpgrade = async () => {
    if (!confirmed) {
      setError("Please confirm to proceed with the upgrade");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/account/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upgrade account");
      }

      // Refetch plan usage to get updated plan
      await refetchPlan();

      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to my-vault page with success message
      router.push("/my-vault?upgraded=true");
    } catch (err) {
      console.error("Error upgrading account:", err);
      setError(err instanceof Error ? err.message : "Failed to upgrade account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/my-vault");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full p-4">
              <Sparkles className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Thank You for Your Interest!
          </h1>
          <p className="text-lg text-gray-600">
            We're excited to have you join LivPeace Plus
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Gift className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Special Early Access Offer</h2>
            </div>
            <p className="text-blue-100">
              As one of our first customers, enjoy 3 months of LivPeace Plus absolutely free!
            </p>
          </div>

          {/* Content */}
          <div className="p-6 md:p-8 space-y-6">
            {/* Thank You Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                Thank you for expressing interest in LivPeace Plus! We've taken note of your interest 
                and are working on integrating a payment gateway for a seamless subscription experience.
              </p>
            </div>

            {/* Payment Gateway Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 leading-relaxed">
                <strong>Note:</strong> We're currently setting up our payment gateway. Once integrated, 
                you'll be able to manage your subscription seamlessly. For now, we're offering this 
                special early access opportunity.
              </p>
            </div>

            {/* Offer Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Gift className="h-5 w-5 text-blue-600" />
                What You'll Get
              </h3>
              <ul className="space-y-3">
                {[
                  "3 months of LivPeace Plus absolutely free",
                  "Unlimited storage for all your documents",
                  "Unlimited members and nominees",
                  "Priority support",
                  "All premium features unlocked",
                ].map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirmation Checkbox */}
            <div className="border-t border-gray-200 pt-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => {
                    setConfirmed(e.target.checked);
                    setError(null);
                  }}
                  className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    I confirm that I want to upgrade to LivPeace Plus
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    By confirming, your account will be upgraded to Plus plan with 3 months free access. 
                    After 3 months, we'll notify you about subscription options.
                  </p>
                </div>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpgrade}
                disabled={loading || !confirmed}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  <>
                    Confirm & Upgrade
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Questions? Contact us at{" "}
            <a href="mailto:support@livpeace.com" className="text-blue-600 hover:underline">
              support@livpeace.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

