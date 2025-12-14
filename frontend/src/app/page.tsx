"use client";

import Link from "next/link";

export default function HomePage() {
  // API is now in the same app - no separate backend needed!
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

      <section className="grid gap-4 md:grid-cols-3">
        <Card
          title="My Vault"
          description="Your private, encrypted vault for documents, notes, and structured entries."
          href="/my-vault"
        />
        <Card
          title="Family Vault"
          description="Shared, permissioned vault for partners and family members."
          href="/family-vault"
        />
        <Card
          title="Nominee Access"
          description="Configure posthumous, read-only access using split-key model."
          href="/nominee"
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


