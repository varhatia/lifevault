"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, Circle, Calendar, AlertCircle, ArrowRight } from "lucide-react";
import { CATEGORIES_CONFIG, CategoryConfig } from "@/components/vaults/types";

type VaultItem = {
  id: string;
  category: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ReviewStatus = {
  lastReviewedAt: string | null;
  reviewReminderFrequency: string;
  reviewReminderDay: number;
  isReviewDue: boolean;
  isOwner: boolean;
};

type VaultReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  vaultId: string;
  items: VaultItem[];
  onReviewComplete: () => void;
  onCategoryClick?: (category: CategoryConfig) => void;
  reviewedCategories?: Set<string>; // Categories that have been reviewed
};

export default function VaultReviewModal({
  isOpen,
  onClose,
  vaultId,
  items,
  onReviewComplete,
  onCategoryClick,
  reviewedCategories: externalReviewedCategories,
}: VaultReviewModalProps) {
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reviewedCategories, setReviewedCategories] = useState<Set<string>>(
    externalReviewedCategories || new Set()
  );

  // Sync with external reviewed categories
  useEffect(() => {
    if (externalReviewedCategories) {
      setReviewedCategories(externalReviewedCategories);
    }
  }, [externalReviewedCategories]);

  useEffect(() => {
    if (isOpen && vaultId) {
      loadReviewStatus();
    }
  }, [isOpen, vaultId]);

  const loadReviewStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/vaults/my/${vaultId}/review`);
      if (res.ok) {
        const data = await res.json();
        setReviewStatus(data);
      }
    } catch (error) {
      console.error("Error loading review status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReview = async () => {
    try {
      setCompleting(true);
      const res = await fetch(`/api/vaults/my/${vaultId}/review`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to complete review");
      }

      await loadReviewStatus();
      onReviewComplete();
      // Show success message briefly before closing
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Error completing review:", error);
      alert(error instanceof Error ? error.message : "Failed to complete review");
    } finally {
      setCompleting(false);
    }
  };


  if (!isOpen) return null;

  // Group items by category
  const itemsByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, VaultItem[]>);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Check if all categories with items are reviewed
  const categoriesWithItems = CATEGORIES_CONFIG.filter(
    (cat) => itemsByCategory[cat.id] && itemsByCategory[cat.id].length > 0
  );
  const allCategoriesReviewed = categoriesWithItems.length > 0 && 
    categoriesWithItems.every((cat) => reviewedCategories.has(cat.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-white rounded-xl border border-gray-200 shadow-large w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Review Your Vault</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review your vault items to ensure all information is up to date
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Review Status */}
        {reviewStatus && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Last reviewed: {formatRelativeTime(reviewStatus.lastReviewedAt)}
                  </span>
                  {reviewStatus.lastReviewedAt && (
                    <span className="text-xs text-gray-500">
                      ({formatDate(reviewStatus.lastReviewedAt)})
                    </span>
                  )}
                </div>
              </div>
              {reviewStatus.isReviewDue && (
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Review due</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading review status...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORIES_CONFIG.map((category) => {
                const categoryItems = itemsByCategory[category.id] || [];
                const hasItems = categoryItems.length > 0;
                const isReviewed = reviewedCategories.has(category.id);

                const priorityColors = {
                  "must-have": "border-red-200 bg-red-50",
                  "good-to-have": "border-amber-200 bg-amber-50",
                  "optional": "border-gray-200 bg-gray-50",
                };

                return (
                  <div
                    key={category.id}
                    className={`border rounded-lg p-4 transition-colors shadow-soft ${
                      priorityColors[category.priority] || "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {category.microcopy}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          {hasItems 
                            ? `${categoryItems.length} item${categoryItems.length !== 1 ? "s" : ""}`
                            : "No items"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Always show Review button if category has items and onCategoryClick is provided */}
                        {hasItems ? (
                          onCategoryClick ? (
                            <button
                              onClick={() => {
                                onCategoryClick(category);
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-brand-600 hover:bg-brand-700 text-white transition-colors text-sm font-medium"
                            >
                              <ArrowRight className="w-4 h-4" />
                              Review
                            </button>
                          ) : null
                        ) : null}
                        {isReviewed && (
                          <div className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-green-50 border border-green-200">
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">
                              Reviewed
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {reviewedCategories.size > 0 && (
                <span>
                  {reviewedCategories.size} categor{reviewedCategories.size !== 1 ? "ies" : "y"} reviewed
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteReview}
                disabled={completing || !allCategoriesReviewed}
                className="px-4 py-2 text-white bg-brand-600 rounded-md hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {completing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Completing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Review</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

