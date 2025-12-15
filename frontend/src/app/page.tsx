"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import LandingPage from "./components/LandingPage";
import Link from "next/link";

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    if (!loading) {
      setShowLanding(!isAuthenticated);
    }
  }, [isAuthenticated, loading]);

  // Show landing page for unauthenticated users
  if (showLanding && !loading) {
    return <LandingPage />;
  }

  // Show dashboard for authenticated users
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-slate-400">Loading...</div>
      </div>
    );
  }

  // Dashboard for authenticated users
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          Welcome to LifeVault
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Secure, zero-knowledge vault for families to store critical financial
          and legal information, share with loved ones, and enable controlled
          nominee access.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <VaultSummaryCard
          title="My Vault"
          href="/my-vault"
          tagline="Your personal, private vault."
          bullets={[
            "Store financial, legal, identity and personal documents in one place",
            "Protected with your own master password and recovery key",
            "Add nominees who can access a read-only view when needed",
          ]}
        />
        <VaultSummaryCard
          title="Family Vault"
          href="/family-vault"
          tagline="A shared space for your family."
          bullets={[
            "Organize joint accounts, policies, and important family documents",
            "Invite partners and family with admin, editor, or viewer roles",
            "Keep everyone aligned while preserving zero-knowledge security",
          ]}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoBlob
          title="Zero-Knowledge"
          body="Encryption happens in the browser. Vault contents are never visible to the service."
        />
        <InfoBlob
          title="Split Keys"
          body="2-of-3 Shamir Secret Sharing across you, LifeVault, and your nominee."
        />
        <InfoBlob
          title="Security Hygiene"
          body="Automated reminders for reviews, password rotation, and key rotation."
        />
      </section>
    </div>
  );
}

function Card(props: { title: string; description: string; href: string }) {
  return (
    <Link
      href={props.href}
      className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4 hover:border-brand-500 hover:bg-slate-900"
    >
      <h2 className="text-base font-semibold">{props.title}</h2>
      <p className="mt-2 text-xs text-slate-300">{props.description}</p>
      <span className="mt-3 text-xs font-medium text-brand-400 group-hover:text-brand-300">
        Open →
      </span>
    </Link>
  );
}

function VaultSummaryCard(props: {
  title: string;
  href: string;
  tagline: string;
  bullets: string[];
}) {
  return (
    <Link
      href={props.href}
      className="group flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/60 p-6 hover:border-brand-500 hover:bg-slate-900 transition-colors"
    >
      <h2 className="text-lg font-semibold text-white">{props.title}</h2>
      <p className="mt-2 text-sm text-slate-200">{props.tagline}</p>
      <ul className="mt-3 space-y-1.5 text-xs text-slate-300">
        {props.bullets.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <span className="mt-4 text-xs font-medium text-brand-400 group-hover:text-brand-300">
        Open →
      </span>
    </Link>
  );
}

function InfoBlob(props: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-brand-400">
        {props.title}
      </div>
      <p className="mt-2 text-xs text-slate-300">{props.body}</p>
    </div>
  );
}


