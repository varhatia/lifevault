"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import UserMenu from "./auth/UserMenu";
import InactivityMonitor from "./components/InactivityMonitor";
import { useAuth } from "@/lib/hooks/useAuth";

export default function LayoutClient({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Handle navigation for unauthenticated users - prevent flickering
  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    // Only intercept for protected routes when not authenticated
    const protectedRoutes = ["/my-vault", "/family-vault", "/nominee", "/admin"];
    if (!authLoading && !isAuthenticated && protectedRoutes.includes(href)) {
      e.preventDefault();
      router.push("/auth/login");
      return;
    }
  };

  return (
    <>
      <InactivityMonitor />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold">
              LV
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">
                LifeVault
              </div>
              <div className="text-xs text-slate-400">
                Secure digital personal and family vault
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-300">
            <nav className="flex gap-4">
              {/* For authenticated users - show when not loading and authenticated */}
              {!authLoading && isAuthenticated && (
                <>
                  <a href="/" onClick={(e) => handleNav(e, "/")} className="hover:text-white">
                    Home
                  </a>
                  <a href="/my-vault" onClick={(e) => handleNav(e, "/my-vault")} className="hover:text-white">
                    My Vault
                  </a>
                  <a href="/family-vault" onClick={(e) => handleNav(e, "/family-vault")} className="hover:text-white">
                    Family Vault
                  </a>
                  <a href="/admin" onClick={(e) => handleNav(e, "/admin")} className="hover:text-white">
                    Settings
                  </a>
                </>
              )}
              {/* For non-authenticated users - show when not loading and not authenticated */}
              {!authLoading && !isAuthenticated && (
                <>
                  <a href="/nominee-access" className="hover:text-white">
                    Nominee Access
                  </a>
                  <a href="/auth/login" className="hover:text-white">
                    Login
                  </a>
                </>
              )}
            </nav>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 py-6">{children}</main>
      </div>
    </>
  );
}
