"use client";

import { useState } from "react";
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
  ChevronDown,
  Heart,
  Search,
  Eye,
  Target,
  Sparkles,
  Grid3x3,
  HelpCircle,
  Tag,
} from "lucide-react";

export default function LandingPage() {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  const toggleQuestion = (index: number) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedQuestions(newExpanded);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero / Primary */}
      <section className="relative overflow-hidden border-b border-gray-200 bg-white">
        <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-4">
              <h1 className="text-5xl font-semibold leading-tight text-gray-900 sm:text-6xl">
              Your life, organized. Your loved ones, protected.
              </h1>
              <p className="text-lg text-gray-600">
                Securely organize the information your family would need in an emergency — finances, insurance, legal documents, and more — so nothing is left to guesswork when it matters most.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Link
                href="/auth/signup"
                className="group inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-2.5 text-base font-medium text-white hover:bg-brand-600 transition-colors">
                Get Started for Free Now 
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600">
              <span className="rounded px-3 py-1 bg-gray-50">End-to-end encrypted</span>
              <span className="rounded px-3 py-1 bg-gray-50">Zero-knowledge</span>
              <span className="rounded px-3 py-1 bg-gray-50">Built for families</span>
            </div>
          </div>
        </div>
      </section>

      {/* Why LivPeace */}
      <section id="why" className="border-b border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                  <Target className="h-6 w-6 text-brand-500" />
                </div>
                <h2 className="text-3xl font-semibold text-gray-900">One place for everything that matters</h2>
              </div>
              <p className="text-base text-gray-600">
                Critical information is often scattered across emails, phones, cloud drives, and paper files.
                When families need it most, access becomes difficult. 
                </p>
              <p className="text-base text-gray-600">
                LivPeace helps you understand what to organize, where to put it, and who should have access by bringing everything together—securely, privately, and thoughtfully
              </p>
              <p className="text-base text-gray-600">
                Private when you need it, shared when you want it.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:w-1/2">
              <Stat label="Private by default" value="Client-side" />
              <Stat label="Built for real families" value="Private + shared vaults" />
              <Stat label="Access when you’re unavailable" value="Inactivity triggers" />
            </div>
          </div>
        </div>
      </section>

      {/* Life Preparedness for Modern Families */}
      <section id="preparedness" className="border-b border-gray-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                  <Heart className="h-6 w-6 text-brand-500" />
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-semibold text-gray-900">Life preparedness for modern families</h2>
                  <p className="text-base text-gray-500 italic mt-2">
                    Because being prepared today is more than keeping papers in a file.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-4 text-base text-gray-600 leading-relaxed">
             <p>
                LivPeace helps families prepare — not by predicting the worst, but by making sure the right information is organized, current, and accessible when it matters most.
              </p>
            </div>
            <div className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                    <FileText className="h-5 w-5 text-brand-500" />
                  </div>
                  <p className="text-base text-gray-700 font-medium">Know what information matters and how to organize it</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                    <Bell className="h-5 w-5 text-brand-500" />
                  </div>
                  <p className="text-base text-gray-700 font-medium">Keep essential details up to date with gentle reminders</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                    <Users className="h-5 w-5 text-brand-500" />
                  </div>
                  <p className="text-base text-gray-700 font-medium">Ensure your family isn't left searching, guessing, or overwhelmed</p>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                    <KeyRound className="h-5 w-5 text-brand-500" />
                  </div>
                  <p className="text-base text-gray-700 font-medium">Share access intentionally, not broadly</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                  <Shield className="h-5 w-5 text-brand-500" />
                </div>
                <p className="text-base text-gray-700 font-medium">Stay prepared without exposing sensitive information</p>
              </div>
            </div>
            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <Heart className="h-5 w-5 text-brand-500 mt-0.5 flex-shrink-0" />
                <p className="text-base text-gray-700 font-medium italic">
                  Preparedness isn't about fear — it's about responsibility, clarity, and peace of mind for the people you care about.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="border-b border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                <Sparkles className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">Built for secure, family-first organization</h3>
            </div>
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

      {/* Vault Types
      <section id="vault-types" className="border-b border-gray-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Vault Types</p>
            <h3 className="text-3xl font-semibold text-gray-900 mt-2">Private when you need it, shared when you want it</h3>
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
      </section> */}

      {/* Nominee Access */}
      <section id="nominee" className="border-b border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                <KeyRound className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">Available to Loved Ones — When Needed</h3>
            </div>
            <p className="text-base text-gray-600 max-w-3xl">
              LivPeace ensures your nominated loved ones can access critical information if you're ever unavailable—
              without compromising your privacy.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-soft">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                <Shield className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">Secure nominee workflow</h4>
                <p className="text-sm text-gray-600">Controlled, read-only access with encrypted keys.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-soft">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                <Search className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">No searching or guesswork</h4>
                <p className="text-sm text-gray-600">Everything organized and discoverable when needed.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-soft">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500/10 flex-shrink-0">
                <Bell className="h-5 w-5 text-brand-500" />
              </div>
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-1">Access designed with care</h4>
                <p className="text-sm text-gray-600">Inactivity triggers with email reminders before access.</p>
              </div>
            </div>
          </div>
          <div className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-medium">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-white">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Nominee Pass</div>
                <div className="text-lg font-semibold text-gray-900">Secure, time-based access</div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 text-brand-500 flex-shrink-0" />
                <span>Configurable inactivity period with reminders</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 text-brand-500 flex-shrink-0" />
                <span>Read-only, zero-knowledge nominee access</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 text-brand-500 flex-shrink-0" />
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


      {/* Trust & Security */}
      <section id="trust" className="border-b border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                <Shield className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">Built for trust and privacy</h3>
            </div>
            <p className="text-base text-gray-600 max-w-2xl">
            When families access sensitive information during stressful moments, privacy and trust matter more than ever. 
            <br/> <br/> 
            LivPeace is designed so your information stays private — even from us. Configurable inactivity window, gentle email nudges and secure, read-only nominee access when truly needed.
            </p>
            <p className="text-base text-gray-600 max-w-2xl"><strong>Privacy isn’t a feature at LivPeace — it’s a responsibility.</strong></p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TrustPoint title="Zero-knowledge architecture" />
            <TrustPoint title="Industry-grade encryption" />
            <TrustPoint title="Privacy-first design" />
            <TrustPoint title="You control access" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-b border-gray-200 bg-white py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                <Tag className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">Start free, grow when you need</h3>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <PricingCard
              name="Free Forever"
              price="₹0"
              period="Free"
              description="Perfect to get organized."
              features={[
                "1 Vault",
                "1 Nominee",
                "Up to 2 Additional Members",
                "5 MB Storage",
                "Encrypted storage",
                "Lifetime nominee access",
                "Smart monthly review reminders",
                
              ]}
              cta="Start Free"
              ctaLink="/auth/signup"
              highlight={false}
            />
            <PricingCard
              name="LivPeace Plus"
              price="₹99"
              period="month"
              description="For families that want more."
              features={[
                "Unlimited storage",
                "Unlimited members",
                "Multiple nominees (priority order)",
                "App & Vault password rotation reminders",
                "Priority support",
                "Export vault (PDF/ZIP for offline safekeeping)",
              ]}
              cta="Upgrade to Plus"
              ctaLink="/auth/signup"
              highlight={true}
            />
          </div>
        </div>
      </section>


      {/* Frequently Asked Questions */}
      <section id="faq" className="border-b border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                <HelpCircle className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">Frequently Asked Questions</h3>
            </div>
          </div>
          <div className="space-y-4">
            {faqData.map((faq, index) => (
              <FAQItem
                key={index}
                question={faq.question}
                answer={faq.answer}
                isExpanded={expandedQuestions.has(index)}
                onToggle={() => toggleQuestion(index)}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section id="ecosystem" className="border-b border-gray-200 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 flex-shrink-0">
                <Zap className="h-6 w-6 text-brand-500" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900">Coming Soon</h3>
            </div>
            <p className="text-base text-gray-600 max-w-3xl">
              Trusted ecosystem - LivPeace is designed to eventually integrate with insurers, hospitals, lawyers, and estate planners — so families can move faster when it matters.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="py-16 bg-brand-500">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6 lg:px-8 space-y-4">
          <h3 className="text-3xl font-semibold text-white sm:text-4xl">
            One vault for life. Peace of mind for your family.
          </h3>
          <p className="text-base text-white/90">Free forever. Upgrade when you grow.</p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-2.5 text-base font-medium text-brand-500 hover:bg-gray-50 transition-colors"
          >
            Get Started with LivPeace
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-xs font-semibold text-white">
              LP
            </div>
            <div>
              <div className="font-semibold text-gray-900">LivPeace</div>
              <div className="text-xs text-gray-500">Secure digital personal and family vault</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-5 font-medium">
            <Link href="#why" className="text-gray-600 hover:text-gray-900 transition-colors">About</Link>
            <Link href="#trust" className="text-gray-600 hover:text-gray-900 transition-colors">Security</Link>
            <Link href="/privacy" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-gray-600 hover:text-gray-900 transition-colors">Terms</Link>
            <Link href="/contact" className="text-gray-600 hover:text-gray-900 transition-colors">Contact</Link>
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
    <div className="rounded-lg border border-gray-200 bg-white p-6 transition-all hover:shadow-medium">
      <div className="mb-4 text-brand-500">{icon}</div>
      <h4 className="text-base font-semibold text-gray-900 mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
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
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3 shadow-soft hover:shadow-medium transition-all">
      <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
      <ul className="space-y-2 text-sm text-gray-600">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-brand-500 flex-shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BenefitPoint({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <div className="mt-1 h-2 w-2 rounded-full bg-brand-500 flex-shrink-0" />
      <div>
        <div className="font-medium text-gray-900">{title}</div>
        <div className="text-gray-600 mt-0.5">{description}</div>
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
      className={`rounded-lg border p-6 transition-all ${
        highlight
          ? "border-brand-500 bg-white shadow-medium"
          : "border-gray-200 bg-white shadow-soft"
      }`}
    >
      <div className="mb-6">
        <div className="text-sm text-gray-500 font-medium mb-2">{name}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold text-gray-900">{price}</span>
          <span className="text-gray-600">/ {period}</span>
        </div>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      </div>
      <ul className="mb-6 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
            <Check className="mt-0.5 h-4 w-4 text-brand-500 flex-shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaLink}
        className={`block w-full rounded-md px-4 py-2.5 text-center font-medium transition-colors ${
          highlight
            ? "bg-brand-500 text-white hover:bg-brand-600"
            : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
        }`}
      >
        {cta}
      </Link>
    </div>
  );
}

function TrustPoint({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 flex items-center gap-2 shadow-soft">
      <Shield className="h-4 w-4 text-brand-500 flex-shrink-0" />
      <span className="font-medium">{title}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-soft">
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium">{label}</div>
      <div className="text-sm font-semibold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

function FAQItem({
  question,
  answer,
  isExpanded,
  onToggle,
  index,
}: {
  question: string;
  answer: string | React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden transition-all hover:shadow-medium">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
        {...(isExpanded ? { "aria-expanded": "true" } : { "aria-expanded": "false" })}
        aria-controls={`faq-answer-${index}`}
        type="button"
      >
        <span className="text-base font-semibold text-gray-900 pr-4">{question}</span>
        <ChevronDown
          className={`h-5 w-5 text-gray-500 flex-shrink-0 transition-transform ${
            isExpanded ? "transform rotate-180" : ""
          }`}
        />
      </button>
      {isExpanded && (
        <div
          id={`faq-answer-${index}`}
          className="px-5 pb-5 text-sm text-gray-600 leading-relaxed"
        >
          {typeof answer === "string" ? (
            <div className="whitespace-pre-line">{answer}</div>
          ) : (
            answer
          )}
        </div>
      )}
    </div>
  );
}

const faqData = [
  {
    question: "What is LivPeace really for?",
    answer: (
      <>LivPeace helps you prepare your life’s essential information so your loved ones aren’t left searching during emergencies, medical situations, or after your absence. It’s not just storage — it’s preparedness with privacy.
      </>
    ),
  },
  {
    question: "Why do I need LivPeace when I already use Google Drive / Dropbox?",
    answer: (
      <>
        Google Drive and Dropbox are file storage tools.
        <br />
        LivPeace is a life continuity platform.
        <br />
        <br />
        <strong>File storage apps:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Store files, but don't guide you on what to store</li>
          <li>Don't track nominee access</li>
          <li>Don't help your family know what exists and what to do</li>
          <li>Don't unlock access if you're no longer around</li>
        </ul>
        <br />
        <strong>LivPeace is designed specifically for:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Organizing critical life documents</li>
          <li>Helping loved ones find the right information at the right time</li>
          <li>Providing controlled access during emergencies or after loss</li>
        </ul>
        <br />
        Think of it as the difference between:
        <br />
        A cupboard vs a clearly labeled emergency kit
      </>
    ),
  },
  {
    question: "Why can't I just keep documents on my phone or laptop?",
    answer: (
      <>
        Many people do — until something goes wrong.
        <br />
        <br />
        <strong>Common issues:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Phones get lost, damaged, or locked</li>
          <li>Family doesn't know where files are stored</li>
          <li>No access to passwords or recovery information</li>
          <li>Important documents are scattered across emails, drives, and folders</li>
        </ul>
        <br />
        <strong>LivPeace gives you:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>A single, organized place</li>
          <li>Clear structure for essential information</li>
          <li>Access rules that work even if you're unavailable</li>
        </ul>
        <br />
        It's not about convenience — it's about preparedness.
      </>
    ),
  },
  {
    question: "Isn't keeping physical documents enough?",
    answer: (
      <>
        Physical documents are important — but they're often:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Hard to locate in emergencies</li>
          <li>Unknown to family members</li>
          <li>Incomplete or outdated</li>
          <li>Accessible only to the person who stored them</li>
        </ul>
        <br />
        LivPeace doesn't replace physical documents — it complements them by:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Creating a digital index of what exists</li>
          <li>Storing scanned copies securely</li>
          <li>Guiding your family on next steps</li>
        </ul>
        <br />
        Most families struggle not because documents don't exist, but because:
        <br />
        They don't know where to look.
      </>
    ),
  },
  {
    question: "How is LivPeace different from a password manager?",
    answer: (
      <>
        Password managers focus on daily access.
        <br />
        LivPeace focuses on life events.
        <br />
        <br />
        <strong>LivPeace:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Does not require storing passwords</li>
          <li>Helps your family understand what accounts exist</li>
          <li>Provides instructions instead of raw credentials</li>
          <li>Activates access based on inactivity or emergency scenarios</li>
        </ul>
        <br />
        You can use LivPeace alongside a password manager — not instead of one.
      </>
    ),
  },
  {
    question: "Will LivPeace ever see or read my documents?",
    answer: (
      <>
        No.
        <br />
        <br />
        LivPeace uses client-side encryption, which means:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Your data is encrypted before it leaves your device</li>
          <li>LivPeace servers store only encrypted data</li>
          <li>We cannot read your documents, notes, or instructions</li>
          <li>Only you — and the people you explicitly authorize — can access your information</li>
        </ul>
      </>
    ),
  },
  {
    question: "What happens if I stop using the app or LivPeace shuts down?",
    answer: (
      <>
        Your data is never locked in.
        <br />
        <br />
        Paid plans allow you to:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Export a complete offline backup (PDF or encrypted archive)</li>
          <li>Store it with a lawyer, family member, or secure device</li>
          <li>Retain access even without LivPeace</li>
        </ul>
        <br />
        We believe:
        <br />
        Your life records should outlive any app.
      </>
    ),
  },
  {
    question: "Do I need to add everything at once?",
    answer: (
      <>
        Not at all.
        <br />
        <br />
        LivPeace is designed to be:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Built gradually</li>
          <li>Updated over time</li>
          <li>Reviewed periodically</li>
        </ul>
        <br />
        You can start with just:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Identity documents</li>
          <li>One bank or insurance policy</li>
        </ul>
        <br />
        And add more when you're ready.
      </>
    ),
  },
  {
    question: "Is this only useful after death?",
    answer: (
      <>
        No — and this is important.
        <br />
        <br />
        LivPeace is useful for:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Medical emergencies</li>
          <li>Travel or hospitalization</li>
          <li>Temporary incapacity</li>
          <li>Family coordination</li>
          <li>Annual reviews and clean-up</li>
        </ul>
        <br />
        Most users find value while they're alive, not just later.
      </>
    ),
  },
  {
    question: "What exactly will my nominee or family be able to do?",
    answer: (
      <>
        Depending on what you choose to share, they can:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>See what documents and accounts exist</li>
          <li>Download copies of critical records</li>
          <li>Follow your instructions for insurance, investments, or digital accounts</li>
          <li>Avoid guesswork and delays</li>
        </ul>
        <br />
        They do not get unrestricted access unless you allow it.
      </>
    ),
  },
  {
    question: "Why should I pay for LivPeace?",
    answer: (
      <>
        You're not paying for storage.
        <br />
        You're paying for peace of mind and continuity.
        <br />
        <br />
        <strong>Paid plans unlock:</strong>
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Unlimited secure storage</li>
          <li>Multiple family members</li>
          <li>Advanced reminders (passwords, reviews)</li>
          <li>Encrypted offline backups</li>
          <li>Priority access and future features</li>
        </ul>
        <br />
        Most importantly, you're paying for:
        <br />
        Knowing your family won't struggle to figure things out.
      </>
    ),
  },
  {
    question: "Who is LivPeace for?",
    answer: (
      <>
        LivPeace is for anyone who:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Has dependents or family</li>
          <li>Manages finances, insurance, or digital accounts</li>
          <li>Wants clarity instead of chaos</li>
          <li>Believes preparation is an act of care</li>
        </ul>
        <br />
        You don't need to be wealthy or old.
        <br />
        You just need to be responsible.
      </>
    ),
  },
  {
    question: "Is this legally binding or a replacement for a will?",
    answer: (
      <>
        No.
        <br />
        <br />
        LivPeace does not replace:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>A will</li>
          <li>Legal advice</li>
          <li>Estate planning documents</li>
        </ul>
        <br />
        It complements them by:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Organizing supporting documents</li>
          <li>Making intentions clear</li>
          <li>Helping families act faster and with confidence</li>
        </ul>
      </>
    ),
  },
  {
    question: "How often do I need to use LivPeace?",
    answer: (
      <>
        As little or as often as you like.
        <br />
        <br />
        Many users:
        <ul className="list-disc list-inside mt-2 space-y-1 ml-4">
          <li>Review quarterly or yearly</li>
          <li>Update after major life events</li>
          <li>Appreciate reminders to stay current</li>
        </ul>
        <br />
        LivPeace is not meant to be a daily app —
        <br />
        it's meant to be a reliable one.
      </>
    ),
  },
];

