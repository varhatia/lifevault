"use client";

import "../styles/globals.css";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import UserMenu from "./auth/UserMenu";
import InactivityMonitor from "./components/InactivityMonitor";
import { useAuth } from "@/lib/hooks/useAuth";

export default function RootLayout({
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
    const protectedRoutes = ["/my-vault", "/nominee", "/my-account", "/actions", "/activity"];
    if (!authLoading && !isAuthenticated && protectedRoutes.includes(href)) {
      e.preventDefault();
      router.push("/auth/login");
      return;
    }
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <InactivityMonitor />
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
          <header className="flex items-center justify-between border-b border-gray-200 bg-white sticky top-0 z-50 px-6 py-3">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-500 text-sm font-semibold text-white">
                LV
              </div>
              <div>
                <div className="text-lg font-semibold tracking-tight text-gray-900">
                  LifeVault
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <nav className="hidden md:flex gap-5">
                {/* For authenticated users - show when not loading and authenticated */}
                {!authLoading && isAuthenticated && (
                  <>
                    <a href="/" onClick={(e) => handleNav(e, "/")} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                      Home
                    </a>
                    <a href="/actions" onClick={(e) => handleNav(e, "/actions")} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                      Review Mode
                    </a>
                    <a href="/my-vault" onClick={(e) => handleNav(e, "/my-vault")} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                      My Vault
                    </a>
                    <a href="/activity" onClick={(e) => handleNav(e, "/activity")} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                      Activity
                    </a>
                    <a href="/my-account" onClick={(e) => handleNav(e, "/my-account")} className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                      My Account
                    </a>
                  </>
                )}
                {/* For non-authenticated users - show when not loading and not authenticated */}
                {!authLoading && !isAuthenticated && (
                  <a href="/nominee-access" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">
                    Nominee Access
                  </a>
                )}
              </nav>
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 bg-gray-50 py-8 px-6">{children}</main>
        </div>
      </body>
    </html>
  );
}


