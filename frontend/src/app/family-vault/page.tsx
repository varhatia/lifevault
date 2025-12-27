"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { Plus, Users, Lock, FileText, Settings, Trash2, Edit2, Eye, Download } from "lucide-react";
import CreateVaultModal from "./components/CreateVaultModal";
import MemberManagementModal from "./components/MemberManagementModal";
import AddItemModal from "@/components/vaults/AddItemModal";
import AddNomineeModal from "./components/AddNomineeModal";
import DeleteVaultModal from "@/components/vaults/DeleteVaultModal";
import FolderDetailView, { DOCUMENT_TEMPLATES } from "@/components/vaults/FolderDetailView";
import RecoveryKeyResetModal from "@/components/vaults/RecoveryKeyResetModal";
import { CategoryConfig, CategoryPriority } from "@/components/vaults/types";
import {
  generateRSAKeyPair,
  decryptWithRSAPrivateKey,
} from "@/lib/crypto-rsa";
import {
  deriveKeyFromPassword,
  encryptFile,
  decryptFile,
  decryptTextData,
  importAesKeyFromHex,
  importRecoveryKey,
  decryptVaultKeyWithRecoveryKey,
} from "@/lib/crypto";

type FamilyVault = {
  id: string;
  name: string;
  owner: {
    id: string;
    email: string;
    fullName: string | null;
  };
  members: Array<{
    id: string;
    role: string;
    acceptedAt: Date | null;
    user: {
      id: string;
      email: string;
      fullName: string | null;
    };
  }>;
  _count?: {
    items: number;
    members?: number;
    nominees?: number;
  };
};

type VaultItem = {
  id: string;
  category: string;
  title: string;
  tags: string[];
  s3Key: string | null;
  encryptedMetadata?: string | null; // Base64 encoded encrypted metadata
  iv: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type VaultSMK = {
  vaultId: string;
  smkHex: string; // Plaintext SMK (hex string)
  privateKey: string; // Member's RSA private key (PEM format)
};

// Category types are imported above

const CATEGORIES_CONFIG: CategoryConfig[] = [
  {
    id: "identity-vital",
    name: "Identity & Vital Records",
    priority: "must-have",
    microcopy: "Proof of identity, relationships, and legal standing. Birth certificates, Aadhaar, PAN, Passport, Marriage/Divorce certificates. Almost every claim, transfer, or legal process starts here.",
  },
  {
    id: "finance-investments",
    name: "Finance → Bank Accounts & Investments",
    priority: "must-have",
    microcopy: "Bank accounts, mutual funds, demat accounts, fixed deposits, PPF/EPF/NPS, bonds. Store access instructions, not plaintext passwords.",
  },
  {
    id: "insurance",
    name: "Insurance",
    priority: "must-have",
    microcopy: "Term life, health, vehicle, home, accidental/disability, employer-provided cover. Policy numbers, coverage amounts, premiums, nominees, claim process notes. During death, this folder is the single most valuable.",
  },
  {
    id: "loans-liabilities",
    name: "Loans & Liabilities",
    priority: "good-to-have",
    microcopy: "Home loans, personal loans, vehicle loans, credit cards, education loans. Total and outstanding amounts, EMI details, auto-debit accounts. Families often discover loans late → legal + credit issues.",
  },
  {
    id: "digital-assets",
    name: "Digital Assets & Online Presence",
    priority: "good-to-have",
    microcopy: "Email accounts, banking apps, investment platforms, social media, cloud storage. Document recovery methods and what to do: Close / Transfer / Memorialize. Avoid storing passwords directly.",
  },
  {
    id: "legal-estate",
    name: "Legal & Estate Planning",
    priority: "optional",
    microcopy: "Will (latest version + location of original), Power of Attorney, nomination summary, trust deeds, guardianship documents. This folder differentiates your app from 1Password-style vaults.",
  },
  {
    id: "emergency-access",
    name: "Emergency Access Setup",
    priority: "must-have",
    microcopy: "Choose someone you trust to access your vault if needed. Set access rules and permissions for emergency situations.",
  },
];

const CATEGORIES = CATEGORIES_CONFIG.map(c => c.id) as readonly string[];

const CATEGORY_MICROCOPY: Record<string, string> = CATEGORIES_CONFIG.reduce((acc, cat) => {
  acc[cat.id] = cat.microcopy;
  return acc;
}, {} as Record<string, string>);

const CATEGORY_PRIORITIES: Record<string, CategoryPriority> = CATEGORIES_CONFIG.reduce((acc, cat) => {
  acc[cat.id] = cat.priority;
  return acc;
}, {} as Record<string, CategoryPriority>);

// Helper type for priority
type CategoryPriorityType = "must-have" | "good-to-have" | "optional";

const CATEGORY_NAMES: Record<string, string> = CATEGORIES_CONFIG.reduce((acc, cat) => {
  acc[cat.id] = cat.name;
  return acc;
}, {} as Record<string, string>);

export default function FamilyVaultPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [vaults, setVaults] = useState<FamilyVault[]>([]);
  const [selectedVault, setSelectedVault] = useState<FamilyVault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [userRole, setUserRole] = useState<"admin" | "editor" | "viewer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNomineeModal, setShowNomineeModal] = useState(false);
  const [nominees, setNominees] = useState<any[]>([]);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [vaultToUnlock, setVaultToUnlock] = useState<FamilyVault | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [vaultSMKs, setVaultSMKs] = useState<Map<string, VaultSMK>>(new Map());
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showRecoveryResetModal, setShowRecoveryResetModal] = useState(false);
  const [recoveryResetVault, setRecoveryResetVault] = useState<{ id: string; name: string; smkHex: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState<FamilyVault | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(null);
  const [showFolderDetail, setShowFolderDetail] = useState(false);
  const [vaultNominees, setVaultNominees] = useState<Array<{
    id: string;
    nomineeName: string;
    nomineeEmail: string | null;
    nomineePhone: string | null;
    accessTriggerDays: number;
    isActive: boolean;
  }>>([]);

  // Handler for adding documents in folder detail view
  const handleAddDocument = async (
    documentType: string,
    fields: Record<string, any>,
    file: File | null,
    vaultKey: CryptoKey
  ): Promise<void> => {
    if (!selectedVault || !selectedCategory) return;
    
    // Check if file is required for this document type
    const templates = DOCUMENT_TEMPLATES[selectedCategory.id] || [];
    const template = templates.find(t => t.type === documentType);
    const fileField = template?.fields.find(f => f.type === "file");
    const isFileRequired = fileField?.required ?? false;
    
    if (isFileRequired && !file) {
      alert("Please select a file");
      return;
    }

    try {
      let encryptedBlob: string | null = null;
      let iv: string | null = null;
      let metadata: any = null;

      // Only encrypt file if provided
      if (file) {
        const encrypted = await encryptFile(file, vaultKey);
        encryptedBlob = encrypted.encryptedBlob;
        iv = encrypted.iv;
        metadata = encrypted.metadata;
      }

      // Create title from document type and fields
      const title = (fields.title as string) || documentType.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Document";

      // Encrypt metadata fields (excluding file-related and title) for zero-knowledge storage
      const metadataFields: Record<string, any> = {};
      Object.keys(fields).forEach(key => {
        if (key !== "title" && key !== "pdf" && key !== "file" && fields[key]) {
          metadataFields[key] = fields[key];
        }
      });
      
      // Include filename in encrypted metadata if file is uploaded (zero-knowledge)
      if (metadata && metadata.name) {
        metadataFields._fileName = metadata.name; // Store filename in encrypted metadata
      }
      
      // Encrypt metadata fields using vault key (zero-knowledge)
      const { encryptTextData } = await import("@/lib/crypto");
      const encryptedMetadata = Object.keys(metadataFields).length > 0 
        ? await encryptTextData(metadataFields, vaultKey)
        : null;

      // Upload to API
      const response = await fetch(`/api/family/vaults/${selectedVault.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: selectedCategory.id,
          title,
          tags: [documentType, ...Object.keys(fields).filter(k => fields[k])],
          encryptedBlob,
          iv,
          metadata: metadata ? { ...metadata, fields } : { fields },
          encryptedMetadata: encryptedMetadata ? JSON.stringify(encryptedMetadata) : null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload");
      }

      await loadVaultItems(selectedVault.id);
    } catch (error) {
      console.error("Error uploading document:", error);
      alert(error instanceof Error ? error.message : "Failed to upload document");
    }
  };

  const handleGetVaultKey = async (): Promise<CryptoKey | null> => {
    if (!selectedVault) return null;
    const smkData = vaultSMKs.get(selectedVault.id);
    if (!smkData) return null;

    // Convert SMK hex to CryptoKey
    const keyArray = new Uint8Array(
      smkData.smkHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    return await crypto.subtle.importKey(
      "raw",
      keyArray,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  };

  // Load vaults on mount
  useEffect(() => {
    loadVaults();
  }, []);

  // Load items when vault is selected
  useEffect(() => {
    if (selectedVault) {
      loadVaultItems(selectedVault.id);
    }
  }, [selectedVault]);

  const loadVaults = async () => {
    try {
      const res = await fetch("/api/family/vaults");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        throw new Error("Failed to load vaults");
      }
      const data = await res.json();
      setVaults(data.vaults || []);
    } catch (error) {
      console.error("Error loading vaults:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVaultItems = async (vaultId: string) => {
    try {
      const res = await fetch(`/api/family/vaults/${vaultId}/items`);
      if (!res.ok) throw new Error("Failed to load items");
      const data = await res.json();
      setItems(data.items || []);
      setUserRole(data.userRole);
      loadNominees(vaultId);
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const loadNominees = async (vaultId: string) => {
    try {
      const res = await fetch(`/api/nominee?vaultType=family_vault&vaultId=${vaultId}`);
      if (res.ok) {
        const data = await res.json();
        setNominees(data.nominees || []);
      }
    } catch (error) {
      console.error("Error loading nominees:", error);
    }
  };

  const handleCreateVault = async (name: string, masterPassword: string): Promise<{ vaultId: string; smkHex: string }> => {
    // Generate SMK (256-bit AES key as hex string)
    const smkArray = crypto.getRandomValues(new Uint8Array(32));
    const smkHex = Array.from(smkArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Generate RSA key pair for owner
    const { publicKey, privateKey } = await generateRSAKeyPair();

    // Encrypt SMK with owner's public key (client-side)
    const { encryptWithRSAPublicKey } = await import("@/lib/crypto-rsa");
    const encryptedSMK = await encryptWithRSAPublicKey(smkHex, publicKey);

    // Encrypt private key with master password (for server storage - cross-device support)
    const smkKey = await deriveKeyFromPassword(masterPassword);
    const { encryptTextData } = await import("@/lib/crypto");
    const encryptedPrivateKey = await encryptTextData(
      { privateKey },
      smkKey
    );

    // Create vault
    const res = await fetch("/api/family/vaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        sharedMasterKey: encryptedSMK, // Server stores encrypted SMK
        ownerPublicKey: publicKey,
        encryptedPrivateKey: JSON.stringify(encryptedPrivateKey), // Store encrypted private key on server
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Failed to create vault");
    }

    const data = await res.json();
    const newVault = data.vault;

    // Store vault-specific verifier (like MyVault)
    const verifierKey = `familyVaultVerifier_${newVault.id}`;
    const verifierPayload = await encryptTextData(
      { verifier: "lifevault-v1", vaultId: newVault.id },
      smkKey
    );
    localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));

    // Store SMK and private key locally (encrypted with master password) for faster access
    const encryptedSMKLocal = await encryptTextData(
      { smkHex, privateKey },
      smkKey
    );

    // Store in localStorage (keyed by vault ID) - vault-specific
    localStorage.setItem(
      `family_vault_${newVault.id}`,
      JSON.stringify(encryptedSMKLocal)
    );

    // Also store in memory for quick access
    setVaultSMKs((prev) => {
      const next = new Map(prev);
      next.set(newVault.id, { vaultId: newVault.id, smkHex, privateKey });
      return next;
    });

    setVaults((prev) => [newVault, ...prev]);
    setSelectedVault(newVault);
    
    // Return vault info for recovery key generation
    return { vaultId: newVault.id, smkHex };
  };

  const handleUnlockVault = async (vault: FamilyVault, masterPassword: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Derive key from master password (vault-specific)
      const smkKey = await deriveKeyFromPassword(masterPassword);

      // Check for vault-specific verifier (like MyVault)
      // Note: For Family Vault, the real password check is by decrypting private key from server
      // The verifier is just a convenience check - if it fails, we still try server decryption
      const verifierKey = `familyVaultVerifier_${vault.id}`;
      let verifierCheckPassed = false;
      const verifierRaw = localStorage.getItem(verifierKey);
      
      if (verifierRaw) {
        try {
          const payload = JSON.parse(verifierRaw);
          const { decryptTextData } = await import("@/lib/crypto");
          const data = await decryptTextData(payload, smkKey);
          if (data && data.verifier === "lifevault-v1" && data.vaultId === vault.id) {
            verifierCheckPassed = true;
          } else {
            // Verifier doesn't match - might be old password after reset
            // Clear it and rely on server decryption (which is the real check)
            console.warn("Verifier mismatch - clearing stale verifier:", { 
              hasData: !!data, 
              verifier: data?.verifier,
              expected: "lifevault-v1",
              vaultId: data?.vaultId,
              expectedVaultId: vault.id
            });
            localStorage.removeItem(verifierKey);
          }
        } catch (e) {
          // Verifier decryption failed - might be old password
          // Clear it and rely on server decryption
          console.warn("Verifier check failed - clearing stale verifier:", e);
          localStorage.removeItem(verifierKey);
        }
      }

      // Get current user email
      const userRes = await fetch("/api/auth/me");
      if (!userRes.ok) throw new Error("Failed to get user");
      const userData = await userRes.json();
      const currentUserEmail = userData.user?.email;
      const currentUserId = userData.user?.id;

      // Get member's encrypted SMK and encrypted private key from server
      const membersRes = await fetch(`/api/family/vaults/${vault.id}/members`);
      if (!membersRes.ok) throw new Error("Failed to load members");
      const membersData = await membersRes.json();
      const currentUserMember = membersData.members.find(
        (m: any) => m.user.email === currentUserEmail
      );

      if (!currentUserMember?.encryptedSharedMasterKey) {
        throw new Error("No encrypted SMK found for this member");
      }

      // Check if member has completed setup (has accepted invitation and set master password)
      if (!currentUserMember.acceptedAt) {
        throw new Error("You need to accept the invitation and set your master password first. Please check your email for the invitation link.");
      }

      // ALWAYS fetch from server first to get the latest encrypted private key
      // Server keys are the source of truth - they're updated when password is reset via recovery key
      // This ensures we use the latest password after recovery key reset
      let stored = localStorage.getItem(`family_vault_${vault.id}`);
      let privateKey: string | null = null;
      let storedSMKHex: string | null = null;
      let keysFromServer = false;

      // Try localStorage first (faster), but validate it works
      if (stored) {
        try {
          const encryptedData = JSON.parse(stored);
          const { decryptTextData } = await import("@/lib/crypto");
          const decryptedData = await decryptTextData(encryptedData, smkKey);
          privateKey = decryptedData.privateKey;
          storedSMKHex = decryptedData.smkHex;
        } catch (e) {
          // localStorage decryption failed - might be old password after reset
          // Clear it and fetch from server (which has the latest keys)
          console.warn("Failed to decrypt localStorage data (might be old password), fetching from server:", e);
          localStorage.removeItem(`family_vault_${vault.id}`);
          stored = null;
        }
      }

      // If not in localStorage or decryption failed, fetch encrypted private key from server
      // Server always has the latest keys (updated after recovery key reset)
      if (!privateKey && currentUserMember.encryptedPrivateKey) {
        try {
          const encryptedPrivateKeyData = JSON.parse(currentUserMember.encryptedPrivateKey);
          const { decryptTextData } = await import("@/lib/crypto");
          const decryptedPrivateKeyData = await decryptTextData(encryptedPrivateKeyData, smkKey);
          privateKey = decryptedPrivateKeyData.privateKey;

          if (!privateKey) {
            throw new Error("Failed to decrypt private key from server");
          }

          // Now decrypt SMK from server using the private key
          if (!currentUserMember.encryptedSharedMasterKey) {
            throw new Error("Encrypted SMK not found for this member");
          }
          const { decryptWithRSAPrivateKey } = await import("@/lib/crypto-rsa");
          const decryptedSMK = await decryptWithRSAPrivateKey(
            currentUserMember.encryptedSharedMasterKey,
            privateKey
          );
          
          // Validate decrypted SMK format
          if (!decryptedSMK || decryptedSMK.length !== 64 || !/^[0-9a-f]{64}$/i.test(decryptedSMK)) {
            throw new Error(`Decrypted SMK has invalid format. Expected 64 hex characters, got ${decryptedSMK?.length || 0} characters.`);
          }
          
          storedSMKHex = decryptedSMK;
          keysFromServer = true; // Mark that we got keys from server

          // Store in localStorage for faster access next time
          // This ensures localStorage is updated with latest keys after password reset
          const { encryptTextData } = await import("@/lib/crypto");
          const encryptedSMKLocal = await encryptTextData(
            { smkHex: storedSMKHex, privateKey },
            smkKey
          );
          localStorage.setItem(
            `family_vault_${vault.id}`,
            JSON.stringify(encryptedSMKLocal)
          );
        } catch (e) {
          console.error("Failed to decrypt private key from server:", e);
          throw new Error("Failed to decrypt vault key. Please ensure you're using the correct master password.");
        }
      }

      if (!privateKey) {
        throw new Error("Private key not found. Please contact the vault owner or use recovery key.");
      }

      // Validate SMK format
      if (!storedSMKHex || storedSMKHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(storedSMKHex)) {
        throw new Error("Invalid SMK format. The vault may need to be re-initialized.");
      }

      // If we got here, the password is correct (we successfully decrypted the private key)
      // Always update verifier with latest password (especially if we got keys from server after reset)
      // This ensures verifier matches the current password
      try {
        const { encryptTextData } = await import("@/lib/crypto");
        const verifierPayload = await encryptTextData(
          { verifier: "lifevault-v1", vaultId: vault.id },
          smkKey
        );
        localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));
      } catch (e) {
        console.error("Failed to create/update verifier:", e);
        // Don't throw - verifier is not critical for unlock
      }

      const smkHex = storedSMKHex;

      // Store in memory
      setVaultSMKs((prev) => {
        const next = new Map(prev);
        next.set(vault.id, { vaultId: vault.id, smkHex, privateKey });
        return next;
      });

      setSelectedVault(vault);
      setShowUnlockModal(false);
      setUnlockPassword("");
      setVaultToUnlock(null);
    } catch (error) {
      console.error("Error unlocking vault:", error);
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockWithRecoveryKey = async (vault: FamilyVault, recoveryKeyBase64: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Validate and trim recovery key
      const trimmedRecoveryKey = recoveryKeyBase64.trim();
      if (!trimmedRecoveryKey) {
        throw new Error("Recovery key is required");
      }

      // ALWAYS fetch from server first to get the latest recovery key encrypted SMK
      // Server keys are the source of truth - they're updated when recovery key is reset
      // The key format is: recoveryKeyEncryptedKey_family_vault_${vaultId}
      const recoveryKeyStorageKey = `recoveryKeyEncryptedKey_family_vault_${vault.id}`;
      let encryptedSMKStr: string | null = null;
      let keyFromServer = false;
      
      try {
        const serverRes = await fetch(`/api/family/vaults/${vault.id}/recovery-key/get`);
        if (serverRes.ok) {
          const serverData = await serverRes.json();
          const serverRecoveryKey = serverData.recoveryKeyEncryptedSMK;
          // Prioritize server keys - they're always the latest (especially after recovery key reset)
          if (serverRecoveryKey && typeof serverRecoveryKey === 'string') {
            encryptedSMKStr = serverRecoveryKey;
            keyFromServer = true;
          }
        }
      } catch (serverError) {
        console.error("Failed to fetch recovery key from server:", serverError);
        // Fall back to localStorage if server fetch fails (for backwards compatibility)
      }
      
      // If server didn't have recovery key, fall back to localStorage (for old vaults)
      if (!encryptedSMKStr) {
        encryptedSMKStr = localStorage.getItem(recoveryKeyStorageKey);
      }
      
      if (!encryptedSMKStr) {
        // List all localStorage keys for debugging
        const allKeys = Object.keys(localStorage).filter(key => 
          key.includes('recoveryKey') || key.includes('family_vault')
        );
        console.error("Recovery key not found. Vault ID:", vault.id, "Storage key:", recoveryKeyStorageKey);
        console.error("Available recovery-related keys:", allKeys);
        throw new Error("Recovery key not found for this vault. Please use your master password or contact support.");
      }

      // Parse encrypted payload
      let encryptedPayload;
      try {
        encryptedPayload = JSON.parse(encryptedSMKStr);
        if (!encryptedPayload.iv || !encryptedPayload.ciphertext) {
          throw new Error("Invalid encrypted payload format");
        }
      } catch (parseError) {
        console.error("Failed to parse encrypted SMK:", parseError);
        throw new Error("Invalid recovery key data format. The vault may need to be re-initialized.");
      }

      // Decrypt SMK client-side using recovery key
      let recoveryKeyCrypto: CryptoKey;
      try {
        recoveryKeyCrypto = await importRecoveryKey(trimmedRecoveryKey);
      } catch (importError) {
        console.error("Failed to import recovery key:", importError);
        throw new Error("Invalid recovery key format. Please check your recovery key and try again.");
      }

      let smkHex: string;
      try {
        smkHex = await decryptVaultKeyWithRecoveryKey(
          encryptedPayload,
          recoveryKeyCrypto
        );
        
        // Validate decrypted SMK format
        if (!smkHex || smkHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(smkHex)) {
          throw new Error(`Invalid SMK format after decryption. Expected 64 hex characters, got ${smkHex?.length || 0}.`);
        }
      } catch (decryptError) {
        // Decryption failed - might be old recovery key after reset
        // If we got it from localStorage, clear it and try server again
        if (!keyFromServer) {
          console.warn("Failed to decrypt with recovery key (might be old key), clearing localStorage and trying server:", decryptError);
          localStorage.removeItem(recoveryKeyStorageKey);
          
          // Try server one more time
          try {
            const serverRes = await fetch(`/api/family/vaults/${vault.id}/recovery-key/get`);
            if (serverRes.ok) {
              const serverData = await serverRes.json();
              const serverRecoveryKey = serverData.recoveryKeyEncryptedSMK;
              if (serverRecoveryKey && typeof serverRecoveryKey === 'string') {
                encryptedPayload = JSON.parse(serverRecoveryKey);
                smkHex = await decryptVaultKeyWithRecoveryKey(encryptedPayload, recoveryKeyCrypto);
                
                // Validate decrypted SMK format
                if (!smkHex || smkHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(smkHex)) {
                  throw new Error(`Invalid SMK format after decryption. Expected 64 hex characters, got ${smkHex?.length || 0}.`);
                }
                keyFromServer = true;
              } else {
                throw decryptError; // Re-throw original error
              }
            } else {
              throw decryptError; // Re-throw original error
            }
          } catch (retryError) {
            throw new Error("Invalid recovery key or recovery key encrypted SMK not found. Please verify your recovery key is correct.");
          }
        } else {
          // Already tried server, so the recovery key is wrong
          throw new Error("Invalid recovery key. Please verify your recovery key is correct.");
        }
      }

      // Sync recovery key encrypted SMK to localStorage if we got it from server
      if (typeof window !== "undefined" && keyFromServer && encryptedSMKStr) {
        localStorage.setItem(recoveryKeyStorageKey, encryptedSMKStr);
      }

      // Instead of directly unlocking, trigger recovery key reset workflow
      // This ensures security by forcing password reset after recovery key usage
      setRecoveryResetVault({
        id: vault.id,
        name: vault.name,
        smkHex: smkHex,
      });
      setShowRecoveryResetModal(true);
      setShowUnlockModal(false);
      setRecoveryKey("");
      setVaultToUnlock(null);
    } catch (error) {
      console.error("Error unlocking vault with recovery key:", error);
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock vault with recovery key");
    } finally {
      setUnlocking(false);
    }
  };

  const handleRecoveryResetSuccess = (newSMKHex: string) => {
    if (!recoveryResetVault) return;

    // Store SMK in memory (already in hex format)
    setVaultSMKs((prev) => {
      const next = new Map(prev);
      next.set(recoveryResetVault.id, {
        vaultId: recoveryResetVault.id,
        smkHex: newSMKHex,
        privateKey: "", // Will be re-encrypted when user unlocks with new password
      });
      return next;
    });

    // Select the vault
    const vault = vaults.find((v) => v.id === recoveryResetVault.id);
    if (vault) {
      setSelectedVault(vault);
    }

    // Close modals
    setShowRecoveryResetModal(false);
    setRecoveryResetVault(null);
  };

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!vaultToUnlock) return;
    
    if (useRecoveryKey) {
      if (!recoveryKey || !recoveryKey.trim()) {
        setUnlockError("Please enter your recovery key");
        return;
      }
      // Trim whitespace from recovery key
      await handleUnlockWithRecoveryKey(vaultToUnlock, recoveryKey.trim());
    } else {
      if (!unlockPassword) {
        setUnlockError("Please enter your master password");
        return;
      }
      await handleUnlockVault(vaultToUnlock, unlockPassword);
    }
  };

  const getVaultSMK = async (vaultId: string): Promise<CryptoKey | null> => {
    const smkData = vaultSMKs.get(vaultId);
    if (!smkData) return null;

    // Import SMK as CryptoKey
    return await importAesKeyFromHex(smkData.smkHex);
  };

  const handleDownloadItem = async (item: VaultItem) => {
    if (!selectedVault) return;
    
    // Check if document exists
    if (!item.s3Key) {
      alert("No document uploaded for this item.");
      return;
    }
    
    const smkData = vaultSMKs.get(selectedVault.id);
    if (!smkData) {
      alert("Vault is locked. Please unlock it first.");
      return;
    }

    try {
      // Download encrypted blob from server
      const response = await fetch(`/api/family/vaults/${selectedVault.id}/items/${item.id}/download`);
      if (!response.ok) {
        let message = "Failed to download";
        try {
          const err = await response.json();
          if (err?.error) message = err.error;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(`${message} (status ${response.status})`);
      }

      const data = await response.json();
      const { encryptedBlob, iv, metadata } = data;

      if (!iv) {
        throw new Error("IV not found - cannot decrypt");
      }

      // Get SMK as CryptoKey
      const smkKey = await importAesKeyFromHex(smkData.smkHex);

      // Decrypt file client-side (server never decrypts)
      // Zero-knowledge: decryption happens only on client, server never sees plaintext
      const decryptedBlob = await decryptFile(encryptedBlob, iv, smkKey);

      // Use metadata from API to preserve original filename and MIME type
      const downloadFilename = metadata?.filename || item.title;
      const mimeType = metadata?.type || 'application/octet-stream';
      
      // Create download link with proper MIME type
      const blob = new Blob([decryptedBlob], { type: mimeType });

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download file");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedVault) return;
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const res = await fetch(
        `/api/family/vaults/${selectedVault.id}/items/${itemId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete item");
      loadVaultItems(selectedVault.id);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    }
  };

  const handleDeleteVault = async () => {
    if (!vaultToDelete) return;

    try {
      const response = await fetch(`/api/family/vaults/${vaultToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete vault");
      }

      // Remove vault from memory
      setVaultSMKs((prev) => {
        const next = new Map(prev);
        next.delete(vaultToDelete.id);
        return next;
      });

      // If deleted vault was selected, clear selection
      if (selectedVault?.id === vaultToDelete.id) {
        setSelectedVault(null);
      }

      // Reload vaults
      await loadVaults();
      setShowDeleteModal(false);
      setVaultToDelete(null);
    } catch (error) {
      console.error("Error deleting vault:", error);
      throw error;
    }
  };

  const getCategoryCount = (categoryId: string) => {
    return items.filter((item) => item.category === categoryId).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-400">Loading vaults...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Family Vaults</h1>
          <p className="text-sm text-slate-400 mt-1">
            Shared encrypted vaults for family members
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Vault
        </button>
      </div>

      {vaults.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/70 rounded-xl border border-dashed border-slate-700">
          <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No Family Vaults Yet
          </h3>
          <p className="text-slate-500 mb-4">
            Create a shared vault to securely store documents with family members
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
          >
            Create Your First Vault
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vaults.map((vault) => {
            const currentUserId = user ? String(user.id) : null;
            const isAdmin = currentUserId && (
              vault.owner.id === currentUserId ||
              vault.members.some(m => m.user.id === currentUserId && m.role === 'admin')
            );
            return (
            <div
              key={vault.id}
                className={`p-4 rounded-xl border transition-colors ${
                  selectedVault?.id === vault.id
                    ? "border-brand-500 bg-slate-900/70"
                    : "border-slate-800 bg-slate-900/60 hover:border-brand-500/60"
                }`}
              >
                <div
                  className="cursor-pointer"
              onClick={() => {
                const smk = vaultSMKs.get(vault.id);
                if (smk) {
                  setSelectedVault(vault);
                } else {
                  // Show unlock modal instead of prompt
                  setVaultToUnlock(vault);
                  setShowUnlockModal(true);
                }
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-white">{vault.name}</h3>
                {vaultSMKs.has(vault.id) && (
                  <Lock className="w-4 h-4 text-green-500" />
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-400">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {vault.members.length} members
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {vault._count?.items || 0} items
                </div>
              </div>
            </div>
                {isAdmin && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setVaultToDelete(vault);
                        setShowDeleteModal(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete Vault
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedVault && (
        <div className="mt-8 rounded-xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">{selectedVault.name}</h2>
              <p className="text-sm text-slate-400 mt-1">
                Your role: <span className="capitalize">{userRole}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {userRole === "admin" && (
                <>
                  <button
                    onClick={() => setShowMemberModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                  >
                    <Users className="w-4 h-4" />
                    Members
                  </button>
                  <button
                    onClick={() => setShowNomineeModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
                  >
                    <Users className="w-4 h-4" />
                    Nominees
                  </button>
                </>
              )}
              {(userRole === "admin" || userRole === "editor") && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3 mb-6">
            {/* Categories organized by priority */}
            <div className="space-y-6">
              {/* Must Have Categories */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold text-red-400">Must Have</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {CATEGORIES_CONFIG.filter(c => c.priority === "must-have").map((category) => (
                    <VaultCategory
                      key={category.id}
                      title={category.name}
                      count={getCategoryCount(category.id)}
                      priority={category.priority}
                      microcopy={category.microcopy}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowFolderDetail(true);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Good to Have Categories */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-400">Good to Have</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {CATEGORIES_CONFIG.filter(c => c.priority === "good-to-have").map((category) => (
                    <VaultCategory
                      key={category.id}
                      title={category.name}
                      count={getCategoryCount(category.id)}
                      priority={category.priority}
                      microcopy={category.microcopy}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowFolderDetail(true);
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Optional Categories */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Optional / Advance</span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {CATEGORIES_CONFIG.filter(c => c.priority === "optional").map((category) => (
                    <VaultCategory
                      key={category.id}
                      title={category.name}
                      count={getCategoryCount(category.id)}
                      priority={category.priority}
                      microcopy={category.microcopy}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowFolderDetail(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No items in this vault yet
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Vault Items ({items.length})</h3>
              {items.map((item) => (
                <VaultItemCard
                  key={item.id}
                  item={item}
                  userRole={userRole}
                  onDownload={() => handleDownloadItem(item)}
                  onDelete={() => handleDeleteItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateVaultModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
          }}
          onSuccess={handleCreateVault}
        />
      )}

      {showMemberModal && selectedVault && (
        <MemberManagementModal
          isOpen={showMemberModal}
          onClose={() => setShowMemberModal(false)}
          vault={selectedVault}
          onUpdate={loadVaults}
          getSMKHex={async () => {
            // Get SMK from memory if available
            const smkData = vaultSMKs.get(selectedVault.id);
            if (smkData) {
              return smkData.smkHex;
            }

            // If not in memory, try to unlock the vault
            const masterPassword = prompt(
              "Enter your master password to unlock the vault and add a member:"
            );
            if (!masterPassword) {
              return null;
            }

            try {
              await handleUnlockVault(selectedVault, masterPassword);
              // After unlocking, SMK should be in memory
              const unlockedSMK = vaultSMKs.get(selectedVault.id);
              return unlockedSMK?.smkHex || null;
            } catch (error) {
              console.error("Error unlocking vault:", error);
              return null;
            }
          }}
        />
      )}

      {showUploadModal && selectedVault && (
        <AddItemModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          vaultId={selectedVault.id}
          vaultName={selectedVault.name}
          vaultType="family_vault"
          getSMK={async () => await getVaultSMK(selectedVault.id)}
          onSuccess={() => {
            if (selectedVault) loadVaultItems(selectedVault.id);
          }}
        />
      )}

      {showNomineeModal && selectedVault && userRole === "admin" && (
        <AddNomineeModal
          isOpen={showNomineeModal}
          onClose={() => setShowNomineeModal(false)}
          onSuccess={() => {
            // Just reload nominees, don't close modal (modal handles its own state)
            if (selectedVault) {
              loadNominees(selectedVault.id);
            }
          }}
          vaultId={selectedVault.id}
          vaultName={selectedVault.name}
          getSMKHex={async () => {
            // Get SMK from memory if available
            const smkData = vaultSMKs.get(selectedVault.id);
            if (smkData) {
              return smkData.smkHex;
            }

            // If not in memory, prompt for master password to unlock
            const masterPassword = prompt(
              `Enter your master password to unlock "${selectedVault.name}" and add a nominee:`
            );
            if (!masterPassword) {
              return null;
            }

            try {
              await handleUnlockVault(selectedVault, masterPassword);
              // After unlocking, SMK should be in memory
              const unlockedSMK = vaultSMKs.get(selectedVault.id);
              return unlockedSMK?.smkHex || null;
            } catch (error) {
              console.error("Error unlocking vault:", error);
              return null;
            }
          }}
        />
      )}

      {showUnlockModal && vaultToUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Unlock Family Vault</h2>
            <p className="text-sm text-slate-400 mb-4">
              {useRecoveryKey
                ? <>Enter your recovery key to unlock <strong>{vaultToUnlock.name}</strong></>
                : <>Enter your master password to unlock <strong>{vaultToUnlock.name}</strong></>}
            </p>
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryKey(false);
                    setUnlockPassword("");
                    setRecoveryKey("");
                    setUnlockError(null);
                  }}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    !useRecoveryKey
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Master Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryKey(true);
                    setUnlockPassword("");
                    setRecoveryKey("");
                    setUnlockError(null);
                  }}
                  className={`text-xs px-3 py-1 rounded-md transition-colors ${
                    useRecoveryKey
                      ? "bg-brand-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  Recovery Key
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {useRecoveryKey ? "Recovery Key" : "Master Password"}
                </label>
                {useRecoveryKey ? (
                  <textarea
                    value={recoveryKey}
                    onChange={(e) => {
                      setRecoveryKey(e.target.value);
                      setUnlockError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleUnlockSubmit();
                      }
                    }}
                    placeholder="Paste your recovery key here"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-brand-500 resize-none h-24"
                    autoFocus
                    disabled={unlocking}
                  />
                ) : (
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
                      setUnlockError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleUnlockSubmit();
                      }
                    }}
                    placeholder="Enter master password"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
                    autoFocus
                    disabled={unlocking}
                  />
                )}
              </div>
              {unlockError && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {unlockError}
                </div>
              )}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockPassword("");
                    setRecoveryKey("");
                    setUnlockError(null);
                    setVaultToUnlock(null);
                    setUseRecoveryKey(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  disabled={unlocking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlocking || (useRecoveryKey ? !recoveryKey : !unlockPassword)}
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {unlocking ? "Unlocking..." : "Unlock Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Recovery Key Reset Modal */}
      {recoveryResetVault && (
        <RecoveryKeyResetModal
          isOpen={showRecoveryResetModal}
          onClose={() => {
            setShowRecoveryResetModal(false);
            setRecoveryResetVault(null);
          }}
          vaultId={recoveryResetVault.id}
          vaultName={recoveryResetVault.name}
          vaultType="family_vault"
          currentKeyHex={recoveryResetVault.smkHex}
          onSuccess={handleRecoveryResetSuccess}
        />
      )}

      {/* Delete Vault Modal */}
      {vaultToDelete && (
        <DeleteVaultModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setVaultToDelete(null);
          }}
          vaultName={vaultToDelete.name}
          vaultId={vaultToDelete.id}
          vaultType="family_vault"
          itemsCount={vaultToDelete._count?.items || 0}
          membersCount={vaultToDelete._count?.members || 0}
          nomineesCount={vaultToDelete._count?.nominees || 0}
          onDelete={handleDeleteVault}
        />
      )}

      {/* Folder Detail View */}
      {selectedCategory && selectedVault && showFolderDetail && (
        <FolderDetailView
          isOpen={showFolderDetail}
          onClose={() => {
            setShowFolderDetail(false);
            setSelectedCategory(null);
          }}
          category={selectedCategory}
          vaultId={selectedVault.id}
          vaultType="family_vault"
          items={items.filter(i => i.category === selectedCategory.id)}
          onAddDocument={handleAddDocument as (documentType: string, fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>}
          getVaultKey={handleGetVaultKey}
          onEditDocument={async (itemId: string, documentType: string, fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => {
            if (!selectedVault) return;

            try {
              const updateData: any = {
                title: fields.title || documentType.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
                tags: [documentType, ...Object.keys(fields).filter(k => fields[k] && k !== "title")],
              };

              // Encrypt metadata fields (excluding file-related and title) for zero-knowledge storage
              const metadataFields: Record<string, any> = {};
              Object.keys(fields).forEach(key => {
                if (key !== "title" && key !== "pdf" && key !== "file" && fields[key]) {
                  metadataFields[key] = fields[key];
                }
              });

              // If file is provided, encrypt and include in update
              if (file) {
                const { encryptedBlob, iv, metadata } = await encryptFile(file, vaultKey);
                updateData.encryptedBlob = encryptedBlob;
                updateData.iv = iv;
                updateData.metadata = { ...metadata, fields };
                
                // Include filename in encrypted metadata (zero-knowledge)
                if (metadata && metadata.name) {
                  metadataFields._fileName = metadata.name;
                }
              }

              // Encrypt metadata fields using vault key (zero-knowledge)
              const { encryptTextData } = await import("@/lib/crypto");
              const encryptedMetadata = Object.keys(metadataFields).length > 0 
                ? await encryptTextData(metadataFields, vaultKey)
                : null;

              if (encryptedMetadata) {
                updateData.encryptedMetadata = JSON.stringify(encryptedMetadata);
              }

              const response = await fetch(`/api/family/vaults/${selectedVault.id}/items/${itemId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updateData),
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update");
              }

              await loadVaultItems(selectedVault.id);
            } catch (error) {
              console.error("Error updating document:", error);
              alert(error instanceof Error ? error.message : "Failed to update document");
              throw error;
            }
          }}
          onDeleteDocument={async (itemId: string) => {
            if (!selectedVault) return;

            try {
              const response = await fetch(`/api/family/vaults/${selectedVault.id}/items/${itemId}`, {
                method: "DELETE",
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to delete");
              }

              await loadVaultItems(selectedVault.id);
            } catch (error) {
              console.error("Error deleting document:", error);
              alert(error instanceof Error ? error.message : "Failed to delete document");
              throw error;
            }
          }}
          onDownloadDocument={async (itemId: string) => {
            if (!selectedVault) return;
            const item = items.find(i => i.id === itemId);
            if (item) {
              await handleDownloadItem(item);
            }
          }}
          onRefresh={async () => {
            if (selectedVault) {
              await loadVaultItems(selectedVault.id);
            }
          }}
          nominees={selectedCategory.id === "emergency-access" ? vaultNominees : undefined}
          onAddNominee={selectedCategory.id === "emergency-access" ? () => {
            setShowNomineeModal(true);
          } : undefined}
        />
      )}
    </div>
  );
}

function VaultCategory({
  title,
  count,
  priority,
  microcopy,
  onClick,
}: {
  title: string;
  count: number;
  priority?: CategoryPriorityType;
  microcopy?: string;
  onClick?: () => void;
}) {
  const priorityColors: Record<CategoryPriorityType, string> = {
    "must-have": "border-red-500/50 bg-red-500/5",
    "good-to-have": "border-amber-500/50 bg-amber-500/5",
    "optional": "border-slate-700 bg-slate-800/40",
  };

  const priorityBadge: Record<CategoryPriorityType, { text: string; color: string }> = {
    "must-have": { text: "Must Have", color: "bg-red-500/20 text-red-400" },
    "good-to-have": { text: "Good to Have", color: "bg-amber-500/20 text-amber-400" },
    "optional": { text: "Optional", color: "bg-slate-700 text-slate-400" },
  };

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer flex-col rounded-lg border p-3 text-xs transition-colors hover:border-slate-600 ${
        priority && priority in priorityColors ? priorityColors[priority] : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-slate-100">{title}</span>
          </div>
          {microcopy && (
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{microcopy}</p>
          )}
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300 shrink-0">
          {count} items
        </span>
      </div>
    </div>
  );
}

function VaultItemCard({
  item,
  userRole,
  onDownload,
  onDelete,
}: {
  item: VaultItem;
  userRole: string | null;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-100">{item.title}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            {item.category}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
          <span>Created by {item.creator.fullName || item.creator.email}</span>
          <span>•</span>
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          {item.tags && item.tags.length > 0 && (
            <>
              <span>•</span>
              <span>{item.tags.join(", ")}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Download button - available for all roles (admin, editor, viewer) */}
        {item.s3Key && (
          <button
            onClick={onDownload}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        {/* Delete button - only for admin and editor (not viewer) */}
        {userRole && (userRole === "admin" || userRole === "editor") && (
          <button
            onClick={onDelete}
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
