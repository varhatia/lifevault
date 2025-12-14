/**
 * Server-side cryptography helpers for LifeVault API routes.
 * 
 * The backend never sees raw vault contents; it only deals with:
 * - Encrypted vault blobs generated client-side (AES-256 in the browser)
 * - Encrypted server share (Part B) of the master key for nominee unlock flows
 * 
 * Uses Node.js native crypto module (matches Web Crypto API used in frontend)
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const SERVER_SHARE_SECRET = process.env.SERVER_SHARE_SECRET || 'lifevault-server-share-dev';
const JWT_ALG = 'HS256';

/**
 * Create an opaque, signed token that represents the server's Part B share
 * for a given master key identifier.
 */
export function generateServerShare(masterKeyId: string): string {
  return jwt.sign({ mkid: masterKeyId }, SERVER_SHARE_SECRET, { algorithm: JWT_ALG });
}

/**
 * Verify and extract the master key ID from a server share token.
 */
export function verifyAndLoadServerShare(token: string): { valid: boolean; masterKeyId?: string } {
  try {
    const payload = jwt.verify(token, SERVER_SHARE_SECRET, { algorithms: [JWT_ALG as jwt.Algorithm] }) as { mkid: string };
    return { valid: true, masterKeyId: payload.mkid };
  } catch (error) {
    return { valid: false };
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.compare(password, hash);
}

/**
 * Server-side version of deriveKeyFromPassword
 * Uses Node.js crypto.pbkdf2 to match client-side Web Crypto API PBKDF2
 */
export async function deriveKeyFromPasswordServer(password: string): Promise<Buffer> {
  const salt = Buffer.from('lifevault-mvp-static-salt', 'utf8'); // Must match client-side salt
  const iterations = 310_000; // Must match client-side iterations
  
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, 32, 'sha256', (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

/**
 * Server-side version of decryptWithAes
 * Decrypts AES-256-GCM encrypted data using Node.js crypto
 * 
 * Note: Web Crypto API's encrypt() with AES-GCM automatically appends the 16-byte auth tag
 * to the end of the ciphertext. Node.js requires the auth tag to be set separately.
 */
export function decryptWithAesServer(
  encryptedPayload: { iv: string; ciphertext: string },
  key: Buffer
): string {
  try {
    const iv = Buffer.from(encryptedPayload.iv, 'base64');
    const ciphertextWithTag = Buffer.from(encryptedPayload.ciphertext, 'base64');
    
    // Web Crypto API's AES-GCM encrypt() appends the 16-byte auth tag to the ciphertext
    // We need to extract it for Node.js crypto which requires it separately
    const authTagLength = 16;
    if (ciphertextWithTag.length < authTagLength) {
      throw new Error('Ciphertext too short to contain auth tag');
    }
    
    const actualCiphertext = ciphertextWithTag.slice(0, -authTagLength);
    const authTag = ciphertextWithTag.slice(-authTagLength);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(actualCiphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error details:', error);
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Server-side version of encryptTextData
 * Encrypts a JSON object using AES-256-GCM
 */
export function encryptTextDataServer(
  data: Record<string, any>,
  key: Buffer
): { iv: string; ciphertext: string } {
  try {
    const plaintext = JSON.stringify(data);
    const iv = crypto.randomBytes(12);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(plaintext, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    // Append auth tag to ciphertext (matching Web Crypto API behavior)
    const ciphertextWithTag = Buffer.concat([ciphertext, authTag]);
    
    return {
      iv: iv.toString('base64'),
      ciphertext: ciphertextWithTag.toString('base64'),
    };
  } catch (error) {
    console.error('Encryption error details:', error);
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Server-side version of decryptTextData
 * Decrypts a JSON object using AES-256-GCM
 */
export function decryptTextDataServer(
  encryptedPayload: { iv: string; ciphertext: string },
  key: Buffer
): Record<string, any> {
  try {
    const decrypted = decryptWithAesServer(encryptedPayload, key);
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decrypt text data error details:', error);
    throw new Error(`Decrypt text data failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

