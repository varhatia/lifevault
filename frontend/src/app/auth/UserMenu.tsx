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
      <a href="/auth/login" className="text-xs text-slate-300 hover:text-white">
        Login
      </a>
    );
  }

  const displayName = user.fullName || user.email;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="max-w-[160px] truncate text-slate-300">
        {displayName}
      </span>
      <button
        onClick={handleLogout}
        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
      >
        Logout
      </button>
    </div>
  );
}


