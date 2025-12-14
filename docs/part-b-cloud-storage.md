# Part B Cloud Storage Configuration

This document describes how to configure Part B (Service Key) storage for cloud environments.

## Storage Backends

### 1. Local Storage (Development/MVP) ✅

**Status:** Implemented

**Configuration:**
```env
KEY_STORAGE_BACKEND=local
SERVER_PART_B_SECRET=your-secure-server-secret
```

**How it works:**
- Part B is encrypted with `SERVER_PART_B_SECRET` using AES-256-GCM
- Encrypted Part B is stored in PostgreSQL (`users.server_key_part_b`)
- Suitable for development and small-scale deployments

**Security:**
- Part B is encrypted at rest
- Uses AES-256-GCM with 96-bit IV
- Key derivation using scrypt

### 2. AWS KMS (Production) ✅

**Status:** Implemented (ready for use)

**Configuration:**
```env
KEY_STORAGE_BACKEND=aws-kms
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

**How it works:**
- Part B is encrypted using AWS KMS
- KMS-encrypted blob is stored in PostgreSQL
- Decryption happens via KMS API calls
- Automatic fallback to local encryption if KMS fails

**Benefits:**
- Hardware Security Module (HSM) backed encryption
- Automatic key rotation support
- Audit logging via CloudTrail
- Compliance (SOC 2, HIPAA, etc.)

**Setup Steps:**
1. Create a KMS key in AWS Console
2. Grant IAM permissions to your application role
3. Set environment variables
4. Deploy application

**IAM Permissions Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kms:Encrypt",
        "kms:Decrypt",
        "kms:DescribeKey"
      ],
      "Resource": "arn:aws:kms:us-east-1:123456789012:key/your-key-id"
    }
  ]
}
```

### 3. Azure Key Vault (Future)

**Status:** Planned

**Configuration:**
```env
KEY_STORAGE_BACKEND=azure-keyvault
AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_TENANT_ID=your-tenant-id
```

**Implementation Notes:**
- Similar to AWS KMS
- Uses Azure Key Vault SDK
- Supports managed identities

### 4. Google Cloud KMS (Future)

**Status:** Planned

**Configuration:**
```env
KEY_STORAGE_BACKEND=gcp-kms
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-east1
GCP_KEY_RING=lifevault-keys
GCP_KEY_NAME=part-b-encryption
```

## Migration Guide

### From Local to AWS KMS

1. **Backup existing Part B data:**
   ```sql
   SELECT id, server_key_part_b FROM users WHERE server_key_part_b IS NOT NULL;
   ```

2. **Set up AWS KMS:**
   - Create KMS key
   - Configure IAM permissions
   - Set environment variables

3. **Migrate existing data:**
   - Write migration script to:
     - Read local-encrypted Part B
     - Decrypt using local secret
     - Re-encrypt using KMS
     - Update database

4. **Update configuration:**
   ```env
   KEY_STORAGE_BACKEND=aws-kms
   ```

5. **Test migration:**
   - Verify Part B can be retrieved
   - Test nominee unlock flow
   - Monitor for errors

### Key Rotation

When rotating keys:

1. **Generate new master key**
2. **Split into new Parts A, B, C**
3. **Store new Part B** (increment `serverKeyPartBKeyVersion`)
4. **User updates Part A** locally
5. **Regenerate and resend Part C** to all nominees

The system supports key versioning via `serverKeyPartBKeyVersion` field.

## Security Best Practices

### Local Storage

1. **Use strong secrets:**
   - `SERVER_PART_B_SECRET` should be at least 32 characters
   - Use cryptographically secure random generation
   - Store in environment variables, never in code

2. **Rotate secrets regularly:**
   - Rotate `SERVER_PART_B_SECRET` every 90 days
   - Re-encrypt all Part B values when rotating

3. **Limit access:**
   - Restrict database access
   - Use connection encryption (SSL/TLS)
   - Enable database audit logging

### Cloud Storage (AWS KMS)

1. **Use separate KMS keys per environment:**
   - Dev, Staging, Production should have different keys

2. **Enable key rotation:**
   - AWS KMS supports automatic key rotation
   - Enable in KMS console

3. **Use IAM roles:**
   - Prefer IAM roles over access keys
   - Use least privilege principle

4. **Enable CloudTrail:**
   - Monitor all KMS operations
   - Set up alerts for unauthorized access

## Cost Considerations

### Local Storage
- **Cost:** Free (uses existing database)
- **Scalability:** Limited by database performance

### AWS KMS
- **Cost:** ~$1/month per key + $0.03 per 10,000 requests
- **Scalability:** Highly scalable, no performance limits
- **Best for:** Production environments with high security requirements

## Monitoring

### Key Metrics to Monitor

1. **Encryption/Decryption failures:**
   - Track KMS API errors
   - Monitor fallback to local encryption

2. **Performance:**
   - KMS API latency
   - Database query performance

3. **Security:**
   - Unauthorized access attempts
   - Key rotation status
   - Audit log reviews

## Troubleshooting

### KMS Encryption Fails

**Symptoms:**
- Error: "KMS encryption failed"
- Fallback to local encryption logged

**Solutions:**
1. Check IAM permissions
2. Verify KMS key exists and is accessible
3. Check AWS credentials
4. Verify region configuration

### Part B Not Found

**Symptoms:**
- Error: "Server key Part B not found"

**Solutions:**
1. Verify user has Part B stored
2. Check database connection
3. Verify user ID is correct
4. Check if Part B was generated when adding nominee

## Future Enhancements

- [ ] Azure Key Vault support
- [ ] Google Cloud KMS support
- [ ] HashiCorp Vault support
- [ ] Multi-region key replication
- [ ] Key escrow for compliance
- [ ] Automated key rotation
- [ ] Key versioning and rollback


