"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Hook to track user inactivity and logout after timeout
 * Monitors mouse, keyboard, touch, and scroll events
 */
export function useInactivityTimeout(
  isAuthenticated: boolean,
  onTimeout: () => void
) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimeout = useCallback(() => {
    if (!isAuthenticated) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Update last activity time
    lastActivityRef.current = Date.now();

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      console.log("User inactive for 15 minutes, logging out...");
      onTimeout();
      router.push("/auth/login");
    }, INACTIVITY_TIMEOUT_MS);
  }, [isAuthenticated, onTimeout, router]);

  const handleActivity = useCallback(() => {
    if (!isAuthenticated) return;
    resetTimeout();
  }, [isAuthenticated, resetTimeout]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear timeout if user is not authenticated
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Initial timeout setup
    resetTimeout();

    // List of events that indicate user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
      "keydown",
    ];

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Also check on visibility change (user switches tabs/windows)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isAuthenticated) {
        // Check if user was away for more than timeout
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;
        if (timeSinceLastActivity >= INACTIVITY_TIMEOUT_MS) {
          console.log("User was away for too long, logging out...");
          onTimeout();
          router.push("/auth/login");
        } else {
          // Reset timeout when user comes back
          resetTimeout();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, handleActivity, resetTimeout, onTimeout, router]);

  // Return function to manually reset timeout (useful for API calls)
  return { resetTimeout };
}


