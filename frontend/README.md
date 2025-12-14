## LifeVault Frontend (Next.js 15 + Tailwind)

Responsive, zero-knowledge client for the LifeVault MVP. This app handles all
UI flows and performs client-side encryption before sending any payloads to the
backend.

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

### Key Screens

- **Dashboard** (`/`) – overview of My Vault, Family Vault, and Nominee status.
- **My Vault** (`/my-vault`) – private, encrypted vault items by category.
- **Family Vault** (`/family-vault`) – shared folders, invite members, manage permissions.
- **Nominee** (`/nominee`) – configure nominee and explain split-key model.
- **Admin** (`/admin`) – profile, security, reminders.

### Getting Started

```bash
cd frontend
pnpm install # or npm install / yarn
pnpm dev     # starts Next.js dev server on http://localhost:3000
```

### Next Steps (MVP Wiring)

- Hook screens to FastAPI backend endpoints under `/api`.
- Implement client-side AES-256 encryption and Shamir Secret Sharing utilities.
- Add auth/session handling, device binding, and reminder banners.


