# LifeVault Architecture

## System Overview

LifeVault is a zero-knowledge encrypted vault application that enables users to securely store and share critical financial and legal information with family members and nominees.

## High-Level Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser   │──────│   Next.js   │──────│   FastAPI   │
│  (Client)   │      │  Frontend   │      │   Backend   │
└─────────────┘      └─────────────┘      └─────────────┘
                            │                    │
                            │                    ├─── PostgreSQL
                            │                    │
                            │                    └─── MinIO (S3)
                            │
                     ┌──────┴──────┐
                     │   Client-    │
                     │   Side      │
                     │  Encryption │
                     └─────────────┘
```

## Encryption Model

### Zero-Knowledge Architecture

1. **Client-Side Encryption**: All vault data is encrypted using AES-256-GCM before upload
2. **Split-Key Model**: Master vault key is split using 2-of-3 Shamir Secret Sharing:
   - **Part A** → User (stored in browser/localStorage, encrypted with master password)
   - **Part B** → Service provider (encrypted and sealed, cannot decrypt alone)
   - **Part C** → Nominee (sent via secure channel, stored offline)

### Key Reconstruction

- **Normal Access**: User uses Part A + master password
- **Nominee Access**: Nominee provides Part C + Service provider's Part B (read-only)

## Data Flow

### Adding Vault Item

1. User enters data in frontend
2. Frontend encrypts data client-side using AES-256-GCM
3. Encrypted blob sent to backend
4. Backend stores encrypted blob in S3/MinIO
5. Metadata stored in PostgreSQL

### Nominee Unlock

1. Nominee initiates unlock (user inactive or manual trigger)
2. Nominee provides Part C key
3. Backend combines Part C with Part B
4. Vault unlocks in read-only mode
5. Nominee can view but not modify data

## Database Schema

### Core Tables

- **users**: User accounts and authentication
- **vault_items**: Encrypted vault items (references S3 objects)
- **family_vaults**: Shared family vaults
- **family_members**: Family vault membership and permissions
- **nominees**: Nominee configuration and Part C references

## Security Considerations

1. **Zero-Knowledge**: Server never sees plaintext data
2. **Password Hashing**: PBKDF2/Argon2 with salt
3. **Device Binding**: Password reset requires device verification
4. **Key Rotation**: Periodic rotation of encryption keys
5. **Access Control**: Fine-grained permissions for family vaults

## Reminder System

- **Monthly**: Review vault items (items >30 days old)
- **90 Days**: Mandatory password rotation
- **6 Months**: Encryption key rotation

Reminders are processed via cron jobs that check user activity and trigger notifications.

## Deployment

### Development
- Docker Compose with local PostgreSQL and MinIO
- Hot reload for both frontend and backend

### Production
- Frontend: Next.js standalone build in container
- Backend: FastAPI with uvicorn in container
- Database: Managed PostgreSQL (AWS RDS, etc.)
- Storage: AWS S3 or compatible service
- Load Balancer: Nginx or AWS ALB

## Future Enhancements

- [ ] End-to-end encryption for family vault sync
- [ ] Mobile app (React Native)
- [ ] Biometric authentication
- [ ] Multi-factor authentication
- [ ] Audit logging
- [ ] SOC2 compliance automation

