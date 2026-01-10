"use client";

import { useState, useEffect } from "react";

export interface UsageStats {
  vaultCount: number;
  nomineeCount: number;
  memberCount: number;
  storageUsedMB: number;
}

export interface PlanUsage {
  plan: "free" | "plus";
  usage: UsageStats;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePlanUsage(): PlanUsage {
  const [plan, setPlan] = useState<"free" | "plus">("free");
  const [usage, setUsage] = useState<UsageStats>({
    vaultCount: 0,
    nomineeCount: 0,
    memberCount: 0,
    storageUsedMB: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/user/usage");
      
      if (!res.ok) {
        throw new Error("Failed to fetch usage stats");
      }

      const data = await res.json();
      setPlan(data.plan || "free");
      setUsage(data.usage || {
        vaultCount: 0,
        nomineeCount: 0,
        memberCount: 0,
        storageUsedMB: 0,
      });
    } catch (err) {
      console.error("Error fetching usage:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch usage");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  return {
    plan,
    usage,
    loading,
    error,
    refetch: fetchUsage,
  };
}

