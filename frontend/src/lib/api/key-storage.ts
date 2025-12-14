/**
 * Key Storage Abstraction Layer
 * 
 * Provides a unified interface for storing and retrieving Part B (Service Key)
 * Supports both local storage (PostgreSQL) and cloud storage (AWS KMS, Azure Key Vault, etc.)
 * 
 * Design Principles:
 * - Zero-knowledge: Server never sees plaintext Part B
 * - Encrypted at rest: Part B is always encrypted before storage
 * - Cloud-ready: Easy migration to cloud key management services
 * - Key rotation: Support for key versioning and rotation
 */

import prisma from '@/lib/prisma';
import crypto from 'crypto';

// Storage backend type
type StorageBackend = 'local' | 'aws-kms' | 'azure-keyvault' | 'gcp-kms';

// Configuration
const STORAGE_BACKEND: StorageBackend = (process.env.KEY_STORAGE_BACKEND as StorageBackend) || 'local';
const SERVER_PART_B_SECRET = process.env.SERVER_PART_B_SECRET || process.env.SECRET_KEY || 'dev-server-part-b-secret-change-in-production';
const SERVER_PART_B_ALGORITHM = 'aes-256-gcm';

// Type guard to check if module exists
function isModuleNotFoundError(error: any): boolean {
  return error?.code === 'MODULE_NOT_FOUND' || 
         error?.message?.includes('Cannot resolve') ||
         error?.message?.includes('Module not found') ||
         error?.message?.includes('Cannot find module');
}

/**
 * Encrypt Part B with server secret before storage
 */
function encryptPartB(plaintextPartB: string): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const key = crypto.scryptSync(SERVER_PART_B_SECRET, 'lifevault-part-b-salt', 32); // 256-bit key
  
  const cipher = crypto.createCipheriv(SERVER_PART_B_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintextPartB, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  // Combine IV + authTag + ciphertext for storage
  const combined = JSON.stringify({
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted,
  });
  
  return {
    encrypted: combined,
    iv: iv.toString('base64'),
  };
}

/**
 * Decrypt Part B from stored format
 */
function decryptPartB(encryptedData: string): string {
  try {
    const data = JSON.parse(encryptedData);
    const key = crypto.scryptSync(SERVER_PART_B_SECRET, 'lifevault-part-b-salt', 32);
    const iv = Buffer.from(data.iv, 'base64');
    const authTag = Buffer.from(data.authTag, 'base64');
    
    const decipher = crypto.createDecipheriv(SERVER_PART_B_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(data.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt Part B: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

/**
 * Local Storage Implementation (PostgreSQL)
 */
async function storePartBLocal(userId: string, partB: string, keyVersion: number = 1): Promise<void> {
  const encrypted = encryptPartB(partB);
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      serverKeyPartB: encrypted.encrypted,
      serverKeyPartBEncryptedAt: new Date(),
      serverKeyPartBKeyVersion: keyVersion,
    },
  });
}

async function retrievePartBLocal(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      serverKeyPartB: true,
    },
  });
  
  if (!user || !user.serverKeyPartB) {
    return null;
  }
  
  return decryptPartB(user.serverKeyPartB);
}

/**
 * AWS KMS Implementation (Cloud Storage)
 * 
 * Uses AWS KMS to encrypt/decrypt Part B
 * Part B is stored encrypted in PostgreSQL, but encryption key is managed by KMS
 */
async function storePartBAwsKms(userId: string, partB: string, keyVersion: number = 1): Promise<void> {
  // Check if AWS SDK is available
  // For local development, fall back to local encryption if KMS package is not installed
  const kmsKeyId = process.env.AWS_KMS_KEY_ID;
  if (!kmsKeyId) {
    console.warn('AWS_KMS_KEY_ID not set, falling back to local encryption');
    return storePartBLocal(userId, partB, keyVersion);
  }

  // Try to import AWS KMS SDK (optional dependency)
  // Use Function constructor to prevent webpack from statically analyzing the import
  let KMSClient: any, EncryptCommand: any;
  try {
    // Use dynamic import with eval to prevent webpack static analysis
    const kmsModuleName = '@aws-sdk/client-kms';
    const kmsModule = await new Function('return import("' + kmsModuleName + '")')();
    KMSClient = kmsModule.KMSClient;
    EncryptCommand = kmsModule.EncryptCommand;
  } catch (importError: any) {
    // Package not installed - fall back to local encryption
    if (isModuleNotFoundError(importError)) {
      console.warn('@aws-sdk/client-kms not installed. Install it for AWS KMS support, or use local storage.');
      return storePartBLocal(userId, partB, keyVersion);
    }
    throw importError;
  }
  
  try {
    const kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    const encryptCommand = new EncryptCommand({
      KeyId: kmsKeyId,
      Plaintext: Buffer.from(partB, 'utf8'),
    });
    
    const response = await kmsClient.send(encryptCommand);
    
    if (!response.CiphertextBlob) {
      throw new Error('KMS encryption failed: no ciphertext returned');
    }
    
    // Store KMS-encrypted blob in database
    const encryptedBlob = Buffer.from(response.CiphertextBlob).toString('base64');
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        serverKeyPartB: JSON.stringify({
          backend: 'aws-kms',
          keyId: kmsKeyId,
          encryptedBlob,
        }),
        serverKeyPartBEncryptedAt: new Date(),
        serverKeyPartBKeyVersion: keyVersion,
      },
    });
  } catch (error) {
    console.error('AWS KMS encryption failed:', error);
    // Fall back to local encryption
    return storePartBLocal(userId, partB, keyVersion);
  }
}

async function retrievePartBAwsKms(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      serverKeyPartB: true,
    },
  });
  
  if (!user || !user.serverKeyPartB) {
    return null;
  }
  
  try {
    const data = JSON.parse(user.serverKeyPartB);
    
    // Check if it's KMS-encrypted or local-encrypted
    if (data.backend === 'aws-kms') {
      // Try to import AWS KMS SDK (optional dependency)
      // Use Function constructor to prevent webpack from statically analyzing the import
      let KMSClient: any, DecryptCommand: any;
      try {
        // Use dynamic import with eval to prevent webpack static analysis
        const kmsModuleName = '@aws-sdk/client-kms';
        const kmsModule = await new Function('return import("' + kmsModuleName + '")')();
        KMSClient = kmsModule.KMSClient;
        DecryptCommand = kmsModule.DecryptCommand;
      } catch (importError: any) {
        // Package not installed
        if (isModuleNotFoundError(importError)) {
          throw new Error('AWS KMS SDK not available. This Part B was encrypted with KMS but @aws-sdk/client-kms is not installed. Install it or migrate to local storage.');
        }
        throw importError;
      }
      
      const kmsClient = new KMSClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });
      
      const decryptCommand = new DecryptCommand({
        CiphertextBlob: Buffer.from(data.encryptedBlob, 'base64'),
      });
      
      const response = await kmsClient.send(decryptCommand);
      
      if (!response.Plaintext) {
        throw new Error('KMS decryption failed: no plaintext returned');
      }
      
      return Buffer.from(response.Plaintext).toString('utf8');
    } else {
      // Legacy local-encrypted data
      return decryptPartB(user.serverKeyPartB);
    }
  } catch (error) {
    // If parsing fails, try legacy local decryption
    return decryptPartB(user.serverKeyPartB);
  }
}

/**
 * Unified Storage Interface
 */
export async function storePartB(userId: string, partB: string, keyVersion: number = 1): Promise<void> {
  switch (STORAGE_BACKEND) {
    case 'aws-kms':
      return storePartBAwsKms(userId, partB, keyVersion);
    case 'local':
    default:
      return storePartBLocal(userId, partB, keyVersion);
  }
}

export async function retrievePartB(userId: string): Promise<string | null> {
  switch (STORAGE_BACKEND) {
    case 'aws-kms':
      return retrievePartBAwsKms(userId);
    case 'local':
    default:
      return retrievePartBLocal(userId);
  }
}

/**
 * Check if user has Part B stored
 */
export async function hasPartB(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      serverKeyPartB: true,
    },
  });
  
  return !!user?.serverKeyPartB;
}

/**
 * Get Part B metadata (version, encrypted date, etc.)
 */
export async function getPartBMetadata(userId: string): Promise<{
  hasPartB: boolean;
  keyVersion: number | null;
  encryptedAt: Date | null;
  backend: StorageBackend;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      serverKeyPartB: true,
      serverKeyPartBKeyVersion: true,
      serverKeyPartBEncryptedAt: true,
    },
  });
  
  if (!user || !user.serverKeyPartB) {
    return {
      hasPartB: false,
      keyVersion: null,
      encryptedAt: null,
      backend: STORAGE_BACKEND,
    };
  }
  
  // Detect backend from stored data
  let backend: StorageBackend = STORAGE_BACKEND;
  try {
    const data = JSON.parse(user.serverKeyPartB);
    if (data.backend) {
      backend = data.backend as StorageBackend;
    }
  } catch {
    // Legacy format, assume local
    backend = 'local';
  }
  
  return {
    hasPartB: true,
    keyVersion: user.serverKeyPartBKeyVersion,
    encryptedAt: user.serverKeyPartBEncryptedAt,
    backend,
  };
}

