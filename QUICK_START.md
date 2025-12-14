# 🚀 LifeVault Quick Start (Consolidated)

Everything runs on **one port (3000)** with Next.js API routes!

## Setup (One-Time)

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Generate Prisma Client
npm run prisma:generate

# 3. Set up database (if not already done)
createdb lifevault

# 4. Run migrations (if needed)
npm run prisma:migrate
```

## Run the App

```bash
cd frontend
npm run dev
```

**That's it!** Everything runs on http://localhost:3000

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/api/health
- **All on one port!** 🎉

## API Endpoints

All endpoints are under `/api`:

- `GET /api/health` - Health check
- `GET /api/vaults/my` - List vault items
- `POST /api/vaults/my` - Create vault item
- `GET /api/family/vaults` - List family vaults
- `POST /api/family/vaults` - Create family vault
- `POST /api/family/vaults/:id/invite` - Invite member
- `GET /api/nominee` - Get nominee config
- `POST /api/nominee` - Configure nominee
- `POST /api/nominee/unlock` - Nominee unlock
- `GET /api/reminders` - Get reminders
- `POST /api/reminders` - Update reminders

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── api/          # API routes (backend)
│   │   ├── my-vault/     # Pages (frontend)
│   │   └── ...
│   └── lib/
│       ├── prisma.ts     # Database client
│       └── crypto.ts     # Encryption utils
└── prisma/
    └── schema.prisma     # Database schema
```

## Environment Variables

Create `frontend/.env.local`:

```env
DATABASE_URL=postgresql://lifevault:lifevault_dev@localhost:5432/lifevault
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
SERVER_SHARE_SECRET=dev-server-share-secret-change-in-production
```

## Benefits

✅ **Single Port**: Everything on 3000
✅ **Simpler**: One `npm run dev`
✅ **Faster**: No CORS, no separate services
✅ **Scalable**: Horizontal scaling with multiple instances
✅ **Cost Effective**: One service to deploy

See `CONSOLIDATION_COMPLETE.md` for full details!

