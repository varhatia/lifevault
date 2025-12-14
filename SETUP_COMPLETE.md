# ✅ Setup Complete!

Your LifeVault backend virtual environment has been created and dependencies installed!

## Next Steps

### 1. Create Environment Files

**Backend** (`backend/.env`):
```bash
cat > backend/.env << 'EOF'
DATABASE_URL=postgresql+asyncpg://lifevault:lifevault_dev@localhost:5432/lifevault
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
JWT_ALGORITHM=HS256
CORS_ORIGINS=http://localhost:3000
EOF
```

**Frontend** (`frontend/.env.local`):
```bash
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
```

### 2. Set Up Database

```bash
# Create PostgreSQL database
createdb lifevault

# Or if you need to create a user first:
psql -c "CREATE USER lifevault WITH PASSWORD 'lifevault_dev';"
psql -c "CREATE DATABASE lifevault OWNER lifevault;"
```

### 3. Run Database Migrations

```bash
cd backend
source .venv/bin/activate
alembic upgrade head
cd ..
```

### 4. Start the Application

**Option A: Use the dev script (both services)**
```bash
./scripts/dev.sh
```

**Option B: Run separately (recommended)**

Terminal 1 - Backend:
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### 5. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Quick Commands

```bash
# Activate backend virtual environment
cd backend && source .venv/bin/activate

# Run migrations
alembic upgrade head

# Start backend
uvicorn app.main:app --reload

# Start frontend (in another terminal)
cd frontend && npm run dev
```

## Troubleshooting

### Virtual Environment
If you get "source: no such file or directory: .venv/bin/activate", the virtual environment is already created. Just activate it:
```bash
cd backend
source .venv/bin/activate
```

### Database Connection
If you don't have PostgreSQL installed locally, you can use a remote database:
- **Supabase**: https://supabase.com (free tier)
- **Neon**: https://neon.tech (free tier)

Update `backend/.env` with your `DATABASE_URL`.

## All Set! 🚀

You're ready to start developing LifeVault!

