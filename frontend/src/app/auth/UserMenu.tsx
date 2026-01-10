"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type CurrentUser = {
  id: string;
  email: string;
  fullName?: string | null;
};

export default function UserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!isMounted) return;
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.user || null);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchUser();
    return () => {
      isMounted = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      setUser(null);
      router.push("/auth/login");
    }
  };

  // Show Login link immediately while checking auth in background
  // This prevents the flash of "Checking session..." message
  if (!user) {
    return (
      <a href="/auth/login" className="text-sm text-gray-600 hover:text-brand-600 font-medium transition-colors">
        Login
      </a>
    );
  }

  const displayName = user.fullName || user.email;

  return (
    <div className="relative flex items-center text-sm">
      <button
        onClick={() => setMenuOpen((open) => !open)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-soft"
      >
        <span className="max-w-[140px] truncate">{displayName}</span>
        <span className="text-gray-400">▾</span>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-large">
          <button
            onClick={() => {
              setMenuOpen(false);
              router.push("/activity");
            }}
            className={`block w-full px-4 py-2 text-left text-sm transition-colors ${
              pathname === "/activity"
                ? "bg-brand-50 text-brand-600 font-medium"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Activity
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              handleLogout();
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}


