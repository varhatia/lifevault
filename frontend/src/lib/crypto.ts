// Client-side cryptography utilities for LifeVault.
// For MVP these are intentionally lightweight stubs around Web Crypto and
// Shamir Secret Sharing; you can flesh out the implementations later.

export type EncryptedPayload = {
  iv: string;
  ciphertext: string;
};

export async function encryptWithAes(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptWithAes(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const ivBuf = base64ToBuffer(payload.iv);
  const data = base64ToBuffer(payload.ciphertext);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(ivBuf) },
    key,
    toArrayBuffer(data)
  );
  return decoder.decode(plaintext);
}

/**
 * Encrypt a file (binary data) using AES-256-GCM
 * Returns encrypted blob as base64 string for transmission
 */
export async function encryptFile(
  file: File | Blob,
  key: CryptoKey
): Promise<{ encryptedBlob: string; iv: string; metadata: { name: string; type: string; size: number } }> {
  const arrayBuffer = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the file
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    arrayBuffer
  );
  
  // Store metadata separately (filename, type) - this is not sensitive
  const metadata = {
    name: file instanceof File ? file.name : 'encrypted-file',
    type: file.type || 'application/octet-stream',
    size: file.size,
  };
  
  return {
    encryptedBlob: bufferToBase64(new Uint8Array(ciphertext)),
    iv: bufferToBase64(iv),
    metadata,
  };
}

/**
 * Decrypt a file (binary data) from encrypted blob
 * Returns decrypted Blob
 */
export async function decryptFile(
  encryptedBlob: string,
  iv: string,
  key: CryptoKey
): Promise<Blob> {
  const ivBuf = base64ToBuffer(iv);
  const dataBuffer = base64ToBuffer(encryptedBlob);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(ivBuf) },
    key,
    toArrayBuffer(dataBuffer)
  );
  
  return new Blob([plaintext]);
}

/**
 * Encrypt text data (for notes, structured entries)
 */
export async function encryptTextData(
  data: Record<string, any>,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const jsonString = JSON.stringify(data);
  return encryptWithAes(jsonString, key);
}

/**
 * Decrypt text data (for notes, structured entries)
 */
export async function decryptTextData(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<Record<string, any>> {
  const jsonString = await decryptWithAes(payload, key);
  return JSON.parse(jsonString);
}

export async function deriveKeyFromPassword(
  password: string,
  extractable: boolean = false
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const material = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const salt = encoder.encode("lifevault-mvp-static-salt"); // replace with per-user salt
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 310_000,
      hash: "SHA-256"
    },
    material,
    { name: "AES-GCM", length: 256 },
    extractable, // Allow extraction when needed (e.g., for Shamir splitting)
    ["encrypt", "decrypt"]
  );
}

// --- Minimal Shamir-like interface (placeholders) ---

export type SecretShare = {
  id: number;
  value: string;
};

export function splitSecretTwoOfThree(secret: string): SecretShare[] {
  // TODO: plug in a proper Shamir Secret Sharing implementation.
  // For now, we just return 3 opaque "shares" that all contain the secret.
  return [
    { id: 1, value: secret },
    { id: 2, value: secret },
    { id: 3, value: secret }
  ];
}

export function combineTwoOfThree(shares: SecretShare[]): string {
  if (shares.length < 2) {
    throw new Error("At least two shares are required");
  }
  // In a real implementation, you would verify and interpolate shares.
  return shares[0].value;
}

// --- helpers ---

export async function importAesKeyFromHex(hex: string): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API is not available");
  }
  if (!hex || hex.length % 2 !== 0) {
    throw new Error("Invalid hex key");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return window.crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Generate a recovery key (random 32 bytes, base64 encoded)
 * This key can be used to decrypt the vault if master password is forgotten
 */
export function generateRecoveryKey(): string {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) {
    throw new Error("Web Crypto API is not available");
  }
  // Generate 32 random bytes (256 bits)
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  // Convert to base64 for easy storage/sharing
  return bufferToBase64(randomBytes);
}

/**
 * Import recovery key from base64 string
 */
export async function importRecoveryKey(recoveryKeyBase64: string): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("Web Crypto API is not available");
  }
  const bytes = base64ToBuffer(recoveryKeyBase64);
  // Create a new Uint8Array to ensure proper type
  const keyBytes = new Uint8Array(bytes);
  return window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt vault key with recovery key
 * Returns encrypted payload that can be stored on server
 */
export async function encryptVaultKeyWithRecoveryKey(
  vaultKeyHex: string,
  recoveryKey: CryptoKey
): Promise<EncryptedPayload> {
  return encryptWithAes(vaultKeyHex, recoveryKey);
}

/**
 * Decrypt vault key using recovery key
 * Returns vault key as hex string
 */
export async function decryptVaultKeyWithRecoveryKey(
  encryptedPayload: EncryptedPayload,
  recoveryKey: CryptoKey
): Promise<string> {
  return decryptWithAes(encryptedPayload, recoveryKey);
}

function bufferToBase64(buf: Uint8Array): string {
  if (typeof window === "undefined") return "";
  let binary = "";
  buf.forEach((b) => (binary += String.fromCharCode(b)));
  return window.btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  if (typeof window === "undefined") return new Uint8Array();
  
  if (!b64 || typeof b64 !== 'string') {
    throw new Error('Invalid base64 string: must be a non-empty string');
  }
  
  // Clean the base64 string: remove whitespace
  const cleaned = b64.trim().replace(/\s/g, '');
  
  // Validate base64 format
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('Invalid base64 string: contains invalid characters');
  }
  
  try {
    const binary = window.atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch (error) {
    throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Helper to convert Uint8Array to ArrayBuffer for crypto.subtle
function toArrayBuffer(uint8Array: Uint8Array): ArrayBuffer {
  if (uint8Array.byteOffset === 0 && uint8Array.byteLength === uint8Array.buffer.byteLength) {
    return uint8Array.buffer as ArrayBuffer;
  }
  return uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength) as ArrayBuffer;
}


