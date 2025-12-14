# LifeVault – Secure Family Finance & Legacy Management

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Zero-Knowledge](https://img.shields.io/badge/Zero--Knowledge-Architecture-red?style=flat-square&logo=lock)](https://github.com/varhatia/lifevault)
[![MVP](https://img.shields.io/badge/Status-MVP-yellow?style=flat-square)](https://github.com/varhatia/lifevault)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

> **MVP v1.0** – A full-stack encrypted vault application for securely storing and sharing critical financial and legal information with family members and nominees.

## 🎯 Overview

LifeVault helps families securely store critical financial and legal information, share it with partners/family, and enable controlled nominee access using strong encryption. The application implements a zero-knowledge architecture where the service provider cannot decrypt vault data.

### Key Features

- **My Vault** – Private encrypted vault for personal documents
- **Family Vault** – Shared family vault with fine-grained permissions
- **Nominee Access** – Posthumous access using split-key model (2-of-3 Shamir Secret Sharing)
- **Automated Reminders** – Monthly reviews, password rotation, key rotation
- **Zero-Knowledge Encryption** – Client-side AES-256 encryption with split keys

## 🏗️ Architecture

### Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python 3.11
- **Database**: PostgreSQL 16
- **Storage**: MinIO (S3-compatible) for encrypted document storage
- **Encryption**: AES-256-GCM (client-side) + Shamir Secret Sharing (2-of-3)

### Encryption Model

- **Client-side encryption**: All vault data encrypted before upload
- **Split-key model**: Master vault key split into 3 parts:
  - **Part A** → User (stored client-side)
  - **Part B** → Service provider (encrypted, sealed)
  - **Part C** → Nominee (sent via secure channel)
- **Zero-knowledge**: Company cannot decrypt vault without nominee's key

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.11+**
- **PostgreSQL 16+** (or use a remote database like Supabase/Neon)

### Option 1: Local Development (Recommended)

The easiest way to run LifeVault locally:

```bash
# 1. Run setup (installs dependencies, creates .env files)
./scripts/setup-local.sh

# 2. Create PostgreSQL database
createdb lifevault

# 3. Run database migrations
cd backend
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
alembic upgrade head
cd ..

# 4. Start the application
./scripts/dev.sh
```

Or run services separately:

**Terminal 1 - Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Service URLs:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

📖 **For detailed local development instructions, see [docs/local-development.md](docs/local-development.md)**

If you prefer Docker:

```bash
# Start all services with Docker
./scripts/start.sh

# Or manually:
cd infra
cp env.example .env
docker-compose up -d
```

**View logs:**
```bash
docker-compose -f infra/docker-compose.yml logs -f
```

**Stop services:**
```bash
./scripts/stop.sh
```

## 📁 Project Structure

```
mIdentity/
├── frontend/              # Next.js 15 frontend application
│   ├── src/
│   │   ├── app/          # Next.js App Router pages
│   │   │   ├── my-vault/
│   │   │   ├── family-vault/
│   │   │   ├── nominee/
│   │   │   └── admin/
│   │   └── lib/          # Utilities (crypto, API client)
│   ├── Dockerfile
│   └── package.json
│
├── backend/              # FastAPI backend application
│   ├── app/
│   │   ├── routers/      # API route handlers
│   │   ├── models/       # SQLAlchemy models
│   │   ├── core/         # Core utilities (crypto, config)
│   │   └── db/           # Database session management
│   ├── alembic/          # Database migrations
│   ├── Dockerfile
│   └── pyproject.toml
│
├── infra/                # Infrastructure as code
│   ├── docker-compose.yml
│   └── env.example       # Environment variable template
│
├── scripts/              # Utility scripts
│   ├── start.sh         # Start all services
│   ├── stop.sh          # Stop all services
│   └── reset.sh         # Reset all data
│
└── docs/                 # Documentation
```

## 🔐 Security Features

### Zero-Knowledge Architecture
- All encryption/decryption happens client-side
- Server only stores encrypted blobs
- Master password never leaves the client

### Split-Key Model
- **2-of-3 Shamir Secret Sharing**: Requires 2 of 3 parts to reconstruct the master key
- **Nominee Access**: Nominee + Service provider can unlock vault (read-only)
- **Key Rotation**: Periodic rotation with automatic sync

### Password Security
- PBKDF2/Argon2 password hashing
- Device binding for password reset
- Mandatory password rotation every 90 days

## 📋 API Endpoints

### Health
- `GET /health/` – Service health check

### Vaults
- `GET /vaults/my` – Get user's personal vault items
- `POST /vaults/my` – Add item to personal vault
- `PUT /vaults/my/{item_id}` – Update vault item
- `DELETE /vaults/my/{item_id}` – Delete vault item

### Family Vault
- `GET /family/vaults` – List family vaults
- `POST /family/vaults` – Create family vault
- `POST /family/invite` – Invite family member
- `PUT /family/members/{member_id}/permissions` – Update permissions

### Nominee
- `GET /nominee/` – Get nominee configuration
- `POST /nominee/` – Set/update nominee
- `POST /nominee/unlock` – Initiate nominee unlock flow

### Reminders
- `GET /reminders/` – Get reminder status
- `POST /reminders/defer` – Defer reminder

Full API documentation available at http://localhost:8000/docs when backend is running.

## 🧪 Development

### Database Migrations

```bash
cd backend

# Create a new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1
```

### Running Tests

```bash
# Backend tests (when implemented)
cd backend
pytest

# Frontend tests (when implemented)
cd frontend
npm test
```

## 🔧 Configuration

### Environment Variables

Copy `infra/env.example` to `infra/.env` and customize:

```bash
# Database
POSTGRES_USER=lifevault
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=lifevault

# MinIO/S3
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=your-secure-password
AWS_S3_BUCKET=lifevault-vaults

# Security
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 📊 MVP Status

### ✅ Completed
- [x] Project structure and folder organization
- [x] Frontend UI pages (My Vault, Family Vault, Nominee, Admin)
- [x] Backend API stubs and routing
- [x] Database models (User, VaultItem, FamilyVault, Nominee)
- [x] Docker setup with docker-compose
- [x] Encryption utilities (client-side AES, Shamir stub)
- [x] Alembic migration setup

### 🚧 In Progress / TODO
- [ ] Authentication & authorization (JWT)
- [ ] Real S3/MinIO integration for document storage
- [ ] Complete encryption implementation (full Shamir Secret Sharing)
- [ ] Reminder cron jobs
- [ ] Frontend-backend API integration
- [ ] Nominee unlock workflow
- [ ] Key rotation automation
- [ ] Tests (unit, integration, e2e)

## 📚 Documentation

- [Frontend README](frontend/README.md) – Frontend setup and development
- [Backend README](backend/README.md) – Backend setup and API documentation
- [Architecture Docs](docs/architecture.md) – System architecture and design decisions
- [Nominee Key Delivery](docs/nominee-key-delivery.md) – How Part C is delivered to nominees (current MVP + future enhancements)

## 🤝 Contributing

This is an MVP project. Contributions welcome! Please ensure:
- Code follows existing patterns
- Security best practices are maintained
- Tests are added for new features

## 📄 License

[Your License Here]

## 🆘 Support

For issues or questions, please open an issue in the repository.

---

**Built with ❤️ for secure family legacy management**

