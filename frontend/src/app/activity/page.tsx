"use client";

import { useEffect, useState } from "react";

type ActivityLog = {
  id: string;
  vaultType: string;
  action: string;
  description: string | null;
  createdAt: string;
  metadata?: Record<string, any> | null;
};

type LogsResponse = {
  logs: ActivityLog[];
  nextCursor: string | null;
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const [vaultTypeFilter, setVaultTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const loadLogs = async (cursor?: string | null) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", "20");
      if (cursor) params.set("cursor", cursor);
      if (!cursor) {
        if (vaultTypeFilter !== "all") {
          params.set("vaultType", vaultTypeFilter);
        }
        if (actionFilter !== "all") {
          params.set("action", actionFilter);
        }
        if (fromDate) {
          params.set("from", new Date(fromDate).toISOString());
        }
        if (toDate) {
          // Include entire day by setting end of day
          const end = new Date(toDate);
          end.setHours(23, 59, 59, 999);
          params.set("to", end.toISOString());
        }
      }

      const res = await fetch(`/api/activity/logs?${params.toString()}`);
      const data: LogsResponse = await res.json();

      if (!res.ok) {
        setError((data as any).error || "Failed to load activity logs");
        return;
      }

      if (cursor) {
        setLogs((prev) => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }

      setNextCursor(data.nextCursor);
      setInitialLoaded(true);
    } catch (err) {
      console.error("Error loading activity logs:", err);
      setError("Unexpected error while loading activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultTypeFilter, actionFilter]);

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const formatAction = (action: string) => {
    switch (action) {
      case "login_success":
        return "Logged in";
      case "password_reset":
        return "Password reset";
      case "item_uploaded":
        return "Item uploaded";
      case "item_downloaded":
        return "Item downloaded";
      case "item_deleted":
        return "Item deleted";
      case "myvault_created":
        return "My Vault created";
      case "familyvault_created":
        return "Family Vault created";
      case "myvault_unlocked":
        return "My Vault unlocked";
      case "familyvault_unlocked":
        return "Family Vault unlocked";
      case "family_member_added":
        return "Member added";
      case "family_member_role_updated":
        return "Member role updated";
      case "family_member_removed":
        return "Member removed";
      case "myvault_recovery_key_reset":
        return "My Vault recovery key reset";
      case "familyvault_recovery_key_set":
        return "Family Vault recovery key set";
      case "nominee_access_requested":
        return "Nominee access requested";
      case "nominee_access_approved":
        return "Nominee access approved";
      case "nominee_vault_viewed":
        return "Nominee viewed vault";
      case "nominee_item_downloaded":
        return "Nominee downloaded item";
      case "nominee_added":
        return "Nominee added";
      case "nominee_deleted":
        return "Nominee removed";
      case "nominee_regenerated":
        return "Nominee keys regenerated";
      default:
        return action.replace(/_/g, " ");
    }
  };

  const formatVaultType = (vaultType: string) => {
    if (vaultType === "account") return "Account";
    if (vaultType === "my_vault") return "My Vault";
    if (vaultType === "family_vault") return "Family Vault";
    return vaultType;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
        <p className="mt-2 text-xs text-slate-300">
          View recent security and vault activities for your account. Vault contents
          remain end-to-end encrypted; only high-level metadata is shown here.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        {/* Filters */}
        <div className="grid gap-3 sm:grid-cols-4 text-[11px]">
          <div className="flex flex-col gap-1">
            <label className="text-slate-400" htmlFor="vaultTypeFilter">Vault type</label>
            <select
              id="vaultTypeFilter"
              value={vaultTypeFilter}
              onChange={(e) => {
                setNextCursor(null);
                setVaultTypeFilter(e.target.value);
              }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="account">Account</option>
              <option value="my_vault">My Vault</option>
              <option value="family_vault">Family Vault</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400" htmlFor="actionFilter">Action</label>
            <select
              id="actionFilter"
              value={actionFilter}
              onChange={(e) => {
                setNextCursor(null);
                setActionFilter(e.target.value);
              }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:border-brand-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value="login_success">Logged in</option>
              <option value="password_reset">Password reset</option>
              <option value="item_uploaded">Item uploaded</option>
              <option value="item_downloaded">Item downloaded</option>
              <option value="item_deleted">Item deleted</option>
              <option value="family_member_added">Member added</option>
              <option value="family_member_role_updated">Member role updated</option>
              <option value="family_member_removed">Member removed</option>
              <option value="myvault_recovery_key_reset">My Vault recovery key reset</option>
              <option value="familyvault_recovery_key_set">Family vault recovery key set</option>
              <option value="myvault_created">My Vault created</option>
              <option value="familyvault_created">Family Vault created</option>
              <option value="myvault_unlocked">My Vault unlocked</option>
              <option value="familyvault_unlocked">Family Vault unlocked</option>
              <option value="nominee_access_requested">Nominee access requested</option>
              <option value="nominee_access_approved">Nominee access approved</option>
              <option value="nominee_vault_viewed">Nominee viewed vault</option>
              <option value="nominee_item_downloaded">Nominee downloaded item</option>
              <option value="nominee_added">Nominee added</option>
              <option value="nominee_deleted">Nominee removed</option>
              <option value="nominee_regenerated">Nominee keys regenerated</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400" htmlFor="fromDate">From date</label>
            <input
              type="date"
              id="fromDate"
              value={fromDate}
              onChange={(e) => {
                setNextCursor(null);
                setFromDate(e.target.value);
              }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-slate-400" htmlFor="toDate">To date</label>
            <input
              type="date"
              id="toDate"
              value={toDate}
              onChange={(e) => {
                setNextCursor(null);
                setToDate(e.target.value);
              }}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white focus:border-brand-500 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-400">
            {error}
          </p>
        )}

        {!loading && initialLoaded && logs.length === 0 && !error && (
          <p className="text-xs text-slate-400">No activity recorded yet.</p>
        )}

        <div className="space-y-3">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-200">
                    {formatVaultType(log.vaultType)}
                  </span>
                  <span className="text-slate-100">
                    {formatAction(log.action)}
                  </span>
                </div>
                {log.description && (
                  <p className="text-[11px] text-slate-400">
                    {log.description}
                  </p>
                )}
                {log.metadata && (log.metadata.category || log.metadata.filename) && (
                  <p className="text-[11px] text-slate-500">
                    {log.metadata.category && (
                      <span>Category: {String(log.metadata.category)}</span>
                    )}
                    {log.metadata.category && log.metadata.filename && <span> • </span>}
                    {log.metadata.filename && (
                      <span>File: {String(log.metadata.filename)}</span>
                    )}
                  </p>
                )}
              </div>
              <div className="ml-4 text-right">
                <p className="text-[10px] text-slate-500">
                  {formatTimestamp(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => loadLogs(nextCursor)}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}

        {loading && !initialLoaded && (
          <p className="mt-2 text-xs text-slate-400">Loading activity...</p>
        )}
      </div>
    </div>
  );
}


