"use client";

import Link from "next/link";
import {
  Shield,
  Lock,
  Users,
  Clock,
  FileText,
  Check,
  ArrowRight,
  Zap,
  Smartphone,
  Bell,
  KeyRound,
  FolderOpen,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero / Primary */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/10 via-transparent to-brand-700/10" />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-6">
            {/* Brand lockup */}
            <div className="inline-flex items-center gap-2 bg-slate-900/70 px-3 py-1">
              {/* <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-semibold text-white">
                LV
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold tracking-tight text-slate-50">
                  LifeVault
                </span>
                <span className="text-[10px] text-slate-400">
                  Secure family finance &amp; legacy vault
                </span>
              </div> */}
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              Your life, organized. Your loved ones, protected.
              </h1>
              <p className="text-lg text-slate-200">
                Securely store, organize, and share your most important financial, legal, and personal documents—so the people you trust always have access when it matters most.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/signup"
                className="group inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-700">
                Get Started for Free Now 
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              {/* <Link
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white">
                Why LifeVault? 
              </Link> */}
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              <span className="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1">End-to-end encrypted</span>
              <span className="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1">Zero-knowledge</span>
              <span className="rounded-full border border-slate-800 bg-slate-900/50 px-3 py-1">Built for families</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why LifeVault */}
      <section id="why" className="border-b border-slate-800 bg-slate-900/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Why LifeVault</p>
              <h2 className="text-3xl font-bold text-white">One place for everything that matters</h2>
              <p className="text-lg text-slate-200">
                Critical information is often scattered across emails, phones, cloud drives, and paper files.
                When families need it most, access becomes difficult.
              </p>
              <p className="text-base text-slate-300">
                LifeVault brings everything together—securely, privately, and thoughtfully.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:w-1/2">
              <Stat label="Zero-knowledge" value="Client-side" />
              <Stat label="Family-ready" value="Private + shared vaults" />
              <Stat label="Nominee access" value="Inactivity triggers" />
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="border-b border-slate-800 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Core Features</p>
            <h3 className="text-3xl font-bold text-white">Built for secure, family-first organization</h3>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<FolderOpen className="h-6 w-6" />}
              title="Digital Secure Storage"
              description="Store financial, legal, insurance, medical, and personal records in one secure place."
            />
            <FeatureCard
              icon={<Lock className="h-6 w-6" />}
              title="End-to-End Encryption"
              description="Zero-knowledge encryption ensures only you and trusted members can access your data."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Designed for Families"
              description="Separate private and shared vaults built for couples and families."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Nominee Access"
              description="Ensure nominated loved ones can securely access essential information when needed."
            />
            <FeatureCard
              icon={<Bell className="h-6 w-6" />}
              title="Smart Reminders"
              description="Monthly reviews, password refresh, and key rotation reminders keep you ready."
            />
            <FeatureCard
              icon={<Smartphone className="h-6 w-6" />}
              title="Cross-Device Access"
              description="Access your vault securely from web and mobile (secure by design)."
            />
          </div>
        </div>
      </section>

      {/* Vault Types */}
      <section id="vault-types" className="border-b border-slate-800 bg-slate-900/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Vault Types</p>
            <h3 className="text-3xl font-bold text-white">Private when you need it, shared when you want it</h3>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <VaultCard
              title="My Vault"
              description="Your personal, private vault for sensitive information—accessible only by you."
              bullets={["Personal documents", "Private notes", "Full control"]}
            />
            <VaultCard
              title="Family Vault"
              description="A shared vault for couples and families to jointly manage important information."
              bullets={["Shared access", "Easy updates", "Transparent collaboration"]}
            />
          </div>
        </div>
      </section>

      {/* Nominee Access */}
      <section id="nominee" className="border-b border-slate-800 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Nominee Access</p>
            <h3 className="text-3xl font-bold text-white">Available to Loved Ones — When Needed</h3>
            <p className="text-lg text-slate-200">
              LifeVault ensures your nominated loved ones can access critical information if you’re ever unavailable—
              without compromising your privacy.
            </p>
            <div className="space-y-3">
              <BenefitPoint title="Secure nominee workflow" description="Controlled, read-only access with encrypted keys." />
              <BenefitPoint title="No searching or guesswork" description="Everything organized and discoverable when needed." />
              <BenefitPoint title="Access designed with care" description="Inactivity triggers with email reminders before access." />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/20 text-brand-200">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm text-slate-300">Nominee Pass</div>
                <div className="text-lg font-semibold text-white">Secure, time-based access</div>
              </div>
            </div>
            <div className="space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-brand-300" />
                <span>Configurable inactivity period with reminders</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-brand-300" />
                <span>Read-only, zero-knowledge nominee access</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-brand-300" />
                <span>Secure key delivery — no plain text ever leaves your device</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Reminders
      <section id="reminders" className="border-b border-slate-800 bg-slate-900/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Smart Reminders</p>
            <h3 className="text-3xl font-bold text-white">Stay Prepared, Effortlessly</h3>
            <p className="text-lg text-slate-200">Quiet nudges that keep your life organized.</p>
          </div>
          <div className="space-y-4">
            <ReminderItem title="Monthly vault review reminder" />
            <ReminderItem title="90-day app password refresh" />
            <ReminderItem title="6-month encryption key rotation" />
          </div>
        </div>
      </section> */}

      {/* Pricing */}
      <section id="pricing" className="border-b border-slate-800 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Pricing</p>
            <h3 className="text-3xl font-bold text-white">Start free, grow when you need</h3>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <PricingCard
              name="Free Forever"
              price="₹0"
              period="Free"
              description="Perfect to get organized."
              features={[
                "1 Private Vault",
                "1 Family Vault",
                "Up to 2 family members",
                "5 MB secure storage",
                "Lifetime nominee access",
                "End-to-end encryption",
                "Smart reminders",
              ]}
              cta="Start Free"
              ctaLink="/auth/signup"
              highlight={false}
            />
            <PricingCard
              name="LifeVault Plus"
              price="₹199"
              period="month"
              description="For families that want more."
              features={[
                "Multiple private vaults",
                "Multiple family vaults",
                "Unlimited members",
                "Unlimited storage",
                "Advanced sharing controls",
                "Priority support",
                "Lifetime nominee access",
              ]}
              cta="Upgrade to Plus"
              ctaLink="/auth/signup"
              highlight={true}
            />
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section id="trust" className="border-b border-slate-800 bg-slate-900/40 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Trust & Security</p>
            <h3 className="text-3xl font-bold text-white">Security-first, privacy-first</h3>
            <p className="text-sm text-slate-300 max-w-2xl">
              Thoughtful auto-sharing when you are unavailable: configurable inactivity window, gentle email nudges,
              and secure, read-only nominee access when truly needed.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TrustPoint title="Zero-knowledge architecture" />
            <TrustPoint title="Industry-grade encryption" />
            <TrustPoint title="Privacy-first design" />
            <TrustPoint title="You control access" />
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section id="ecosystem" className="border-b border-slate-800 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Ecosystem</p>
          <h3 className="text-3xl font-bold text-white">Coming Soon</h3>
          <p className="text-lg text-slate-200 max-w-3xl">
            Trusted ecosystem - LifeVault is designed to integrate with insurers, hospitals, lawyers, and estate planners - helping families stay prepared and protected.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8 space-y-4">
          <h3 className="text-3xl font-bold text-white sm:text-4xl">
            One vault for life. Peace of mind for your family.
          </h3>
          <p className="text-lg text-slate-200">Free forever. Upgrade when you grow.</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-8 py-3 text-lg font-semibold text-white transition hover:bg-brand-700"
          >
            Get Started with LifeVault
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm text-slate-400">
          <div className="flex items-center gap-2 text-slate-300">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
              LV
            </div>
            <div>
              <div className="font-semibold text-white">LifeVault</div>
              <div className="text-xs text-slate-400">Secure digital personal and family vault</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="#why" className="hover:text-white">About</Link>
            <Link href="#trust" className="hover:text-white">Security</Link>
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700 hover:bg-slate-900">
      <div className="mb-4 text-brand-300">{icon}</div>
      <h4 className="text-lg font-semibold text-white mb-2">{title}</h4>
      <p className="text-sm text-slate-300">{description}</p>
    </div>
  );
}

function VaultCard({
  title,
  description,
  bullets,
}: {
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
      <h4 className="text-xl font-semibold text-white">{title}</h4>
      <p className="text-sm text-slate-300">{description}</p>
      <ul className="space-y-2 text-sm text-slate-200">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-brand-300" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BenefitPoint({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 text-sm text-slate-200">
      <div className="mt-1 h-2 w-2 rounded-full bg-brand-400 flex-shrink-0" />
      <div>
        <div className="font-semibold text-white">{title}</div>
        <div className="text-slate-300">{description}</div>
      </div>
    </div>
  );
}

function ReminderItem({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-200">
      <div className="h-2 w-2 rounded-full bg-brand-400" />
      <span>{title}</span>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaLink,
  highlight,
}: {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-8 ${
        highlight
          ? "border-brand-500 bg-gradient-to-br from-brand-500/10 to-slate-900 shadow-brand-500/10 shadow-lg"
          : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="mb-6">
        <div className="text-sm text-brand-200 font-semibold">{name}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-white">{price}</span>
          <span className="text-slate-400">/ {period}</span>
        </div>
        <p className="mt-2 text-slate-200">{description}</p>
      </div>
      <ul className="mb-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm text-slate-200">
            <Check className="mt-0.5 h-4 w-4 text-brand-300" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaLink}
        className={`block w-full rounded-lg px-6 py-3 text-center font-semibold transition ${
          highlight
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-700"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function TrustPoint({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 flex items-center gap-2">
      <Shield className="h-4 w-4 text-brand-300" />
      <span>{title}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

