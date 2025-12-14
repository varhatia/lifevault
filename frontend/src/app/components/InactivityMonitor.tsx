"use client";

import { useInactivityTimeout } from "@/lib/hooks/useInactivityTimeout";
import { useAuth } from "@/lib/hooks/useAuth";
import { useEffect } from "react";

/**
 * Component that monitors user inactivity and logs out after 15 minutes
 * Should be included in the root layout to work across all pages
 */
export default function InactivityMonitor() {
  const { isAuthenticated, loading } = useAuth();

  const handleTimeout = async () => {
    try {
      // Call logout API to clear server-side session
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Error during inactivity logout:", error);
    } finally {
      // Clear client-side auth state
      // The redirect will happen in the hook
      if (typeof window !== "undefined") {
        // Clear any vault-related data
        localStorage.removeItem("vaultKeyInitialized");
        localStorage.removeItem("vaultVerifier");
        sessionStorage.clear();
      }
    }
  };

  // Only monitor if user is authenticated
  useInactivityTimeout(isAuthenticated && !loading, handleTimeout);

  // This component doesn't render anything
  return null;
}


