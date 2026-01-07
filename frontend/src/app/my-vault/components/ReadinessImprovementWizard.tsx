"use client";

import { useState, useMemo } from "react";
import { Check, ChevronRight, FileText, Building2, Shield, Key, RefreshCw, Globe, Scale, ArrowRight, X } from "lucide-react";
import Link from "next/link";

type ImprovementAction = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  categoryId?: string;
  actionType: "upload" | "rotate_password" | "rotate_keys" | "add_member";
  points: number; // Points this action would add to readiness score
  completed: boolean;
  priority: "high" | "medium" | "low";
};

type ReadinessImprovementWizardProps = {
  items: Array<{
    id: string;
    category: string;
    tags: string[];
  }>;
  membersCount: number;
  nomineesCount: number;
  readinessScore: number;
  activityLogs: Array<{
    action: string;
    createdAt: string;
  }>;
  onCategoryClick: (categoryId: string) => void;
  onRotatePassword: () => void;
  onRotateKeys: () => void;
  onAddMember: () => void;
  onClose?: () => void;
};

export default function ReadinessImprovementWizard({
  items,
  membersCount,
  nomineesCount,
  readinessScore,
  activityLogs,
  onCategoryClick,
  onRotatePassword,
  onRotateKeys,
  onAddMember,
  onClose,
}: ReadinessImprovementWizardProps) {
  const [expanded, setExpanded] = useState(false);

  // Helper to check logs within days
  const withinDays = (days: number, actionPrefix?: string) => {
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;
    return activityLogs.some((log) => {
      if (actionPrefix && !log.action.startsWith(actionPrefix)) return false;
      const t = new Date(log.createdAt).getTime();
      return now - t <= windowMs;
    });
  };

  // Generate improvement actions based on current state
  const actions: ImprovementAction[] = useMemo(() => {
    const actionList: ImprovementAction[] = [];

    // Check good-to-have categories
    const hasLoansLiabilities = items.some(item => item.category === "loans-liabilities");
    const hasDigitalAssets = items.some(item => item.category === "digital-assets");
    
    if (!hasLoansLiabilities) {
      actionList.push({
        id: "add-loans-liabilities",
        title: "Add Loans & Liabilities",
        description: "Document outstanding loans and liabilities to help your family avoid surprises.",
        icon: <Scale className="w-5 h-5" />,
        categoryId: "loans-liabilities",
        actionType: "upload",
        points: 3,
        completed: false,
        priority: "medium",
      });
    }

    if (!hasDigitalAssets) {
      actionList.push({
        id: "add-digital-assets",
        title: "Add Digital Assets",
        description: "Document online accounts and digital footprint for easy access and recovery.",
        icon: <Globe className="w-5 h-5" />,
        categoryId: "digital-assets",
        actionType: "upload",
        points: 3,
        completed: false,
        priority: "medium",
      });
    }

    // Check password rotation
    const passwordRotated = withinDays(90, "password_reset");
    if (!passwordRotated) {
      actionList.push({
        id: "rotate-password",
        title: "Rotate Master Password",
        description: "It's been more than 90 days since your last password change. Rotate for better security.",
        icon: <Key className="w-5 h-5" />,
        actionType: "rotate_password",
        points: 4,
        completed: false,
        priority: "high",
      });
    }

    // Check recovery key rotation
    const keysRotated = withinDays(180, "myvault_recovery_key_reset");
    if (!keysRotated) {
      actionList.push({
        id: "rotate-recovery-keys",
        title: "Rotate Recovery Keys",
        description: "It's been more than 180 days since your last recovery key rotation. Update for better security.",
        icon: <RefreshCw className="w-5 h-5" />,
        actionType: "rotate_keys",
        points: 3,
        completed: false,
        priority: "high",
      });
    }

    // Check if more members could be added
    if (membersCount === 0) {
      actionList.push({
        id: "add-member",
        title: "Add Vault Members",
        description: "Invite family members to collaborate on your vault with appropriate permissions.",
        icon: <Building2 className="w-5 h-5" />,
        actionType: "add_member",
        points: 10,
        completed: false,
        priority: "medium",
      });
    }

    // Check optional categories
    const hasLegalProperty = items.some(item => item.category === "legal-property");
    if (!hasLegalProperty) {
      actionList.push({
        id: "add-legal-property",
        title: "Add Property & Legal Documents",
        description: "Optional: Document property and legal planning documents for comprehensive coverage.",
        icon: <FileText className="w-5 h-5" />,
        categoryId: "legal-property",
        actionType: "upload",
        points: 1,
        completed: false,
        priority: "low",
      });
    }

    // Sort by priority (high > medium > low) and then by points
    return actionList.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.points - a.points;
    });
  }, [items, membersCount, activityLogs]);

  const totalPotentialPoints = actions.reduce((sum, action) => sum + action.points, 0);
  const potentialScore = Math.min(100, readinessScore + totalPotentialPoints);

  const handleActionClick = (action: ImprovementAction) => {
    if (action.completed) return;

    switch (action.actionType) {
      case "upload":
        if (action.categoryId) {
          onCategoryClick(action.categoryId);
        }
        break;
      case "rotate_password":
        onRotatePassword();
        break;
      case "rotate_keys":
        onRotateKeys();
        break;
      case "add_member":
        onAddMember();
        break;
    }
  };

  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-brand-500/30 bg-brand-500/5 p-4">
        <div className="flex items-center gap-3">
          <Check className="w-5 h-5 text-brand-400" />
          <div>
            <p className="text-sm font-medium text-brand-300">
              Excellent! You're maximizing your readiness score.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Keep maintaining your vault with regular reviews.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">
              Improve Your Readiness Score
            </h3>
            <p className="text-xs text-slate-400">
              {actions.length} action{actions.length !== 1 ? 's' : ''} available to improve your score by up to {totalPotentialPoints} points
            </p>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="ml-4 rounded-md bg-brand-600 px-4 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors flex items-center gap-2"
          >
            View Actions
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-1">
            Improve Your Readiness Score
          </h2>
          <p className="text-sm text-slate-400">
            Complete these actions to increase your score from <span className="font-medium text-brand-400">{readinessScore}</span> to up to <span className="font-medium text-brand-400">{potentialScore}</span>
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Score Improvement Preview */}
      <div className="mb-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Current Score</span>
          <span className="text-xs text-slate-400">Potential Score</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
                style={{ width: `${readinessScore}%` }}
              />
            </div>
          </div>
          <div className="text-xs font-medium text-slate-300 min-w-[3rem] text-center">
            {readinessScore} → {potentialScore}
          </div>
          <div className="flex-1">
            <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
                style={{ width: `${potentialScore}%` }}
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2 text-center">
          +{totalPotentialPoints} points available
        </p>
      </div>

      {/* Actions List */}
      <div className="space-y-3">
        {actions.map((action, index) => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action)}
            disabled={action.completed}
            className={`w-full text-left rounded-lg border p-4 transition-all ${
              action.completed
                ? "border-brand-500/50 bg-brand-500/10 cursor-default opacity-60"
                : action.priority === "high"
                ? "border-amber-500/50 bg-amber-500/5 hover:border-amber-500/70 hover:bg-amber-500/10 cursor-pointer"
                : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900 cursor-pointer"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 mt-0.5 ${
                action.completed ? "text-brand-400" : 
                action.priority === "high" ? "text-amber-400" : "text-slate-400"
              }`}>
                {action.completed ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500/20">
                    <Check className="h-4 w-4" />
                  </div>
                ) : (
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    action.priority === "high" ? "bg-amber-500/20" : "bg-slate-800"
                  } text-xs font-medium`}>
                    {index + 1}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`${action.completed ? "text-brand-400" : 
                    action.priority === "high" ? "text-amber-400" : "text-slate-300"
                  }`}>
                    {action.icon}
                  </div>
                  <h3 className={`text-sm font-semibold ${
                    action.completed ? "text-brand-300" : "text-white"
                  }`}>
                    {action.title}
                  </h3>
                  {action.priority === "high" && !action.completed && (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400 font-medium">
                      High Priority
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  {action.description}
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <span className={`font-medium ${
                    action.completed ? "text-brand-400" : "text-slate-500"
                  }`}>
                    +{action.points} points
                  </span>
                  {action.completed && (
                    <span className="text-brand-400">✓ Completed</span>
                  )}
                </div>
              </div>
              {!action.completed && (
                <ChevronRight className="h-5 w-5 text-slate-500 flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>

      {actions.length > 0 && (
        <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            💡 Tip: Focus on high-priority actions first for maximum impact on your readiness score.
          </p>
        </div>
      )}
    </div>
  );
}

