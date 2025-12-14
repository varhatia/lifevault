# Local Development Guide (No Docker)

This guide shows you how to run LifeVault locally without Docker.

## Prerequisites

1. **Node.js 20+** and **npm**
   - Download from: https://nodejs.org
   - Verify: `node --version` and `npm --version`

2. **Python 3.11+**
   - Download from: https://www.python.org/downloads/
   - Verify: `python3 --version`

3. **PostgreSQL 16+** (or use a remote database)
   - macOS: `brew install postgresql@16`
   - Linux: `sudo apt-get install postgresql-16`
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Or use a cloud database (Supabase, Neon, etc.)

4. **(Optional) MinIO** for S3-compatible storage
   - Download from: https://min.io/download
   - Or use local file storage (backend handles this automatically)

## Quick Setup

### Option 1: Automated Setup Script

```bash
# Run the setup script
./scripts/setup-local.sh
```

This will:
- Install frontend dependencies
- Create Python virtual environment
- Install backend dependencies
- Create `.env` files

### Option 2: Manual Setup

#### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

#### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -e .
```

Create `backend/.env`:
```env
DATABASE_URL=postgresql+asyncpg://lifevault:lifevault_dev@localhost:5432/lifevault
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
JWT_ALGORITHM=HS256
CORS_ORIGINS=http://localhost:3000
```

## Database Setup

### Create PostgreSQL Database

```bash
# Create database
createdb lifevault

# Or using psql
psql -c "CREATE DATABASE lifevault;"

# Create user (if needed)
psql -c "CREATE USER lifevault WITH PASSWORD 'lifevault_dev';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE lifevault TO lifevault;"
```

### Run Migrations

```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Run migrations
alembic upgrade head
```

## Running the Application

### Option 1: Use the Dev Script (Both Services)

```bash
./scripts/dev.sh
```

This starts both frontend and backend in the same terminal.

### Option 2: Run Separately (Recommended for Development)

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Using Remote Database (Alternative)

If you don't want to install PostgreSQL locally, you can use a cloud database:

1. **Supabase** (Free tier available)
   - Sign up at https://supabase.com
   - Create a new project
   - Get the connection string from Settings > Database
   - Update `backend/.env`:
     ```env
     DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
     ```

2. **Neon** (Free tier available)
   - Sign up at https://neon.tech
   - Create a new project
   - Copy the connection string
   - Update `backend/.env`

3. **Any PostgreSQL Database**
   - Update `DATABASE_URL` in `backend/.env` with your connection string

## Storage Options

### Option 1: Local File Storage (Default)

The backend can use local file storage for development. No setup needed!

### Option 2: MinIO (S3-compatible)

1. Download MinIO: https://min.io/download
2. Start MinIO:
   ```bash
   minio server ~/minio-data --console-address ":9001"
   ```
3. Access MinIO Console: http://localhost:9001
   - Default credentials: `minioadmin` / `minioadmin123`
4. Create bucket: `lifevault-vaults`
5. Update `backend/.env`:
   ```env
   AWS_ACCESS_KEY_ID=minioadmin
   AWS_SECRET_ACCESS_KEY=minioadmin123
   AWS_ENDPOINT_URL=http://localhost:9000
   AWS_S3_BUCKET=lifevault-vaults
   ```

### Option 3: AWS S3

Update `backend/.env` with your AWS credentials:
```env
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=lifevault-vaults
```

## Development Workflow

### Hot Reload

Both services support hot reload:
- **Frontend**: Changes to `frontend/src/` auto-reload
- **Backend**: Changes to `backend/app/` auto-reload (with `--reload` flag)

### Database Migrations

```bash
cd backend
source .venv/bin/activate

# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Viewing Logs

- **Backend**: Logs appear in the terminal running uvicorn
- **Frontend**: Logs appear in the terminal running `npm run dev`
- **Browser Console**: Open DevTools (F12) for frontend logs

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Find process using port 8000
lsof -i :8000

# Kill process (replace PID)
kill -9 <PID>
```

### Database Connection Issues

1. Check PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   
   # Linux
   sudo systemctl status postgresql
   ```

2. Verify database exists:
   ```bash
   psql -l | grep lifevault
   ```

3. Test connection:
   ```bash
   psql -d lifevault -U lifevault
   ```

### Python Virtual Environment Issues

```bash
# Recreate virtual environment
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

## Environment Variables

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/lifevault

# Security
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
JWT_ALGORITHM=HS256

# CORS
CORS_ORIGINS=http://localhost:3000

# Storage (Optional)
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin123
AWS_ENDPOINT_URL=http://localhost:9000
AWS_S3_BUCKET=lifevault-vaults
```

## Next Steps

1. **Explore the UI**: Navigate to http://localhost:3000
2. **Test the API**: Visit http://localhost:8000/docs
3. **Read the Architecture**: See [architecture.md](architecture.md)
4. **Start Coding**: Make changes and see them hot-reload!

