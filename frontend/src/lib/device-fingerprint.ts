/**
 * Device Fingerprinting Utility
 * Generates a unique device identifier based on browser/device characteristics
 * This is used for device binding security
 */

export interface DeviceFingerprint {
  fingerprint: string;
  deviceInfo: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
    timezone: string;
    cookieEnabled: boolean;
    localStorageEnabled: boolean;
    sessionStorageEnabled: boolean;
  };
}

/**
 * Generate a device fingerprint
 * Combines multiple browser/device characteristics to create a unique identifier
 */
export async function generateDeviceFingerprint(userAgent?: string): Promise<DeviceFingerprint> {
  if (typeof window === 'undefined') {
    // Server-side: use provided user agent or generate a basic fingerprint
    const ua = userAgent || 'unknown';
    const fingerprint = await hashString(ua);
    return {
      fingerprint,
      deviceInfo: {
        userAgent: ua,
        platform: 'unknown',
        language: 'unknown',
        screenResolution: 'unknown',
        timezone: 'unknown',
        cookieEnabled: false,
        localStorageEnabled: false,
        sessionStorageEnabled: false,
      },
    };
  }

  // Client-side: collect device characteristics
  const navigator = window.navigator;
  const screen = window.screen;
  
  const deviceInfo = {
    userAgent: navigator.userAgent || 'unknown',
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'unknown',
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    cookieEnabled: navigator.cookieEnabled || false,
    localStorageEnabled: (() => {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    })(),
    sessionStorageEnabled: (() => {
      try {
        sessionStorage.setItem('test', 'test');
        sessionStorage.removeItem('test');
        return true;
      } catch {
        return false;
      }
    })(),
  };

  // Create fingerprint string from device characteristics
  const fingerprintString = [
    deviceInfo.userAgent,
    deviceInfo.platform,
    deviceInfo.language,
    deviceInfo.screenResolution,
    deviceInfo.timezone,
    deviceInfo.cookieEnabled ? '1' : '0',
    deviceInfo.localStorageEnabled ? '1' : '0',
    deviceInfo.sessionStorageEnabled ? '1' : '0',
  ].join('|');

  // Hash the fingerprint string to create a consistent identifier
  const fingerprint = await hashString(fingerprintString);

  return {
    fingerprint,
    deviceInfo,
  };
}

/**
 * Hash a string using Web Crypto API (SHA-256)
 */
async function hashString(str: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side: use Node.js crypto
    const nodeCrypto = await import('crypto');
    return nodeCrypto.default.createHash('sha256').update(str).digest('hex');
  }

  // Client-side: use Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get a human-readable device name from user agent
 */
export function getDeviceName(userAgent: string): string {
  if (!userAgent) return 'Unknown Device';

  // Detect mobile devices
  if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    if (/iPhone/i.test(userAgent)) return 'iPhone';
    if (/iPad/i.test(userAgent)) return 'iPad';
    if (/Android/i.test(userAgent)) {
      const match = userAgent.match(/Android\s([\d.]+)/);
      return match ? `Android ${match[1]}` : 'Android Device';
    }
    return 'Mobile Device';
  }

  // Detect desktop browsers
  if (/Chrome/i.test(userAgent)) {
    const match = userAgent.match(/Chrome\/([\d.]+)/);
    return match ? `Chrome ${match[1].split('.')[0]}` : 'Chrome';
  }
  if (/Firefox/i.test(userAgent)) {
    const match = userAgent.match(/Firefox\/([\d.]+)/);
    return match ? `Firefox ${match[1].split('.')[0]}` : 'Firefox';
  }
  if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
    const match = userAgent.match(/Version\/([\d.]+)/);
    return match ? `Safari ${match[1].split('.')[0]}` : 'Safari';
  }
  if (/Edge/i.test(userAgent)) {
    const match = userAgent.match(/Edge\/([\d.]+)/);
    return match ? `Edge ${match[1].split('.')[0]}` : 'Edge';
  }

  // Detect OS
  if (/Windows/i.test(userAgent)) return 'Windows';
  if (/Mac/i.test(userAgent)) return 'macOS';
  if (/Linux/i.test(userAgent)) return 'Linux';

  return 'Unknown Device';
}

