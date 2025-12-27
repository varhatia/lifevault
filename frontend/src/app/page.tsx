"use client";

import { useAuth } from "@/lib/hooks/useAuth";
import LandingPage from "./components/LandingPage";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type MyVaultSummary = {
  id: string;
  name: string;
  _count?: {
    items: number;
    nominees: number;
  };
};

type FamilyVaultSummary = {
  id: string;
  name: string;
  members: { id: string; acceptedAt: string | null }[];
  _count?: {
    items: number;
    members?: number;
  };
};

type NomineeSummary = {
  id: string;
  vaultType: string;
  vaultId: string;
  isActive: boolean;
};

type ActivityLog = {
  id: string;
  vaultType: string;
  action: string;
  createdAt: string;
};

type ReadinessInputs = {
  myVaults: MyVaultSummary[];
  familyVaults: FamilyVaultSummary[];
  nomineesCount: number;
  logs: ActivityLog[];
};

type LifeSetupAction = {
  id: string;
  title: string;
  explanation: string;
  href: string;
  icon: string;
};

type ReadinessScore = {
  score: number;
  bucketLabel: string;
  bucketSubtitle: string;
  details: {
    vaultCompletion: number;
    familyAndNominee: number;
    freshness: number;
    engagement: number;
  };
};

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const [myVaults, setMyVaults] = useState<MyVaultSummary[] | null>(null);
  const [familyVaults, setFamilyVaults] = useState<FamilyVaultSummary[] | null>(
    null
  );
  const [nominees, setNominees] = useState<NomineeSummary[] | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[] | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      void loadDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      setDashboardLoading(true);
      setDashboardError(null);

      const [myVaultRes, familyVaultRes, nomineesRes, activityRes] =
        await Promise.all([
          fetch("/api/vaults/my"),
          fetch("/api/family/vaults"),
          fetch("/api/nominee"),
          fetch("/api/activity/logs?limit=100"),
        ]);

      if (myVaultRes.ok) {
        const data = await myVaultRes.json();
        setMyVaults(data.vaults || []);
      }
      if (familyVaultRes.ok) {
        const data = await familyVaultRes.json();
        setFamilyVaults(data.vaults || []);
      }
      if (nomineesRes.ok) {
        const data = await nomineesRes.json();
        setNominees(data.nominees || []);
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivityLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
      setDashboardError("We could not load your readiness data. Core vaults still work as usual.");
    } finally {
      setDashboardLoading(false);
    }
  };

  const readiness: ReadinessScore | null = useMemo(() => {
    if (!myVaults || !familyVaults || !nominees || !activityLogs) {
      return null;
    }

    const inputs: ReadinessInputs = {
      myVaults,
      familyVaults,
      nomineesCount: nominees.filter((n) => n.isActive).length,
      logs: activityLogs,
    };

    return computeReadinessScore(inputs);
  }, [myVaults, familyVaults, nominees, activityLogs]);

  // Show landing page for unauthenticated users
  if (!loading && !isAuthenticated) {
    return <LandingPage />;
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    );
  }

  // Show dashboard for authenticated users
  return (
    <div className="space-y-6">
      {/* Section 1: Readiness Hero */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-xl">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Your Life Readiness
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {readiness && readiness.score >= 80
              ? "You're well prepared. Keep things up to date."
              : readiness && readiness.score < 80
              ? "A few steps can significantly improve your preparedness."
              : "The goal is not completion. The goal is confidence."}
          </p>
          {dashboardError && (
            <p className="mt-2 text-xs text-amber-400">
              {dashboardError}
            </p>
          )}
        </div>
        <div className="flex flex-col items-center justify-center">
          <ReadinessRing
            percentage={readiness?.score ?? 0}
            loading={dashboardLoading || !readiness}
          />
          <div className="mt-2 text-center">
            <p className="text-xs font-medium text-slate-200">
              {readiness ? readiness.bucketLabel : "Calculating..."}
            </p>
          </div>
        </div>
      </section>

      {/* Section 2: Life Setup (Foundational Nudges) */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-100">
            Complete Your Life Setup
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            These one-time steps help ensure your information is available to the people you trust.
          </p>
        </div>
        <LifeSetupSection
          myVaults={myVaults}
          familyVaults={familyVaults}
          nominees={nominees}
          loading={dashboardLoading}
        />
      </section>

      {/* Section 3: Vault Overview */}
      <section className="grid gap-4 md:grid-cols-2">
        <VaultSummaryCard
          title="My Vault"
          href="/my-vault"
          completionPercent={estimateMyVaultCompletion(myVaults)}
          description="Your personal, private vault. Start with bank accounts, IDs and insurance."
          cta="Review Vault"
        />
        <VaultSummaryCard
          title="Family Vault"
          href="/family-vault"
          completionPercent={estimateFamilyVaultCompletion(familyVaults)}
          description="A shared space for joint accounts, family policies and important records."
          cta="Review Vault"
        />
      </section>

      {/* Section 4: Activity & Reminders */}
      <section className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ActivitySummaryCard logs={activityLogs} loading={dashboardLoading} />
        <InfoBlob
          title="Why this matters"
          body="When documents and simple summaries are organised, families avoid frantic searches, missed claims and hard conversations during stressful moments."
        />
      </section>
    </div>
  );
}

function ReadinessRing({
  percentage,
  loading,
}: {
  percentage: number;
  loading: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage || 0)));
  const display = loading ? 0 : clamped;
  const gradient = `conic-gradient(var(--brand-500) ${display * 3.6}deg, rgba(148, 163, 184, 0.3) 0deg)`;

  return (
    <div
      className="relative flex h-28 w-28 items-center justify-center rounded-full bg-slate-900"
      style={{
        backgroundImage: gradient,
      }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-slate-950 border border-slate-800">
        <span className="text-xl font-semibold text-slate-50">
          {display}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          Ready
        </span>
      </div>
    </div>
  );
}

function VaultSummaryCard(props: {
  title: string;
  href: string;
  completionPercent: number | null;
  description: string;
  cta: string;
}) {
  const completion = props.completionPercent ?? 0;
  return (
    <Link
      href={props.href}
      className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-6 hover:border-brand-500 hover:bg-slate-900 transition-colors"
    >
      <h2 className="text-xl font-semibold text-white">{props.title}</h2>
      <p className="mt-2 text-sm text-slate-300">{props.description}</p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Vault completeness</span>
          <span>{completion}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all"
            style={{ width: `${Math.max(4, Math.min(100, completion))}%` }}
          />
        </div>
      </div>
      <span className="mt-4 text-xs font-medium text-brand-400 group-hover:text-brand-300">
        {props.cta} →
      </span>
    </Link>
  );
}

function InfoBlob(props: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-400">
        {props.title}
      </div>
      <p className="mt-2 text-xs text-slate-300">{props.body}</p>
    </div>
  );
}

function computeReadinessScore(inputs: ReadinessInputs): ReadinessScore {
  const { myVaults, familyVaults, nomineesCount, logs } = inputs;

  // 1. Vault completion (40 pts)
  const totalItems =
    (myVaults[0]?._count?.items || 0) +
    familyVaults.reduce((acc, v) => acc + (v._count?.items || 0), 0);

  const hasBankAccounts = totalItems > 0; // proxy: at least one item in any vault
  const hasInsurance = totalItems > 1; // proxy: more than one document suggests coverage
  const hasPropertyOrLegal = totalItems > 3; // proxy: a few documents
  const hasIds = totalItems > 5; // proxy: several documents across folders

  const vaultCompletionPoints =
    (hasBankAccounts ? 10 : 0) +
    (hasInsurance ? 10 : 0) +
    (hasPropertyOrLegal ? 10 : 0) +
    (hasIds ? 10 : 0);

  // 2. Family & nominee setup (25 pts)
  const hasFamilyVault = familyVaults.length > 0;
  const hasTrustedMember =
    familyVaults.some((v) =>
      v.members.some((m) => m.acceptedAt !== null)
    ) || false;
  const hasNominee = (nomineesCount || 0) > 0;

  const familyAndNomineePoints =
    (hasFamilyVault ? 10 : 0) +
    (hasTrustedMember ? 5 : 0) +
    (hasNominee ? 10 : 0);

  // Helper to check logs within days
  const withinDays = (days: number, actionPrefix?: string) => {
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;
    return logs.some((log) => {
      if (actionPrefix && !log.action.startsWith(actionPrefix)) return false;
      const t = new Date(log.createdAt).getTime();
      return now - t <= windowMs;
    });
  };

  // 3. Freshness & maintenance (20 pts)
  const reviewedRecently = withinDays(30, "myvault_") || withinDays(30, "familyvault_");
  const passwordRotated = withinDays(90, "password_reset");
  const keysRotated =
    withinDays(180, "myvault_recovery_key_reset") ||
    withinDays(180, "familyvault_recovery_key_set");

  const freshnessPoints =
    (reviewedRecently ? 10 : 0) +
    (passwordRotated ? 5 : 0) +
    (keysRotated ? 5 : 0);

  // 4. Engagement (15 pts)
  const appOpenedRecently =
    withinDays(30, "login_success") || withinDays(30); // any activity
  const noCriticalAlerts = totalItems > 0; // proxy: they have at least started
  const nextBestActionCompleted = hasBankAccounts || hasInsurance;

  const engagementPoints =
    (appOpenedRecently ? 5 : 0) +
    (nextBestActionCompleted ? 5 : 0) +
    (noCriticalAlerts ? 5 : 0);

  const rawScore =
    vaultCompletionPoints +
    familyAndNomineePoints +
    freshnessPoints +
    engagementPoints;

  const score = Math.max(0, Math.min(100, rawScore));
  let bucketLabel = "Getting Started";
  let bucketSubtitle =
    "You’ve taken the first step. We’ll help you prioritise what to add next.";

  if (score >= 81) {
    bucketLabel = "Strongly Prepared";
    bucketSubtitle =
      "You’ve covered the big rocks. A quick seasonal review keeps everything sharp.";
  } else if (score >= 61) {
    bucketLabel = "Well Prepared";
    bucketSubtitle =
      "You’re doing well. A few small updates can strengthen this further.";
  } else if (score >= 31) {
    bucketLabel = "Partially Prepared";
    bucketSubtitle =
      "Key pieces are in place. Let’s close a few important gaps together.";
  }

  return {
    score,
    bucketLabel,
    bucketSubtitle,
    details: {
      vaultCompletion: vaultCompletionPoints,
      familyAndNominee: familyAndNomineePoints,
      freshness: freshnessPoints,
      engagement: engagementPoints,
    },
  };
}

function LifeSetupSection({
  myVaults,
  familyVaults,
  nominees,
  loading,
}: {
  myVaults: MyVaultSummary[] | null;
  familyVaults: FamilyVaultSummary[] | null;
  nominees: NomineeSummary[] | null;
  loading: boolean;
}) {
  if (loading || !myVaults || !familyVaults || !nominees) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        Loading your setup status…
      </div>
    );
  }

  const hasPersonalVault = myVaults.length > 0;
  const hasFamilyVault = familyVaults.length > 0;
  const hasPersonalNominee = nominees.some(
    (n) => n.vaultType === "my_vault" && n.isActive
  );
  // Check if there are members beyond the owner (owner is always a member, so check for > 1)
  const hasFamilyMember = familyVaults.some(
    (v) => v.members.filter((m) => m.acceptedAt !== null).length > 1
  );
  const hasFamilyNominee = nominees.some(
    (n) => n.vaultType === "family_vault" && n.isActive
  );

  const actions: LifeSetupAction[] = [];

  if (!hasPersonalVault) {
    actions.push({
      id: "create-personal-vault",
      title: "Create Personal Vault",
      explanation: "Your private space for sensitive information.",
      href: "/my-vault",
      icon: "🔒",
    });
  }

  if (!hasFamilyVault) {
    actions.push({
      id: "create-family-vault",
      title: "Create Family Vault",
      explanation: "A shared space for important family records.",
      href: "/family-vault",
      icon: "👨‍👩‍👧‍👦",
    });
  }

  if (hasPersonalVault && !hasPersonalNominee) {
    actions.push({
      id: "assign-personal-nominee",
      title: "Assign Nominee to Personal Vault",
      explanation: "Choose someone you trust to access it if needed.",
      href: "/my-vault",
      icon: "👤",
    });
  }

  if (hasFamilyVault && !hasFamilyMember) {
    actions.push({
      id: "add-family-member",
      title: "Add Member to Family Vault",
      explanation: "Invite a family member to collaborate.",
      href: "/family-vault",
      icon: "➕",
    });
  }

  if (hasFamilyVault && !hasFamilyNominee) {
    actions.push({
      id: "assign-family-nominee",
      title: "Add Nominee to Family Vault",
      explanation: "Designate emergency access for shared records.",
      href: "/family-vault",
      icon: "🔐",
    });
  }

  const allComplete = actions.length === 0;

  if (allComplete) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">✅</span>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-100">
              Your Life Setup is complete
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Completed. You can review or update anytime.
            </p>
            <Link
              href="/actions"
              className="mt-3 inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:border-brand-500 hover:text-brand-100"
            >
              Review setup
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <LifeSetupProgressiveWidget actions={actions} />;
}

function LifeSetupProgressiveWidget({
  actions,
}: {
  actions: LifeSetupAction[];
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [skippedActions, setSkippedActions] = useState<Set<string>>(new Set());
  const [allViewed, setAllViewed] = useState(false);

  // Reset step if actions array changes (e.g., user completed an action)
  useEffect(() => {
    if (currentStep >= actions.length) {
      setCurrentStep(Math.max(0, actions.length - 1));
    }
  }, [actions.length, currentStep]);

  // Check if all steps have been viewed
  useEffect(() => {
    if (currentStep === actions.length - 1 && actions.length > 0) {
      setAllViewed(true);
    }
  }, [currentStep, actions.length]);

  if (actions.length === 0) {
    return null;
  }

  const currentAction = actions[currentStep];
  const progress = ((currentStep + 1) / actions.length) * 100;
  const isLastStep = currentStep === actions.length - 1;
  const isFirstStep = currentStep === 0;

  const handleSkip = () => {
    setSkippedActions((prev) => new Set(prev).add(currentAction.id));
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setAllViewed(true);
    }
  };

  const handleDoLater = () => {
    setSkippedActions((prev) => new Set(prev).add(currentAction.id));
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setAllViewed(true);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
      setAllViewed(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      {/* Progress indicator */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
          <span>Step {currentStep + 1} of {actions.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current action card */}
      <div className="mb-4">
        <div className="flex items-start gap-4">
          <span className="text-3xl">{currentAction.icon}</span>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-100 mb-2">
              {currentAction.title}
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              {currentAction.explanation}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={currentAction.href}
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Do this now
              </Link>
              <button
                onClick={handleDoLater}
                className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-600 hover:bg-slate-700 transition-colors"
              >
                Do later
              </button>
              <button
                onClick={handleSkip}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip
              </button>
            </div>
            {skippedActions.has(currentAction.id) && (
              <p className="mt-2 text-xs text-slate-500 italic">
                You marked this to do later
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Completion message when all viewed */}
      {allViewed && isLastStep && (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-300">
            You've reviewed all setup steps. Complete them anytime from your vaults.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={handlePrevious}
          disabled={isFirstStep}
          className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <div className="flex items-center gap-1">
          {actions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStep
                  ? "bg-brand-500"
                  : index < currentStep
                  ? "bg-brand-500/50"
                  : "bg-slate-700"
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
        <button
          onClick={handleNext}
          disabled={isLastStep}
          className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function estimateMyVaultCompletion(
  myVaults: MyVaultSummary[] | null
): number | null {
  if (!myVaults || myVaults.length === 0) return null;
  const items = myVaults[0]?._count?.items || 0;
  if (items === 0) return 10;
  if (items < 3) return 35;
  if (items < 6) return 60;
  if (items < 12) return 80;
  return 90;
}

function estimateFamilyVaultCompletion(
  familyVaults: FamilyVaultSummary[] | null
): number | null {
  if (!familyVaults || familyVaults.length === 0) return null;
  const totalItems = familyVaults.reduce(
    (acc, v) => acc + (v._count?.items || 0),
    0
  );
  if (totalItems === 0) return 20;
  if (totalItems < 3) return 40;
  if (totalItems < 6) return 60;
  if (totalItems < 12) return 75;
  return 85;
}

function ActivitySummaryCard({
  logs,
  loading,
}: {
  logs: ActivityLog[] | null;
  loading: boolean;
}) {
  if (loading && !logs) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
        Fetching your recent reviews and reminders…
      </div>
    );
  }

  const sorted = (logs || []).slice().sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const lastReview =
    sorted.find((log) =>
      ["myvault_unlocked", "familyvault_unlocked"].includes(log.action)
    ) || null;

  const lastReviewDate = lastReview ? new Date(lastReview.createdAt) : null;
  let lastReviewedText = "Not reviewed yet";
  let nextReminderText = "We recommend a review every 3–6 months.";

  if (lastReviewDate) {
    const diffDays = Math.floor(
      (Date.now() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    lastReviewedText =
      diffDays === 0
        ? "Reviewed today"
        : `Last reviewed ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

    const nextInDays = Math.max(15, 90 - diffDays);
    nextReminderText = `Next suggested check‑in in ${nextInDays} day${
      nextInDays === 1 ? "" : "s"
    }.`;
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">
          Activity & Reminders
        </h2>
        <p className="mt-1 text-[11px] text-slate-400">
          A gentle cadence keeps things current without becoming a chore.
        </p>
      </div>
      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
          <span className="text-slate-300">Last reviewed</span>
          <span className="text-slate-100">{lastReviewedText}</span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
          <span className="text-slate-300">Next reminder</span>
          <span className="text-slate-100">{nextReminderText}</span>
        </div>
      </div>
      <Link
        href="/actions"
        className="mt-4 inline-flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-[11px] font-medium text-slate-100 hover:border-brand-500 hover:text-brand-100"
      >
        Enter Review Mode
      </Link>
    </div>
  );
}


