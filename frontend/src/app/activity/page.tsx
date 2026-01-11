"use client";

import { useEffect, useState } from "react";
import { Download, ChevronDown, ChevronUp, AlertCircle, CheckCircle, XCircle, Info, Eye, FileText } from "lucide-react";

type ActivityLog = {
  id: string;
  vaultType: string;
  action: string;
  description: string | null;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
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
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);

  const [vaultTypeFilter, setVaultTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const loadLogs = async (cursor?: string | null) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("limit", "50");
      if (cursor) params.set("cursor", cursor);
      if (!cursor) {
        if (vaultTypeFilter !== "all") {
          params.set("vaultType", vaultTypeFilter);
        }
        if (actionFilter !== "all") {
          params.set("action", actionFilter);
        }
        if (severityFilter !== "all") {
          params.set("severity", severityFilter);
        }
        if (fromDate) {
          params.set("from", new Date(fromDate).toISOString());
        }
        if (toDate) {
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
  }, [vaultTypeFilter, actionFilter, severityFilter, fromDate, toDate]);

  const exportLogs = (format: 'csv' | 'json') => {
    if (logs.length === 0) return;

    if (format === 'csv') {
      const headers = ['Timestamp', 'Vault Type', 'Action', 'Description', 'Severity', 'Outcome', 'IP Address', 'User Agent', 'Metadata'];
      const rows = logs.map(log => {
        const severity = log.metadata?.severity || 'info';
        const outcome = log.metadata?.outcome || 'success';
        const metadataStr = JSON.stringify(log.metadata || {});
        return [
          new Date(log.createdAt).toISOString(),
          log.vaultType,
          log.action,
          log.description || '',
          severity,
          outcome,
          log.ipAddress || '',
          log.userAgent || '',
          metadataStr
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const jsonContent = JSON.stringify(logs, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const toggleExpand = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return iso;
    }
  };

  const formatAction = (action: string) => {
    return action.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatVaultType = (vaultType: string) => {
    if (vaultType === "account") return "Account";
    if (vaultType === "my_vault") return "My Vault";
    if (vaultType === "family_vault") return "Family Vault";
    return vaultType;
  };

  const getSeverityInfo = (log: ActivityLog) => {
    const severity = log.metadata?.severity || 'info';
    const outcome = log.metadata?.outcome || 'success';
    
    if (severity === 'critical' || severity === 'error' || outcome === 'failure') {
      return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    }
    if (severity === 'warning') {
      return { icon: AlertCircle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    }
    if (outcome === 'success') {
      return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    }
    return { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
  };

  const parseUserAgent = (ua: string | null | undefined) => {
    if (!ua) return 'Unknown';
    // Simple user agent parsing
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Other';
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Audit Trail</h1>
          <p className="mt-2 text-sm text-gray-600">
            Comprehensive audit log of all security and vault activities. All logs are immutable and meet government auditing standards.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportLogs('csv')}
            disabled={logs.length === 0}
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => exportLogs('json')}
            disabled={logs.length === 0}
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4 shadow-soft">
        {/* Enhanced Filters */}
        <div className="grid gap-3 sm:grid-cols-5 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 font-medium" htmlFor="vaultTypeFilter">Vault Type</label>
            <select
              id="vaultTypeFilter"
              value={vaultTypeFilter}
              onChange={(e) => {
                setNextCursor(null);
                setVaultTypeFilter(e.target.value);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All</option>
              <option value="account">Account</option>
              <option value="my_vault">My Vault</option>
              <option value="family_vault">Family Vault</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 font-medium" htmlFor="actionFilter">Action</label>
            <select
              id="actionFilter"
              value={actionFilter}
              onChange={(e) => {
                setNextCursor(null);
                setActionFilter(e.target.value);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All Actions</option>
              <option value="login_success">Login</option>
              <option value="password_reset">Password Reset</option>
              <option value="item_uploaded">Item Uploaded</option>
              <option value="item_downloaded">Item Downloaded</option>
              <option value="item_deleted">Item Deleted</option>
              <option value="myvault_created">My Vault Created</option>
              <option value="familyvault_created">Family Vault Created</option>
              <option value="nominee_added">Nominee Added</option>
              <option value="nominee_deleted">Nominee Removed</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 font-medium" htmlFor="severityFilter">Severity</label>
            <select
              id="severityFilter"
              value={severityFilter}
              onChange={(e) => {
                setNextCursor(null);
                setSeverityFilter(e.target.value);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="all">All</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 font-medium" htmlFor="fromDate">From Date</label>
            <input
              type="date"
              id="fromDate"
              value={fromDate}
              onChange={(e) => {
                setNextCursor(null);
                setFromDate(e.target.value);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-gray-600 font-medium" htmlFor="toDate">To Date</label>
            <input
              type="date"
              id="toDate"
              value={toDate}
              onChange={(e) => {
                setNextCursor(null);
                setToDate(e.target.value);
              }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {!loading && initialLoaded && logs.length === 0 && !error && (
          <p className="text-sm text-gray-600">No activity recorded yet.</p>
        )}

        <div className="space-y-2">
          {logs.map((log) => {
            const severityInfo = getSeverityInfo(log);
            const SeverityIcon = severityInfo.icon;
            const isExpanded = expandedLogs.has(log.id);
            const metadata = log.metadata || {};

            return (
              <div
                key={log.id}
                className={`rounded-lg border ${severityInfo.border} ${severityInfo.bg} transition-all`}
              >
                <div
                  className="flex items-start justify-between p-3 cursor-pointer hover:opacity-90"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <SeverityIcon className={`w-5 h-5 ${severityInfo.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-700 font-medium">
                          {formatVaultType(log.vaultType)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {formatAction(log.action)}
                        </span>
                        {metadata.severity && (
                          <span className="text-xs px-2 py-0.5 rounded bg-white/80 text-gray-600">
                            {metadata.severity}
                          </span>
                        )}
                        {metadata.outcome && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            metadata.outcome === 'success' ? 'bg-green-100 text-green-700' :
                            metadata.outcome === 'failure' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {metadata.outcome}
                          </span>
                        )}
                      </div>
                      {log.description && (
                        <p className="text-xs text-gray-600">{log.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        <span>{formatTimestamp(log.createdAt)}</span>
                        {log.ipAddress && <span>IP: {log.ipAddress}</span>}
                        {log.userAgent && <span>Browser: {parseUserAgent(log.userAgent)}</span>}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(log.id);
                    }}
                    className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-200 mt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium text-gray-700">Log ID:</span>
                        <p className="text-gray-600 font-mono text-[10px] mt-0.5">{log.id}</p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Timestamp:</span>
                        <p className="text-gray-600 mt-0.5">{formatTimestamp(log.createdAt)}</p>
                      </div>
                      {log.ipAddress && (
                        <div>
                          <span className="font-medium text-gray-700">IP Address:</span>
                          <p className="text-gray-600 mt-0.5">{log.ipAddress}</p>
                        </div>
                      )}
                      {log.userAgent && (
                        <div>
                          <span className="font-medium text-gray-700">User Agent:</span>
                          <p className="text-gray-600 mt-0.5 text-[10px] break-all">{log.userAgent}</p>
                        </div>
                      )}
                      {metadata.sessionId && (
                        <div>
                          <span className="font-medium text-gray-700">Session ID:</span>
                          <p className="text-gray-600 font-mono text-[10px] mt-0.5">{metadata.sessionId}</p>
                        </div>
                      )}
                      {metadata.requestId && (
                        <div>
                          <span className="font-medium text-gray-700">Request ID:</span>
                          <p className="text-gray-600 font-mono text-[10px] mt-0.5">{metadata.requestId}</p>
                        </div>
                      )}
                      {metadata.performance?.durationMs && (
                        <div>
                          <span className="font-medium text-gray-700">Duration:</span>
                          <p className="text-gray-600 mt-0.5">{metadata.performance.durationMs}ms</p>
                        </div>
                      )}
                    </div>

                    {metadata.beforeState && (
                      <div>
                        <span className="text-xs font-medium text-gray-700">Before State:</span>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] text-gray-600 overflow-x-auto">
                          {JSON.stringify(metadata.beforeState, null, 2)}
                        </pre>
                      </div>
                    )}

                    {metadata.afterState && (
                      <div>
                        <span className="text-xs font-medium text-gray-700">After State:</span>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] text-gray-600 overflow-x-auto">
                          {JSON.stringify(metadata.afterState, null, 2)}
                        </pre>
                      </div>
                    )}

                    {metadata.error && (
                      <div className="p-2 bg-red-50 border border-red-200 rounded">
                        <span className="text-xs font-medium text-red-700">Error:</span>
                        <p className="text-xs text-red-600 mt-1">{metadata.error.message}</p>
                        {metadata.error.code && (
                          <p className="text-xs text-red-500 mt-1">Code: {metadata.error.code}</p>
                        )}
                      </div>
                    )}

                    {Object.keys(metadata).length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-gray-700">Full Metadata:</span>
                        <pre className="mt-1 p-2 bg-gray-50 rounded text-[10px] text-gray-600 overflow-x-auto max-h-48">
                          {JSON.stringify(metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {nextCursor && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => loadLogs(nextCursor)}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}

        {loading && !initialLoaded && (
          <p className="mt-2 text-sm text-gray-600">Loading activity logs...</p>
        )}
      </div>
    </div>
  );
}
