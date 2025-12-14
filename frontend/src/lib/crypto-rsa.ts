/**
 * RSA Key Pair Utilities for Family Vault SMK Encryption
 * 
 * Each family member has a public/private key pair:
 * - Public key: Stored on server, used to encrypt SMK for that member
 * - Private key: Stored client-side only, used to decrypt SMK
 * 
 * Security: Zero-knowledge - server never sees private keys or plaintext SMK
 */

/**
 * Generate RSA key pair for a family member
 * @returns {Promise<{ publicKey: string, privateKey: string }>}
 */
export async function generateRSAKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  // Generate RSA-OAEP key pair (2048-bit, recommended for production)
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]), // 65537
      hash: 'SHA-256',
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );

  // Export public key (PEM format)
  const publicKeyBuffer = await window.crypto.subtle.exportKey(
    'spki',
    keyPair.publicKey
  );
  const publicKeyPem = arrayBufferToPEM(publicKeyBuffer, 'PUBLIC KEY');

  // Export private key (PEM format)
  const privateKeyBuffer = await window.crypto.subtle.exportKey(
    'pkcs8',
    keyPair.privateKey
  );
  const privateKeyPem = arrayBufferToPEM(privateKeyBuffer, 'PRIVATE KEY');

  return {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
  };
}

/**
 * Import RSA public key from PEM string
 */
export async function importRSAPublicKey(
  pemString: string
): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const pemHeader = '-----BEGIN PUBLIC KEY-----';
  const pemFooter = '-----END PUBLIC KEY-----';
  const pemContents = pemString
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = base64ToArrayBuffer(pemContents);

  return window.crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
}

/**
 * Import RSA private key from PEM string
 */
export async function importRSAPrivateKey(
  pemString: string
): Promise<CryptoKey> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('Web Crypto API is not available');
  }

  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pemString
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '');
  const binaryDer = base64ToArrayBuffer(pemContents);

  return window.crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true, // extractable
    ['decrypt']
  );
}

/**
 * Encrypt data using RSA public key (for encrypting SMK)
 */
export async function encryptWithRSAPublicKey(
  data: string,
  publicKeyPem: string
): Promise<string> {
  const publicKey = await importRSAPublicKey(publicKeyPem);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // RSA-OAEP can encrypt up to ~190 bytes (for 2048-bit key)
  // For larger data, we'd need to use hybrid encryption (RSA + AES)
  // For SMK (256-bit = 32 bytes hex = 64 chars), RSA-OAEP is sufficient
  if (dataBuffer.length > 190) {
    throw new Error(
      'Data too large for RSA encryption. Use hybrid encryption (RSA + AES) instead.'
    );
  }

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    dataBuffer.buffer
  );

  return bufferToBase64(new Uint8Array(encrypted));
}

/**
 * Decrypt data using RSA private key (for decrypting SMK)
 */
export async function decryptWithRSAPrivateKey(
  encryptedData: string,
  privateKeyPem: string
): Promise<string> {
  if (!encryptedData || typeof encryptedData !== 'string' || encryptedData.trim() === '') {
    throw new Error('Invalid encrypted data: must be a non-empty base64 string');
  }
  
  if (!privateKeyPem || typeof privateKeyPem !== 'string' || privateKeyPem.trim() === '') {
    throw new Error('Invalid private key: must be a non-empty PEM string');
  }

  try {
    const privateKey = await importRSAPrivateKey(privateKeyPem);
    const encryptedBuffer = base64ToBuffer(encryptedData);

    // Validate buffer size (RSA-OAEP with 2048-bit key can decrypt up to 256 bytes)
    if (encryptedBuffer.byteLength > 256) {
      throw new Error(`Encrypted data too large (${encryptedBuffer.byteLength} bytes). Expected max 256 bytes for RSA-OAEP 2048-bit.`);
    }

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('Invalid base64')) {
        throw new Error(`Failed to decode encrypted data: ${error.message}`);
      }
      if (error.message.includes('Invalid private key')) {
        throw new Error(`Failed to import private key: ${error.message}`);
      }
      if (error.name === 'OperationError' || error.message.includes('decrypt')) {
        throw new Error(`RSA decryption failed. The private key may not match the public key used for encryption, or the encrypted data is corrupted. Original error: ${error.message}`);
      }
    }
    throw error;
  }
}

// Helper functions

function arrayBufferToPEM(buffer: ArrayBuffer, keyType: string): string {
  const base64 = bufferToBase64(new Uint8Array(buffer));
  const chunks = base64.match(/.{1,64}/g) || [];
  const pemKey = [
    `-----BEGIN ${keyType}-----`,
    ...chunks,
    `-----END ${keyType}-----`,
  ].join('\n');
  return pemKey;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Invalid base64 string: must be a non-empty string');
  }
  
  // Clean the base64 string: remove whitespace and padding issues
  const cleaned = base64.trim().replace(/\s/g, '');
  
  // Validate base64 format
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('Invalid base64 string: contains invalid characters');
  }
  
  try {
    const binaryString = atob(cleaned);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function bufferToBase64(buffer: Uint8Array): string {
  const binary = Array.from(buffer, (byte) => String.fromCharCode(byte)).join(
    ''
  );
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  if (!base64 || typeof base64 !== 'string') {
    throw new Error('Invalid base64 string: must be a non-empty string');
  }
  
  // Clean the base64 string: remove whitespace
  const cleaned = base64.trim().replace(/\s/g, '');
  
  // Validate base64 format
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error('Invalid base64 string: contains invalid characters');
  }
  
  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

