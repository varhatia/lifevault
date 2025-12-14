"use client";

export default function AdminPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="mt-1 text-xs text-slate-300">
          Profile, device binding, security posture, and reminder settings.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <AdminCard
          title="Profile"
          body="Manage your contact details, primary email/mobile, and recovery preferences."
        />
        <AdminCard
          title="Security"
          body="View device bindings, recent sign-ins, and password rotation status."
        />
        <AdminCard
          title="Reminders"
          body="Configure cadence for vault reviews, password changes, and key rotation."
        />
      </section>

      <section className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">
        The backend will expose endpoints for reminder preferences, device
        binding, and token invalidation. This screen will surface that state
        and allow updates.
      </section>
    </div>
  );
}

function AdminCard(props: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <h2 className="text-sm font-semibold text-slate-100">{props.title}</h2>
      <p className="mt-2 text-slate-300">{props.body}</p>
      <button className="mt-3 rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-700">
        Configure
      </button>
    </div>
  );
}


