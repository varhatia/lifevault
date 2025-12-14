"use client";

import "../styles/globals.css";
import React from "react";
import UserMenu from "./auth/UserMenu";
import InactivityMonitor from "./components/InactivityMonitor";

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
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
                  Secure family finance & legacy vault
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-300">
              <nav className="flex gap-4">
                <a href="/" className="hover:text-white">
                  Dashboard
                </a>
                <a href="/my-vault" className="hover:text-white">
                  My Vault
                </a>
                <a href="/family-vault" className="hover:text-white">
                  Family Vault
                </a>
                <a href="/nominee" className="hover:text-white">
                  Nominee
                </a>
                <a href="/admin" className="hover:text-white">
                  Admin
                </a>
              </nav>
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 py-6">{children}</main>
          <footer className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-500">
            Zero-knowledge, client-side encrypted. MVP prototype.
          </footer>
        </div>
      </body>
    </html>
  );
}


