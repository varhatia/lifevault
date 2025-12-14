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
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || !process.env.AWS_ENDPOINT_URL;
const LOCAL_STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || join(process.cwd(), '.storage', 'encrypted-files');

// Initialize S3 client only if not using local storage
let s3Client: S3Client | null = null;

if (!USE_LOCAL_STORAGE && process.env.AWS_ENDPOINT_URL) {
  try {
    s3Client = new S3Client({
      endpoint: process.env.AWS_ENDPOINT_URL,
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      forcePathStyle: true, // Required for MinIO
    });
  } catch (error) {
    console.warn('Failed to initialize S3 client, using local storage fallback');
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
    throw new Error('S3 client not initialized');
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
  } catch (error: any) {
    // If S3 fails, fallback to local storage
    console.warn('S3 upload failed, using local storage fallback:', error.message);
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

