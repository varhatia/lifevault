"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";

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

type ActivityLog = {
  id: string;
  vaultType: string;
  action: string;
  createdAt: string;
};

type ReviewSectionId =
  | "ids_personal"
  | "bank_accounts"
  | "insurance"
  | "property"
  | "legal_estate"
  | "digital_access";

type ReviewSection = {
  id: ReviewSectionId;
  title: string;
  description: string;
};

type SectionStatus = "complete" | "partial" | "missing";

const REVIEW_SECTIONS: ReviewSection[] = [
  {
    id: "ids_personal",
    title: "IDs & Personal Records",
    description:
      "PAN, Aadhaar, passport and basic identity documents often needed for verification and claims.",
  },
  {
    id: "bank_accounts",
    title: "Bank Accounts",
    description:
      "Main savings, salary or joint accounts so your family knows where funds are held.",
  },
  {
    id: "insurance",
    title: "Insurance",
    description:
      "Health and term life policies that protect your family. Helpful to keep policy numbers and a simple summary.",
  },
  {
    id: "property",
    title: "Property",
    description:
      "Homes, plots or other property. Sale deeds, allotment letters and basic loan details are enough.",
  },
  {
    id: "legal_estate",
    title: "Legal & Estate",
    description:
      "Wills, nominations and power of attorney documents that clarify your wishes and reduce uncertainty.",
  },
  {
    id: "digital_access",
    title: "Digital Access",
    description:
      "Simple hints or instructions for important apps, email and services your family may need to access.",
  },
];

export default function ActionsReviewPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [myVaults, setMyVaults] = useState<MyVaultSummary[] | null>(null);
  const [familyVaults, setFamilyVaults] = useState<FamilyVaultSummary[] | null>(
    null
  );
  const [activityLogs, setActivityLogs] = useState<ActivityLog[] | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewModeOn, setReviewModeOn] = useState(true);
  const [selectedSectionId, setSelectedSectionId] =
    useState<ReviewSectionId>("bank_accounts");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      void loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const loadData = async () => {
    try {
      setDashboardLoading(true);
      setError(null);

      const [myVaultRes, familyVaultRes, activityRes] = await Promise.all([
        fetch("/api/vaults/my"),
        fetch("/api/family/vaults"),
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
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivityLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load review data:", err);
      setError("We could not load review data. You can still open vaults normally.");
    } finally {
      setDashboardLoading(false);
    }
  };

  const sectionStatuses = useMemo(() => {
    return computeSectionStatuses(myVaults, familyVaults, activityLogs);
  }, [myVaults, familyVaults, activityLogs]);

  const selectedSection = REVIEW_SECTIONS.find(
    (s) => s.id === selectedSectionId
  )!;

  if (!authLoading && !isAuthenticated) {
    // Let /auth/login guard access; this route is for logged-in review only.
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-300">
          Please sign in to review and organise your vault.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header: Review Mode toggle */}
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Review Mode
          </h1>
          <p className="mt-1 max-w-xl text-xs text-slate-300">
            A guided checklist to keep your LifeVault current. The goal is not
            completion. The goal is confidence that your family can find what
            they need.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReviewModeOn((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            reviewModeOn
              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
              : "border-slate-700 bg-slate-900 text-slate-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              reviewModeOn ? "bg-emerald-400" : "bg-slate-500"
            }`}
          />
          Review Mode {reviewModeOn ? "ON" : "OFF"}
        </button>
      </header>

      {error && (
        <p className="text-xs text-amber-400">
          {error}
        </p>
      )}

      {/* Main layout: left checklist, right detail */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,4fr)]">
        {/* Left: checklist list (Frame 2) */}
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          {REVIEW_SECTIONS.map((section) => {
            const status = sectionStatuses[section.id];
            const lastUpdated = getSectionLastUpdated(
              section.id,
              activityLogs || []
            );
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedSectionId(section.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                  selectedSectionId === section.id
                    ? "border-brand-500 bg-slate-900"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start gap-2">
                  <StatusPill status={status} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-100">
                        {section.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {lastUpdated
                        ? `Last updated ${lastUpdated}`
                        : "Not added yet"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between gap-1">
                  <span className="text-[10px] text-slate-400">
                    {statusLabel(status)}
                  </span>
                  <div className="flex gap-1">
                    <Link
                      href="/my-vault"
                      className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-700"
                    >
                      Review
                    </Link>
                    <Link
                      href="/family-vault"
                      className="rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-800"
                    >
                      Update
                    </Link>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: vault / folder detail (Frames 3–5) */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              {selectedSection.title}
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              {selectedSection.description}
            </p>
          </div>

          {/* Vault detail grid (Frame 3) */}
          <div className="grid gap-3 md:grid-cols-2">
            <VaultDetailCard
              vaultType="my"
              myVaults={myVaults}
              sectionId={selectedSectionId}
            />
            <VaultDetailCard
              vaultType="family"
              familyVaults={familyVaults}
              sectionId={selectedSectionId}
            />
          </div>

          {/* Folder empty / checklist states (Frames 4 & 5) */}
          <FolderGuidance sectionId={selectedSectionId} />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: SectionStatus }) {
  const color =
    status === "complete"
      ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60"
      : status === "partial"
      ? "bg-amber-500/15 text-amber-200 border-amber-500/60"
      : "bg-slate-800 text-slate-200 border-slate-600";
  const dot =
    status === "complete"
      ? "bg-emerald-400"
      : status === "partial"
      ? "bg-amber-400"
      : "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {statusLabel(status)}
    </span>
  );
}

function statusLabel(status: SectionStatus): string {
  if (status === "complete") return "Complete";
  if (status === "partial") return "Needs update";
  return "Missing";
}

function computeSectionStatuses(
  myVaults: MyVaultSummary[] | null,
  familyVaults: FamilyVaultSummary[] | null,
  _logs: ActivityLog[] | null
): Record<ReviewSectionId, SectionStatus> {
  const totalMyItems = myVaults?.[0]?._count?.items || 0;
  const totalFamilyItems =
    familyVaults?.reduce((acc, v) => acc + (v._count?.items || 0), 0) || 0;
  const anyFamilyVault = (familyVaults?.length || 0) > 0;

  const statuses: Record<ReviewSectionId, SectionStatus> = {
    ids_personal: "missing",
    bank_accounts: "missing",
    insurance: "missing",
    property: "missing",
    legal_estate: "missing",
    digital_access: "missing",
  };

  const totalItems = totalMyItems + totalFamilyItems;

  if (totalItems === 0) {
    return statuses;
  }

  // Heuristics: the more documents overall, the more sections are likely covered.
  statuses.bank_accounts = totalItems >= 1 ? "partial" : "missing";
  statuses.insurance = totalItems >= 2 ? "partial" : "missing";
  statuses.ids_personal = totalItems >= 3 ? "partial" : "missing";
  statuses.property = totalItems >= 4 ? "partial" : "missing";
  statuses.legal_estate = totalItems >= 5 ? "partial" : "missing";
  statuses.digital_access = totalItems >= 6 ? "partial" : "missing";

  if (totalItems >= 8) {
    statuses.bank_accounts = "complete";
    statuses.insurance = "complete";
  }
  if (totalItems >= 12) {
    statuses.ids_personal = "complete";
    statuses.property = "complete";
  }
  if (totalItems >= 15) {
    statuses.legal_estate = "complete";
    statuses.digital_access = "complete";
  }

  // If a family vault exists, assume some shared sections are at least partial.
  if (anyFamilyVault) {
    if (statuses.property === "missing") statuses.property = "partial";
    if (statuses.legal_estate === "missing") statuses.legal_estate = "partial";
  }

  return statuses;
}

function getSectionLastUpdated(
  _sectionId: ReviewSectionId,
  logs: ActivityLog[]
): string | null {
  if (!logs.length) return null;
  const latest = logs[0];
  const date = new Date(latest.createdAt);
  const diffDays = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function VaultDetailCard({
  vaultType,
  myVaults,
  familyVaults,
  sectionId,
}: {
  vaultType: "my" | "family";
  myVaults?: MyVaultSummary[] | null;
  familyVaults?: FamilyVaultSummary[] | null;
  sectionId: ReviewSectionId;
}) {
  if (vaultType === "my") {
    const primary = myVaults?.[0];
    const items = primary?._count?.items || 0;
    const completion =
      items === 0 ? 0 : items < 3 ? 40 : items < 8 ? 70 : 90;
    return (
      <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
        <div>
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-100">My Vault</span>
            <span className="text-[10px] text-slate-400">
              {completion}% complete
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {items === 0
              ? "No items added yet."
              : `${items} item${items === 1 ? "" : "s"} organised.`}
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
              style={{ width: `${Math.max(4, Math.min(100, completion))}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/my-vault"
            className="flex-1 rounded-md bg-brand-600 px-2 py-1.5 text-center text-[11px] font-medium text-white hover:bg-brand-700"
          >
            View section
          </Link>
          <Link
            href="/my-vault"
            className="flex-1 rounded-md bg-slate-900 px-2 py-1.5 text-center text-[11px] font-medium text-slate-100 hover:bg-slate-800"
          >
            Add item
          </Link>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Focus area: {sectionLabel(sectionId)} in your personal vault.
        </p>
      </div>
    );
  }

  const vaults = familyVaults || [];
  const totalItems =
    vaults.reduce((acc, v) => acc + (v._count?.items || 0), 0) || 0;
  const completion =
    totalItems === 0 ? 0 : totalItems < 3 ? 40 : totalItems < 8 ? 70 : 90;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
      <div>
        <div className="flex items-center justify-between">
          <span className="font-medium text-slate-100">Family Vault</span>
          <span className="text-[10px] text-slate-400">
            {completion}% complete
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          {vaults.length === 0
            ? "No family vault created yet."
            : `${vaults.length} family vault${
                vaults.length === 1 ? "" : "s"
              } with ${totalItems} shared item${
                totalItems === 1 ? "" : "s"
              }.`}
        </p>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
            style={{ width: `${Math.max(4, Math.min(100, completion))}%` }}
          />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Link
          href="/family-vault"
          className="flex-1 rounded-md bg-slate-800 px-2 py-1.5 text-center text-[11px] font-medium text-slate-100 hover:bg-slate-700"
        >
          View section
        </Link>
        <Link
          href="/family-vault"
          className="flex-1 rounded-md bg-slate-900 px-2 py-1.5 text-center text-[11px] font-medium text-slate-100 hover:bg-slate-800"
        >
          Add item
        </Link>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Focus area: {sectionLabel(sectionId)} in shared vaults.
      </p>
    </div>
  );
}

function sectionLabel(sectionId: ReviewSectionId): string {
  const match = REVIEW_SECTIONS.find((s) => s.id === sectionId);
  return match ? match.title : "This section";
}

function FolderGuidance({ sectionId }: { sectionId: ReviewSectionId }) {
  // Simple mapping of microcopy & checklist items (Frames 4 & 5)
  if (sectionId === "bank_accounts") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            Bank Accounts – where most people start
          </h3>
          <p className="mt-1 text-[11px] text-slate-300">
            Most people start with their primary savings account. A simple
            summary is enough.
          </p>
        </div>
        <Checklist
          items={[
            "Add your main savings or salary account",
            "Add any important joint accounts",
            "Note down branch / relationship manager if relevant",
          ]}
        />
        <Link
          href="/my-vault"
          className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-brand-700"
        >
          Upload document or add summary
        </Link>
      </div>
    );
  }

  if (sectionId === "insurance") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            Insurance – quick checklist
          </h3>
          <p className="mt-1 text-[11px] text-slate-300">
            Insurance documents help your family make timely claims without
            confusion.
          </p>
        </div>
        <Checklist
          items={[
            "Upload latest health insurance policy document",
            "Add your term life policy – this is critical for family security",
            "Optionally add vehicle insurance and other smaller covers",
          ]}
        />
        <p className="text-[11px] text-slate-400">
          Each policy can be a simple PDF or a one‑page summary with policy
          number and claim contact details.
        </p>
      </div>
    );
  }

  if (sectionId === "property") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            Property – documents that matter most
          </h3>
          <p className="mt-1 text-[11px] text-slate-300">
            Property records help loved ones understand ownership, loans and
            legal status.
          </p>
        </div>
        <Checklist
          items={[
            "Upload sale deed or allotment letter for each major property",
            "Add a short note on any outstanding loans (bank, EMI, tenure)",
            "Capture co‑owners and nomination status if known",
          ]}
        />
        <p className="text-[11px] text-slate-400">
          Loan details can be added later – start with the core ownership
          document.
        </p>
      </div>
    );
  }

  if (sectionId === "legal_estate") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            Legal & Estate – clarity for tough moments
          </h3>
          <p className="mt-1 text-[11px] text-slate-300">
            Legal documents clarify your wishes and reduce uncertainty.
          </p>
        </div>
        <Checklist
          items={[
            "Upload a copy of your will, if you have one",
            "Add power of attorney documents, if any",
            "Add nomination letters or simple notes on nominations in key accounts",
          ]}
        />
        <p className="text-[11px] text-slate-400">
          Even if you do not have formal documents, a clear written note about
          your intent is better than silence.
        </p>
      </div>
    );
  }

  if (sectionId === "ids_personal") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            IDs & Personal Records – quick wins
          </h3>
          <p className="mt-1 text-[11px] text-slate-300">
            Basic identity documents are often needed for verification and
            claims.
          </p>
        </div>
        <Checklist
          items={[
            "Upload PAN card and Aadhaar card",
            "Add passport and any OCI / visa details, if relevant",
            "Optional: driving licence and voter ID",
          ]}
        />
      </div>
    );
  }

  if (sectionId === "digital_access") {
    return (
      <div className="space-y-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-xs">
        <div>
          <h3 className="text-sm font-medium text-slate-100">
            Digital Access – helpful hints
          </h3>
          <p className="mt-1 text-[11px] text-slate-300">
            Helpful notes about important apps or services your family may need
            to access.
          </p>
        </div>
        <Checklist
          items={[
            "Add hints for unlocking your phone and primary email (without sharing raw passwords)",
            "List key financial apps and how to find them",
            "Note down where you store master passwords or password managers",
          ]}
        />
        <p className="text-[11px] text-slate-400">
          Avoid writing exact passwords. Focus on where things are and how to
          start.
        </p>
      </div>
    );
  }

  return null;
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2 text-[11px] text-slate-200">
          <span className="mt-[3px] h-3 w-3 rounded border border-slate-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}


