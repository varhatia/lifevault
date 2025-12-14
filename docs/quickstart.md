# LifeVault Quick Start Guide

## 🚀 Fastest Way to Run LifeVault (Local Development)

### Prerequisites Check

```bash
# Check Node.js
node --version  # Should be 20+
npm --version

# Check Python
python3 --version  # Should be 3.11+

# Check PostgreSQL (or use remote database)
psql --version
```

### Step 1: Setup

```bash
# From project root - installs dependencies and creates .env files
./scripts/setup-local.sh

# Or use npm
npm run setup
```

### Step 2: Database Setup

```bash
# Create PostgreSQL database
createdb lifevault

# Or use a remote database (Supabase, Neon, etc.)
# Update backend/.env with your DATABASE_URL
```

### Step 3: Run Migrations

```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
alembic upgrade head
cd ..
```

### Step 4: Start the Application

**Option A: Use the dev script (both services in one terminal)**
```bash
./scripts/dev.sh
```

**Option B: Run separately (recommended for development)**

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

### Step 5: Access the Application

Once services are running, open your browser:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Step 6: Explore the UI

Navigate through the application:
- **Dashboard** (`/`) - Overview and quick links
- **My Vault** (`/my-vault`) - Personal encrypted vault
- **Family Vault** (`/family-vault`) - Shared family vaults
- **Nominee** (`/nominee`) - Nominee configuration
- **Admin** (`/admin`) - Profile and security settings

## 🔧 Common Commands

### Using npm scripts (from root)

```bash
npm run setup          # Initial setup
npm run dev            # Start both services
npm run start:frontend # Start frontend only
npm run start:backend  # Start backend only
npm run migrate        # Run database migrations
```

### Database Migrations

```bash
cd backend
source .venv/bin/activate
alembic upgrade head    # Apply migrations
alembic revision --autogenerate -m "Description"  # Create new migration
```

### Stop Services

Press `Ctrl+C` in the terminal(s) running the services.

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :5432  # PostgreSQL

# Kill process (replace PID)
kill -9 <PID>
```

### Database Connection Issues

1. **Check PostgreSQL is running**:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. **Verify database exists**:
   ```bash
   psql -l | grep lifevault
   ```

3. **Test connection**:
   ```bash
   psql -d lifevault -U lifevault
   ```

### Python Virtual Environment Issues

```bash
cd backend
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### Frontend Build Issues

```bash
cd frontend
rm -rf node_modules .next
npm install
npm run dev
```

## 📝 Next Steps

1. **Read Local Development Guide**: See [local-development.md](local-development.md) for detailed instructions
2. **Review the Architecture**: See [architecture.md](architecture.md)
3. **Explore the API**: Visit http://localhost:8000/docs
4. **Read the Full README**: See [../README.md](../README.md)

## 💡 Development Tips

### Hot Reload

Both frontend and backend support hot reload:
- Frontend: Changes to `frontend/src/` will auto-reload
- Backend: Changes to `backend/app/` will auto-reload (with `--reload` flag)

### Using Remote Database

If you don't want to install PostgreSQL locally:
- **Supabase**: https://supabase.com (free tier)
- **Neon**: https://neon.tech (free tier)
- Update `backend/.env` with your `DATABASE_URL`

### Testing API Endpoints

Use the Swagger UI at http://localhost:8000/docs or use curl:

```bash
# Health check
curl http://localhost:8000/health/

# Get vault items (requires auth)
curl -H "Authorization: Bearer <token>" http://localhost:8000/vaults/my
```

