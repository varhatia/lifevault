"use client";

import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import UserMenu from "../auth/UserMenu";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const handleNav = (path: string) => {
    // While auth state is loading, avoid double navigation
    if (loading) return;

    // For unauthenticated users, send protected routes straight to login
    const isProtected =
      path.startsWith("/my-vault") ||
      path.startsWith("/family-vault") ||
      path.startsWith("/nominee-vault");

    if (!isAuthenticated && isProtected) {
      router.push(`/auth/login?next=${encodeURIComponent(path)}`);
    } else {
      router.push(path);
    }
  };

  // Single consistent layout with header/footer for all pages
  // (including auth screens, landing, and app pages)
  return (
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
            <button
              type="button"
              onClick={() => handleNav("/")}
              className="hover:text-white"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => handleNav("/my-vault")}
              className="hover:text-white"
            >
              My Vault
            </button>
            <button
              type="button"
              onClick={() => handleNav("/family-vault")}
              className="hover:text-white"
            >
              Family Vault
            </button>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => handleNav("/nominee-access")}
                className="hover:text-white"
              >
                Nominee Access
              </button>
            )}
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => handleNav("/admin")}
                className="hover:text-white"
              >
                Settings
              </button>
            )}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main className="flex-1 py-6">{children}</main>
    </div>
  );
}

