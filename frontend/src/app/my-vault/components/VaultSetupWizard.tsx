"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronRight, FileText, Building2, UserCheck, Shield, Heart, ArrowRight } from "lucide-react";
import Link from "next/link";

type SetupStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  categoryId?: string;
  actionType: "upload" | "add_nominee";
  completed: boolean;
  count?: number;
  requiredCount?: number;
};

type VaultSetupWizardProps = {
  items: Array<{
    id: string;
    category: string;
    tags: string[];
    encryptedMetadata?: string | null;
  }>;
  nomineesCount: number;
  vaultId: string;
  vaultName: string;
  isOwner: boolean;
  onCategoryClick: (categoryId: string) => void;
  onAddNominee: () => void;
  readinessScore?: number | null;
};

export default function VaultSetupWizard({
  items,
  nomineesCount,
  vaultId,
  vaultName,
  isOwner,
  onCategoryClick,
  onAddNominee,
  readinessScore,
}: VaultSetupWizardProps) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);

  // Check if each step is completed
  const steps: SetupStep[] = useMemo(() => {
    // Step 1: Upload IDs - Must have both Aadhaar and PAN
    const idItems = items.filter(item => item.category === "identity-vital");
    const hasAadhaar = idItems.some(item => 
      item.tags.some(tag => 
        tag.toLowerCase() === "aadhaar" || 
        tag.toLowerCase() === "aadhar" ||
        tag.toLowerCase().includes("aadhaar") ||
        tag.toLowerCase().includes("aadhar")
      )
    );
    const hasPAN = idItems.some(item => 
      item.tags.some(tag => 
        tag.toLowerCase() === "pan" || 
        tag.toLowerCase().includes("pan")
      )
    );
    const hasIds = hasAadhaar && hasPAN;

    // Step 2: Upload at least 1 bank account
    const bankItems = items.filter(item => item.category === "finance-investments");
    const hasBankAccount = bankItems.length >= 1;

    // Step 3: Add at least 1 nominee
    const hasNominee = nomineesCount >= 1;

    // Step 4: Upload 1 life/term insurance
    const insuranceItems = items.filter(item => item.category === "insurance");
    // Check for life/term insurance by checking tags or metadata
    // We'll check tags for "life-term-insurance" or "Life (Term)"
    const hasLifeInsurance = insuranceItems.some(item => 
      item.tags.some(tag => 
        tag.toLowerCase().includes("life") || 
        tag.toLowerCase().includes("term") ||
        tag === "life-term-insurance"
      )
    );

    // Step 5: Upload 1 health insurance
    const hasHealthInsurance = insuranceItems.some(item =>
      item.tags.some(tag =>
        tag.toLowerCase().includes("health") ||
        tag === "health-insurance"
      )
    );

    return [
      {
        id: "ids",
        title: "Upload Identity Documents",
        description: "Add both Aadhaar and PAN (mandatory)",
        icon: <FileText className="w-5 h-5" />,
        categoryId: "identity-vital",
        actionType: "upload",
        completed: hasIds,
        count: (hasAadhaar ? 1 : 0) + (hasPAN ? 1 : 0),
        requiredCount: 2,
      },
      {
        id: "bank-account",
        title: "Add Bank Account",
        description: "Upload at least 1 bank account document",
        icon: <Building2 className="w-5 h-5" />,
        categoryId: "finance-investments",
        actionType: "upload",
        completed: hasBankAccount,
        count: bankItems.length,
        requiredCount: 1,
      },
      {
        id: "nominee",
        title: "Add Nominee",
        description: "Assign at least 1 nominee to your vault",
        icon: <UserCheck className="w-5 h-5" />,
        actionType: "add_nominee",
        completed: hasNominee,
        count: nomineesCount,
        requiredCount: 1,
      },
      {
        id: "life-insurance",
        title: "Upload Life/Term Insurance",
        description: "Add your life or term insurance policy",
        icon: <Shield className="w-5 h-5" />,
        categoryId: "insurance",
        actionType: "upload",
        completed: hasLifeInsurance,
        count: insuranceItems.filter(item => 
          item.tags.some(tag => 
            tag.toLowerCase().includes("life") || 
            tag.toLowerCase().includes("term") ||
            tag === "life-term-insurance"
          )
        ).length,
        requiredCount: 1,
      },
      {
        id: "health-insurance",
        title: "Upload Health Insurance",
        description: "Add your health insurance policy",
        icon: <Heart className="w-5 h-5" />,
        categoryId: "insurance",
        actionType: "upload",
        completed: hasHealthInsurance,
        count: insuranceItems.filter(item =>
          item.tags.some(tag =>
            tag.toLowerCase().includes("health") ||
            tag === "health-insurance"
          )
        ).length,
        requiredCount: 1,
      },
    ];
  }, [items, nomineesCount]);

  // Check if all steps are completed
  const allStepsCompleted = useMemo(() => {
    return steps.every(step => step.completed);
  }, [steps]);

  useEffect(() => {
    if (allStepsCompleted && !isCompleted) {
      setIsCompleted(true);
      setShowCompletion(true);
    }
  }, [allStepsCompleted, isCompleted]);

  const handleStepClick = (step: SetupStep) => {
    if (step.completed) return;
    
    if (step.actionType === "upload" && step.categoryId) {
      onCategoryClick(step.categoryId);
    } else if (step.actionType === "add_nominee") {
      onAddNominee();
    }
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  // Don't show wizard if user is not owner or if already completed
  if (!isOwner) {
    return null;
  }

  // Show completion message
  if (showCompletion && allStepsCompleted) {
    return (
      <div className="rounded-2xl border border-brand-500/50 bg-gradient-to-br from-brand-500/10 to-brand-600/5 p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-500/20">
            <Check className="h-10 w-10 text-brand-400" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">
          🎉 Congratulations!
        </h2>
        <p className="text-lg text-slate-300 mb-4">
          Your basic vault setup is complete!
        </p>
        <p className="text-sm text-slate-400 mb-6">
          You've successfully completed all 5 essential steps. Your vault is now ready to help protect your family's future.
        </p>
        
        {readinessScore !== null && readinessScore !== undefined && (
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-lg bg-slate-900/50 px-4 py-2 border border-slate-700">
              <span className="text-sm text-slate-400">Your Readiness Score:</span>
              <span className="text-2xl font-bold text-brand-400">{readinessScore}</span>
              <span className="text-sm text-slate-400">/ 100</span>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => setShowCompletion(false)}
            className="rounded-md bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Continue to Vault
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Complete Your Vault Setup
        </h2>
        <p className="text-sm text-slate-400">
          Follow these 5 essential steps to secure your family's future. Complete all steps to finish your basic vault setup.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>Progress</span>
          <span>{completedCount} of {steps.length} steps completed</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => handleStepClick(step)}
            disabled={step.completed}
            className={`w-full text-left rounded-lg border p-4 transition-all ${
              step.completed
                ? "border-brand-500/50 bg-brand-500/10 cursor-default"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900 cursor-pointer"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 mt-0.5 ${
                step.completed ? "text-brand-400" : "text-slate-400"
              }`}>
                {step.completed ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20">
                    <Check className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-medium">
                    {index + 1}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`${step.completed ? "text-brand-400" : "text-slate-300"}`}>
                    {step.icon}
                  </div>
                  <h3 className={`text-sm font-semibold ${
                    step.completed ? "text-brand-300" : "text-white"
                  }`}>
                    {step.title}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  {step.description}
                </p>
                {step.count !== undefined && (
                  <div className="text-xs text-slate-500">
                    {step.completed ? (
                      <span className="text-brand-400">✓ Completed</span>
                    ) : (
                      <span>
                        {step.count} / {step.requiredCount} {step.actionType === "upload" ? "uploaded" : "added"}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!step.completed && (
                <ChevronRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {allStepsCompleted && !showCompletion && (
        <div className="mt-6 p-4 rounded-lg bg-brand-500/10 border border-brand-500/30">
          <p className="text-sm text-brand-300 text-center">
            🎉 All steps completed! Click to see your completion message.
          </p>
        </div>
      )}
    </div>
  );
}

