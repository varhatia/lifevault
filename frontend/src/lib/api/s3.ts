/**
 * S3 Service for LifeVault (Server-side only)
 * Handles encrypted file storage with zero-knowledge architecture
 * Server never sees plaintext - only encrypted blobs
 * 
 * Falls back to local file storage if S3 is not available (development)
 * 
 * NOTE: This file should ONLY be imported in API routes (server-side)
 * Never import this in client components
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { join } from 'path';
import { mkdir } from 'fs/promises';

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'lifevault-vaults';
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_S3_REGION || 'us-east-1';
const AWS_ENDPOINT_URL = process.env.AWS_ENDPOINT_URL;
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true';
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || join(process.cwd(), '.storage', 'encrypted-files');

// Determine if we should use S3
// Use S3 if:
// 1. Not explicitly using local storage, AND
// 2. We have AWS credentials, AND
// 3. Either AWS_ENDPOINT_URL is set (MinIO/custom) OR we're in production (use AWS S3)
const HAS_AWS_CREDENTIALS = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
const SHOULD_USE_S3 = !USE_LOCAL_STORAGE && HAS_AWS_CREDENTIALS && (AWS_ENDPOINT_URL || IS_PRODUCTION);

// Initialize S3 client
let s3Client: S3Client | null = null;

if (SHOULD_USE_S3) {
  try {
    const s3Config: any = {
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    };

    // Only set endpoint if explicitly provided (for MinIO or custom S3-compatible services)
    // AWS S3 doesn't need an endpoint - it uses the region to determine the endpoint
    if (AWS_ENDPOINT_URL) {
      s3Config.endpoint = AWS_ENDPOINT_URL;
      s3Config.forcePathStyle = true; // Required for MinIO and some S3-compatible services
      
      // Warn if using localhost in production
      if (AWS_ENDPOINT_URL.includes('localhost') || AWS_ENDPOINT_URL.includes('127.0.0.1')) {
        console.warn('[S3] WARNING: AWS_ENDPOINT_URL points to localhost. This will not work in production!');
        console.warn('[S3] For AWS S3, remove AWS_ENDPOINT_URL or set it to your AWS S3 endpoint.');
      }
    }

    s3Client = new S3Client(s3Config);
    console.log(`[S3] Initialized S3 client: ${AWS_ENDPOINT_URL ? `Custom endpoint: ${AWS_ENDPOINT_URL}` : `AWS S3 (region: ${AWS_REGION})`}`);
  } catch (error) {
    console.error('[S3] Failed to initialize S3 client:', error);
    console.warn('[S3] Falling back to local storage');
  }
} else {
  if (!HAS_AWS_CREDENTIALS) {
    console.warn('[S3] AWS credentials not found. Using local storage fallback.');
  } else if (USE_LOCAL_STORAGE) {
    console.log('[S3] USE_LOCAL_STORAGE=true. Using local file storage.');
  }
}

// Ensure local storage directory exists
(async () => {
  try {
    await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
  } catch {
    // Directory might already exist
  }
})();

/**
 * Upload encrypted file to S3 (or local storage fallback)
 * @param encryptedBlob - Base64 encoded encrypted file data
 * @param s3Key - Unique S3 key (e.g., userId/itemId/filename)
 * @returns S3 key
 */
export async function uploadEncryptedFile(
  encryptedBlob: string,
  s3Key: string
): Promise<string> {
  // Convert base64 to buffer
  const buffer = Buffer.from(encryptedBlob, 'base64');
  
  if (USE_LOCAL_STORAGE) {
    // Fallback to local file storage (development)
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    await fs.writeFile(filePath, buffer);
    return s3Key;
  }
  
  // Use S3
  if (!s3Client) {
    // S3 client not initialized, fallback to local storage
    console.warn('[S3] S3 client not initialized, using local storage fallback');
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
    await fs.writeFile(filePath, buffer);
    return s3Key;
  }
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: 'application/octet-stream', // Encrypted data
    ServerSideEncryption: 'AES256', // Additional S3 encryption (belt and suspenders)
  });
  
  try {
    await s3Client.send(command);
    console.log(`[S3] Successfully uploaded: ${s3Key}`);
  } catch (error: any) {
    // If S3 fails, fallback to local storage
    console.error('[S3] Upload failed:', {
      error: error.message,
      code: error.code,
      endpoint: AWS_ENDPOINT_URL || 'AWS S3 (default)',
      region: AWS_REGION,
      bucket: BUCKET_NAME,
      key: s3Key,
    });
    console.warn('[S3] Falling back to local storage');
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    await mkdir(LOCAL_STORAGE_DIR, { recursive: true });
    await fs.writeFile(filePath, buffer);
  }
  
  return s3Key;
}

/**
 * Download encrypted file from S3 (or local storage fallback)
 * @param s3Key - S3 key
 * @returns Encrypted blob as base64 string
 */
export async function downloadEncryptedFile(s3Key: string): Promise<string> {
  if (USE_LOCAL_STORAGE) {
    // Fallback to local file storage (development)
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    try {
      const buffer = await fs.readFile(filePath);
      return buffer.toString('base64');
    } catch (error) {
      throw new Error('File not found in local storage');
    }
  }
  
  // Use S3
  if (!s3Client) {
    throw new Error('S3 client not initialized');
  }
  
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });
  
  try {
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found in S3');
    }
    
    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    
    const buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
    return buffer.toString('base64');
  } catch (error: any) {
    // If S3 fails, try local storage fallback
    console.warn('S3 download failed, trying local storage:', error.message);
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    try {
      const buffer = await fs.readFile(filePath);
      return buffer.toString('base64');
    } catch {
      throw new Error('File not found');
    }
  }
}

/**
 * Delete encrypted file from S3 (or local storage fallback)
 * @param s3Key - S3 key
 */
export async function deleteEncryptedFile(s3Key: string): Promise<void> {
  if (USE_LOCAL_STORAGE) {
    // Fallback to local file storage (development)
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist, that's okay
    }
    return;
  }
  
  // Use S3
  if (!s3Client) {
    return; // Local storage already handled
  }
  
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
  });
  
  try {
    await s3Client.send(command);
  } catch (error: any) {
    // If S3 fails, try local storage fallback
    console.warn('S3 delete failed, trying local storage:', error.message);
    const filePath = join(LOCAL_STORAGE_DIR, s3Key.replace(/\//g, '_'));
    try {
      await fs.unlink(filePath);
    } catch {
      // File might not exist, that's okay
    }
  }
}

/**
 * Generate unique S3 key for a vault item
 * Format: userId/itemId/encrypted-file
 */
export function generateS3Key(
  ownerId: string,
  itemId: string,
  filename: string = 'encrypted-file',
  type: 'user' | 'family' = 'user'
): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${type}/${ownerId}/${itemId}/${sanitizedFilename}`;
}

