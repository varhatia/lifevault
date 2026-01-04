"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  encryptFile, 
  deriveKeyFromPassword, 
  decryptFile, 
  encryptTextData, 
  decryptTextData,
  importRecoveryKey,
  decryptVaultKeyWithRecoveryKey,
  importAesKeyFromHex,
} from "@/lib/crypto";
import { useAuth } from "@/lib/hooks/useAuth";
import AddItemModal from "@/components/vaults/AddItemModal";
import CreateMyVaultModal from "./components/CreateMyVaultModal";
import AddNomineeModal from "./components/AddNomineeModal";
import MemberManagementModal from "./components/MemberManagementModal";
import DeleteVaultModal from "@/components/vaults/DeleteVaultModal";
import FolderDetailView, { DOCUMENT_TEMPLATES } from "@/components/vaults/FolderDetailView";
import { Download, Trash2, Users, UserPlus, ArrowRight, CheckCircle2, Bell, Calendar, Shield } from "lucide-react";
import RecoveryKeyResetModal from "./components/RecoveryKeyResetModal";
import VaultSetupWizard from "./components/VaultSetupWizard";
import ReadinessImprovementWizard from "./components/ReadinessImprovementWizard";
import VaultReviewModal from "./components/VaultReviewModal";
import ReviewReminderSettings from "./components/ReviewReminderSettings";
import Link from "next/link";

type MyVault = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  ownerId?: string;
  owner?: {
    id: string;
    email: string;
    fullName: string | null;
  };
  members?: Array<{
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
    nominees: number;
  };
};

type VaultItem = {
  id: string;
  category: string;
  title: string;
  tags: string[];
  s3Key?: string;
  iv?: string;
  encryptedMetadata?: string | null; // Base64 encoded encrypted metadata
  createdAt: string;
  updatedAt: string;
  creator?: {
    id: string;
    email: string;
    fullName: string | null;
  };
};

type VaultKey = {
  vaultId: string;
  keyHex: string;
};

// Import types
import { CategoryPriority, CategoryConfig, CATEGORIES_CONFIG } from "@/components/vaults/types";

const CATEGORIES = CATEGORIES_CONFIG.map(c => c.id) as readonly string[];

const CATEGORY_MICROCOPY: Record<string, string> = CATEGORIES_CONFIG.reduce((acc, cat) => {
  acc[cat.id] = cat.microcopy;
  return acc;
}, {} as Record<string, string>);

const CATEGORY_PRIORITIES: Record<string, CategoryPriority> = CATEGORIES_CONFIG.reduce((acc, cat) => {
  acc[cat.id] = cat.priority;
  return acc;
}, {} as Record<string, CategoryPriority>);

const CATEGORY_NAMES: Record<string, string> = CATEGORIES_CONFIG.reduce((acc, cat) => {
  acc[cat.id] = cat.name;
  return acc;
}, {} as Record<string, string>);

export default function MyVaultPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [vaults, setVaults] = useState<MyVault[]>([]);
  const [selectedVault, setSelectedVault] = useState<MyVault | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [vaultToUnlock, setVaultToUnlock] = useState<MyVault | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [useRecoveryKey, setUseRecoveryKey] = useState(false);
  const [vaultKeys, setVaultKeys] = useState<Map<string, VaultKey>>(new Map());
  const [nomineeModalVaultKey, setNomineeModalVaultKey] = useState<CryptoKey | null>(null);
  const [showRecoveryResetModal, setShowRecoveryResetModal] = useState(false);
  const [recoveryResetVault, setRecoveryResetVault] = useState<{ id: string; name: string; keyHex: string } | null>(null);
  const [showNomineeModal, setShowNomineeModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState<MyVault | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryConfig | null>(null);
  const [showFolderDetail, setShowFolderDetail] = useState(false);
  const [showImprovementWizard, setShowImprovementWizard] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<{
    lastReviewedAt: string | null;
    isReviewDue: boolean;
    isOwner: boolean;
  } | null>(null);
  const [reviewedCategories, setReviewedCategories] = useState<Set<string>>(new Set());
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [securityRotationStatus, setSecurityRotationStatus] = useState<{
    hasRotationNeeded: boolean;
    masterPassword: { needsRotation: boolean; daysSinceChange: number };
    recoveryKey: { needsRotation: boolean; daysSinceGeneration: number };
    members: Array<{ memberId: string; email: string; fullName: string | null; needsRotation: boolean }>;
    nominees: Array<{ nomineeId: string; nomineeName: string; needsRotation: boolean }>;
  } | null>(null);
  const [accountSecurityRotationStatus, setAccountSecurityRotationStatus] = useState<{
    hasRotationNeeded: boolean;
    accountPassword: { needsRotation: boolean; daysSinceChange: number };
  } | null>(null);

  // Load reviewed categories and items from localStorage when vault changes
  useEffect(() => {
    if (selectedVault) {
      const storageKey = `reviewed_${selectedVault.id}`;
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.categories && Array.isArray(parsed.categories)) {
            setReviewedCategories(new Set(parsed.categories));
          } else {
            setReviewedCategories(new Set());
          }
          if (parsed.items && Array.isArray(parsed.items)) {
            setReviewedItems(new Set(parsed.items));
          } else {
            setReviewedItems(new Set());
          }
        } else {
          // No saved state, clear current state
          setReviewedCategories(new Set());
          setReviewedItems(new Set());
        }
      } catch (error) {
        console.error("Error loading reviewed state from localStorage:", error);
        // On error, clear state
        setReviewedCategories(new Set());
        setReviewedItems(new Set());
      }
    } else {
      // No vault selected, clear state
      setReviewedCategories(new Set());
      setReviewedItems(new Set());
    }
  }, [selectedVault?.id]);

  // Persist reviewed categories and items to localStorage
  useEffect(() => {
    if (selectedVault) {
      const storageKey = `reviewed_${selectedVault.id}`;
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          categories: Array.from(reviewedCategories),
          items: Array.from(reviewedItems),
        }));
      } catch (error) {
        console.error("Error saving reviewed state to localStorage:", error);
      }
    }
  }, [reviewedCategories, reviewedItems, selectedVault?.id]);
  const [vaultNominees, setVaultNominees] = useState<Array<{
    id: string;
    nomineeName: string;
    nomineeEmail: string | null;
    nomineePhone: string | null;
    accessTriggerDays: number;
    isActive: boolean;
  }>>([]);
  
  // Readiness score and dashboard data (only loaded when vault is unlocked)
  const [allNominees, setAllNominees] = useState<any[] | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[] | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

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
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items`, {
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
    const vaultKeyData = vaultKeys.get(selectedVault.id);
    if (!vaultKeyData) return null;

    const keyArray = new Uint8Array(
      vaultKeyData.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    return await crypto.subtle.importKey(
      "raw",
      keyArray,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  };

  // Check authentication
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }
  }, [authLoading, isAuthenticated, router]);

  // Load vaults on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadVaults();
    }
  }, [isAuthenticated]);

  // Load items when vault is selected and unlocked
  useEffect(() => {
    if (selectedVault && vaultKeys.has(selectedVault.id)) {
      loadVaultItems(selectedVault.id);
      // Load readiness data when vault is unlocked
      loadReadinessData();
      // Load review status when vault is unlocked
      loadReviewStatus();
      // Load security rotation status when vault is unlocked
      loadSecurityRotationStatus();
      // Load account security rotation status
      loadAccountSecurityRotationStatus();
    }
  }, [selectedVault, vaultKeys]);

  // Load review status
  const loadReviewStatus = async () => {
    if (!selectedVault) return;
    try {
      const res = await fetch(`/api/vaults/my/${selectedVault.id}/review`);
      if (res.ok) {
        const data = await res.json();
        setReviewStatus(data);
      }
    } catch (error) {
      console.error("Error loading review status:", error);
    }
  };

  const loadSecurityRotationStatus = async () => {
    if (!selectedVault) return;
    try {
      const res = await fetch(`/api/vaults/my/${selectedVault.id}/security-rotation`);
      if (res.ok) {
        const data = await res.json();
        setSecurityRotationStatus(data);
      }
    } catch (error) {
      console.error("Error loading security rotation status:", error);
    }
  };

  const loadAccountSecurityRotationStatus = async () => {
    try {
      const res = await fetch(`/api/account/security-rotation`);
      if (res.ok) {
        const data = await res.json();
        setAccountSecurityRotationStatus(data);
      }
    } catch (error) {
      console.error("Error loading account security rotation status:", error);
    }
  };

  // Handle complete review
  const handleCompleteReview = async () => {
    if (!selectedVault) return;
    try {
      const res = await fetch(`/api/vaults/my/${selectedVault.id}/review`, {
        method: "POST",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to complete review");
      }

      await loadReviewStatus();
      await loadReadinessData();
      setReviewedCategories(new Set());
      setIsReviewMode(false);
      // Optionally close folder detail and show success
      setShowFolderDetail(false);
      setSelectedCategory(null);
    } catch (error) {
      console.error("Error completing review:", error);
      alert(error instanceof Error ? error.message : "Failed to complete review");
    }
  };

  // Load readiness score data (only when vault is unlocked)
  const loadReadinessData = async () => {
    try {
      setDashboardLoading(true);
      const [nomineesRes, activityRes] = await Promise.all([
        fetch("/api/nominee"),
        fetch("/api/activity/logs?limit=100"),
      ]);

      if (nomineesRes.ok) {
        const data = await nomineesRes.json();
        setAllNominees(data.nominees || []);
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivityLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load readiness data:", err);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Calculate readiness score (moved outside conditional to avoid hooks violation)
  const readinessScore = useMemo(() => {
    if (!vaults || !allNominees || !activityLogs || !selectedVault) {
      return null;
    }
    
    // Get nominees for selected vault
    const vaultNomineesCount = allNominees.filter((n: any) => 
      n.vaultType === "my_vault" && 
      (n.myVault?.id === selectedVault.id || n.myVaultId === selectedVault.id || n.vaultId === selectedVault.id) && 
      n.isActive
    ).length;
    
    // Get members count for selected vault
    const vaultMembersCount = selectedVault.members?.filter((m: any) => m.acceptedAt !== null).length || 0;
    
    const inputs = {
      myVaults: vaults.map(v => ({
        id: v.id,
        name: v.name,
        _count: v._count,
      })),
      items: items, // Pass actual items with category and tags
      membersCount: vaultMembersCount,
      nomineesCount: vaultNomineesCount,
      logs: activityLogs,
    };
    return computeReadinessScore(inputs);
  }, [vaults, allNominees, activityLogs, selectedVault, items]);

  const loadVaults = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/vaults/my");
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

  const handleOpenMemberModal = async () => {
    // Refresh vault data before opening modal to get latest member status
    // This ensures readiness score updates when member setup is completed
    try {
      const res = await fetch("/api/vaults/my");
      if (res.ok) {
        const data = await res.json();
        const updatedVaults = data.vaults || [];
        setVaults(updatedVaults);
        // Update selected vault with latest data
        if (selectedVault) {
          const updatedVault = updatedVaults.find((v: MyVault) => v.id === selectedVault.id);
          if (updatedVault) {
            setSelectedVault(updatedVault);
          }
        }
        // Reload readiness data to update score
        await loadReadinessData();
      }
    } catch (error) {
      console.error("Error refreshing vault data:", error);
    }
    setShowMemberModal(true);
  };

  const loadVaultItems = async (vaultId: string) => {
    try {
      const res = await fetch(`/api/vaults/my/${vaultId}/items`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error("Failed to load items:", res.status, errorData);
        throw new Error(errorData.error || "Failed to load items");
      }
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error("Error loading items:", error);
      // Set empty array on error to prevent UI issues
      setItems([]);
    }
  };


  const handleUnlockVault = async (vault: MyVault, masterPassword: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Derive key from master password
      const verifierKey = await deriveKeyFromPassword(masterPassword, false);

      // Fetch keys from server to determine if user is owner or member
      const keysRes = await fetch(`/api/vaults/my/${vault.id}/keys`);
      if (!keysRes.ok) {
        throw new Error("Failed to fetch vault keys");
      }
      const keysData = await keysRes.json();
      
      const isOwner = keysData.isOwner === true;
      const isMember = keysData.isMember === true;

      let keyHex: string;

      if (isOwner) {
        // Owner unlock logic (existing)
      const verifierKeyStorage = `vaultVerifier_${vault.id}`;
      const vaultKeyStorageKey = `my_vault_${vault.id}`;
      let verifierRaw: string | null = null;
      let encryptedKeyStr: string | null = null;
      let keysFromServer = false;
      
        // Prioritize server keys
          if (keysData.masterPasswordVerifier) {
            verifierRaw = keysData.masterPasswordVerifier;
            keysFromServer = true;
          }
          if (keysData.masterPasswordEncryptedVaultKey) {
            encryptedKeyStr = keysData.masterPasswordEncryptedVaultKey;
            keysFromServer = true;
      }
      
        // Fall back to localStorage if server didn't have keys
      if (!verifierRaw) {
        verifierRaw = localStorage.getItem(verifierKeyStorage);
      }
      if (!encryptedKeyStr) {
        encryptedKeyStr = localStorage.getItem(vaultKeyStorageKey);
      }
      
      // Verify password using verifier
      if (verifierRaw) {
        try {
          const payload = JSON.parse(verifierRaw);
          const data = await decryptTextData(payload, verifierKey);
          if (data && data.verifier === "lifevault-v1" && data.vaultId === vault.id) {
            // Verifier check passed
          } else {
            throw new Error("Invalid password for this vault");
          }
        } catch (e) {
          throw new Error("Invalid password for this vault");
        }
      } else {
        throw new Error("Vault verifier not found. Please recreate the vault or use recovery key.");
      }

      // Get encrypted vault key
      if (!encryptedKeyStr) {
        throw new Error("Vault key not found. Please recreate the vault or use recovery key.");
      }

      const encryptedKey = JSON.parse(encryptedKeyStr);
      const decryptedData = await decryptTextData(encryptedKey, verifierKey);
        keyHex = decryptedData.keyHex;

        // Sync server keys to localStorage
        if (typeof window !== "undefined" && keysFromServer && verifierRaw && encryptedKeyStr) {
          localStorage.setItem(verifierKeyStorage, verifierRaw);
          localStorage.setItem(vaultKeyStorageKey, encryptedKeyStr);
        }
      } else if (isMember) {
        // Member unlock logic (similar to Family Vault)
        // Get member data
        const membersRes = await fetch(`/api/vaults/my/${vault.id}/members`);
        if (!membersRes.ok) throw new Error("Failed to load members");
        const membersData = await membersRes.json();
        
        // Get current user
        const userRes = await fetch("/api/auth/me");
        if (!userRes.ok) throw new Error("Failed to get user");
        const userData = await userRes.json();
        const currentUserId = userData.user?.id;
        
        const currentUserMember = membersData.members.find(
          (m: any) => m.user.id === currentUserId
        );

        if (!currentUserMember?.encryptedSharedMasterKey) {
          throw new Error("No encrypted vault key found for this member");
        }

        // Check if member has completed setup
        if (!currentUserMember.acceptedAt) {
          throw new Error("You need to accept the invitation and set your master password first. Please check your email for the invitation link.");
        }

        // Try localStorage first
        const verifierKeyStorage = `myVaultVerifier_${vault.id}`;
        const memberStorageKey = `my_vault_member_${vault.id}`;
        let stored = localStorage.getItem(memberStorageKey);
        let privateKey: string | null = null;
        let storedVaultKeyHex: string | null = null;
        let keysFromServer = false;

        if (stored) {
          try {
            const encryptedData = JSON.parse(stored);
            const decryptedData = await decryptTextData(encryptedData, verifierKey);
            privateKey = decryptedData.privateKey;
            storedVaultKeyHex = decryptedData.vaultKeyHex;
          } catch (e) {
            console.warn("Failed to decrypt localStorage data, fetching from server:", e);
            localStorage.removeItem(memberStorageKey);
            stored = null;
          }
        }

        // If not in localStorage, fetch from server
        if (!privateKey && currentUserMember.encryptedPrivateKey) {
          try {
            const encryptedPrivateKeyData = JSON.parse(currentUserMember.encryptedPrivateKey);
            const decryptedPrivateKeyData = await decryptTextData(encryptedPrivateKeyData, verifierKey);
            privateKey = decryptedPrivateKeyData.privateKey;

            if (!privateKey) {
              throw new Error("Failed to decrypt private key from server");
            }

            // Decrypt vault key from server using the private key
            const { decryptWithRSAPrivateKey } = await import("@/lib/crypto-rsa");
            const decryptedVaultKey = await decryptWithRSAPrivateKey(
              currentUserMember.encryptedSharedMasterKey,
              privateKey
            );
            
            // Validate decrypted vault key format (64 hex characters for 256-bit key)
            if (!decryptedVaultKey || decryptedVaultKey.length !== 64 || !/^[0-9a-f]{64}$/i.test(decryptedVaultKey)) {
              throw new Error(`Decrypted vault key has invalid format. Expected 64 hex characters, got ${decryptedVaultKey?.length || 0} characters.`);
            }
            
            storedVaultKeyHex = decryptedVaultKey;
            keysFromServer = true;

            // Store in localStorage for faster access next time
            const encryptedVaultKeyLocal = await encryptTextData(
              { vaultKeyHex: storedVaultKeyHex, privateKey },
              verifierKey
            );
            localStorage.setItem(memberStorageKey, JSON.stringify(encryptedVaultKeyLocal));
          } catch (e) {
            console.error("Failed to decrypt private key from server:", e);
            throw new Error("Failed to decrypt vault key. Please ensure you're using the correct master password.");
          }
        }

        if (!privateKey) {
          throw new Error("Private key not found. Please contact the vault owner or use recovery key.");
        }

        if (!storedVaultKeyHex || storedVaultKeyHex.length !== 64 || !/^[0-9a-f]{64}$/i.test(storedVaultKeyHex)) {
          throw new Error("Invalid vault key format. The vault may need to be re-initialized.");
        }

        keyHex = storedVaultKeyHex;

        // Update verifier
        try {
          const verifierPayload = await encryptTextData(
            { verifier: "lifevault-v1", vaultId: vault.id },
            verifierKey
          );
          localStorage.setItem(verifierKeyStorage, JSON.stringify(verifierPayload));
        } catch (e) {
          console.error("Failed to create/update verifier:", e);
        }
      } else {
        throw new Error("You are not authorized to access this vault");
      }

      // Store in memory
      setVaultKeys((prev) => {
        const next = new Map(prev);
        next.set(vault.id, { vaultId: vault.id, keyHex });
        return next;
      });

      // Select the vault
      setSelectedVault(vault);
      setShowUnlockModal(false);
      setUnlockPassword("");
      setUseRecoveryKey(false);
    } catch (error) {
      console.error("Error unlocking vault:", error);
      setUnlockError(error instanceof Error ? error.message : "Failed to unlock vault");
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockWithRecoveryKey = async (vault: MyVault, recoveryKeyBase64: string) => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      // Import recovery key
      const recoveryKeyCrypto = await importRecoveryKey(recoveryKeyBase64);

      // ALWAYS fetch from server first to get the latest recovery key encrypted vault key
      // Server keys are the source of truth - they're updated when recovery key is reset
      const recoveryKeyStorageKey = `recoveryKeyEncryptedVaultKey_${vault.id}`;
      let encryptedVaultKeyStr: string | null = null;
      let keyFromServer = false;
      
      try {
        const keysRes = await fetch(`/api/vaults/my/${vault.id}/keys`);
        if (keysRes.ok) {
          const keysData = await keysRes.json();
          // Prioritize server keys - they're always the latest (especially after recovery key reset)
          if (keysData.recoveryKeyEncryptedVaultKey) {
            encryptedVaultKeyStr = keysData.recoveryKeyEncryptedVaultKey;
            keyFromServer = true;
          }
        }
      } catch (serverError) {
        console.error("Failed to fetch recovery key from server:", serverError);
        // Fall back to localStorage if server fetch fails (for backwards compatibility)
      }
      
      // If server didn't have recovery key, fall back to localStorage (for old vaults)
      if (!encryptedVaultKeyStr) {
        encryptedVaultKeyStr = localStorage.getItem(recoveryKeyStorageKey);
      }
      
      if (!encryptedVaultKeyStr) {
        throw new Error("Recovery key encrypted vault key not found. Please use master password or contact support.");
      }

      // Try to decrypt with the recovery key
      let encryptedVaultKey;
      let keyHex: string;
      try {
        encryptedVaultKey = JSON.parse(encryptedVaultKeyStr);
        keyHex = await decryptVaultKeyWithRecoveryKey(encryptedVaultKey, recoveryKeyCrypto);
      } catch (decryptError) {
        // Decryption failed - might be old recovery key after reset
        // If we got it from localStorage, clear it and try server again
        if (!keyFromServer) {
          console.warn("Failed to decrypt with recovery key (might be old key), clearing localStorage and trying server:", decryptError);
          localStorage.removeItem(recoveryKeyStorageKey);
          
          // Try server one more time
          try {
            const keysRes = await fetch(`/api/vaults/my/${vault.id}/keys`);
            if (keysRes.ok) {
              const keysData = await keysRes.json();
              if (keysData.recoveryKeyEncryptedVaultKey) {
                encryptedVaultKey = JSON.parse(keysData.recoveryKeyEncryptedVaultKey);
                keyHex = await decryptVaultKeyWithRecoveryKey(encryptedVaultKey, recoveryKeyCrypto);
                keyFromServer = true;
              } else {
                throw decryptError; // Re-throw original error
              }
            } else {
              throw decryptError; // Re-throw original error
            }
          } catch (retryError) {
            throw new Error("Invalid recovery key or recovery key encrypted vault key not found. Please verify your recovery key is correct.");
          }
        } else {
          // Already tried server, so the recovery key is wrong
          throw new Error("Invalid recovery key. Please verify your recovery key is correct.");
        }
      }

      // Sync recovery key encrypted vault key to localStorage if we got it from server
      if (typeof window !== "undefined" && keyFromServer && encryptedVaultKeyStr) {
        localStorage.setItem(recoveryKeyStorageKey, encryptedVaultKeyStr);
      }

      // Instead of directly unlocking, trigger recovery key reset workflow
      // This ensures security by forcing password reset after recovery key usage
      setRecoveryResetVault({
        id: vault.id,
        name: vault.name,
        keyHex,
      });
      setShowRecoveryResetModal(true);
      setShowUnlockModal(false);
      setUnlockPassword("");
      setUseRecoveryKey(false);
    } catch (error) {
      console.error("Error unlocking vault with recovery key:", error);
      setUnlockError(error instanceof Error ? error.message : "Invalid recovery key or vault key not found");
    } finally {
      setUnlocking(false);
    }
  };

  const handleUnlockSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!vaultToUnlock) return;
    
    if (!unlockPassword) {
      setUnlockError(useRecoveryKey ? "Please enter your recovery key" : "Please enter your master password");
      return;
    }

    if (useRecoveryKey) {
      await handleUnlockWithRecoveryKey(vaultToUnlock, unlockPassword);
    } else {
      await handleUnlockVault(vaultToUnlock, unlockPassword);
    }
  };

  const handleSelectVault = (vault: MyVault) => {
    // Check if vault is already unlocked
    if (vaultKeys.has(vault.id)) {
      setSelectedVault(vault);
    } else {
      // Show unlock modal
      setVaultToUnlock(vault);
      setShowUnlockModal(true);
      setUnlockPassword("");
      setUnlockError(null);
      setUseRecoveryKey(false);
    }
  };

  const handleRecoveryResetSuccess = async (newKeyHex: string) => {
    if (!recoveryResetVault) return;

    // Store key in memory for the reset vault
    setVaultKeys((prev) => {
      const next = new Map(prev);
      next.set(recoveryResetVault.id, {
        vaultId: recoveryResetVault.id,
        keyHex: newKeyHex,
      });
      return next;
    });

    // Select the vault after successful reset
    const vault = vaults.find((v) => v.id === recoveryResetVault.id);
    if (vault) {
      setSelectedVault(vault);
    }

    // Close reset modal
    setShowRecoveryResetModal(false);
    setRecoveryResetVault(null);

    // Refresh security rotation status after reset
    await loadSecurityRotationStatus();
  };

  const handleFileUpload = async (file: File, category: string, title: string) => {
    if (!selectedVault) {
      throw new Error("No vault selected");
    }

    const vaultKeyData = vaultKeys.get(selectedVault.id);
    if (!vaultKeyData) {
      throw new Error("Vault is not unlocked");
    }

    // Import vault key from hex
    const keyArray = new Uint8Array(
      vaultKeyData.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );
    const vaultKey = await crypto.subtle.importKey(
      "raw",
      keyArray,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    try {
      // Encrypt file client-side
      const { encryptedBlob, iv, metadata } = await encryptFile(file, vaultKey);

      // Upload encrypted blob to server
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: title || metadata.name,
          tags: [],
          encryptedBlob,
          iv,
          metadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload");
      }

      // Refresh list
      await loadVaultItems(selectedVault.id);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      throw error;
    }
  };

  const handleDownload = async (item: VaultItem) => {
    if (!selectedVault) return;
    
    // Check if document exists
    if (!item.s3Key) {
      alert("No document uploaded for this item.");
      return;
    }
    
    const vaultKeyData = vaultKeys.get(selectedVault.id);
    if (!vaultKeyData) {
      alert("Vault is locked. Please unlock it first.");
      return;
    }

    try {
      // Import vault key from hex
      const keyArray = new Uint8Array(
        vaultKeyData.keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );
      const vaultKey = await crypto.subtle.importKey(
        "raw",
        keyArray,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );

      // Download encrypted blob from server
      const response = await fetch(
        `/api/vaults/my/${selectedVault.id}/items/${item.id}/download`
      );

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

      // Decrypt file client-side (encryptedBlob is base64 string)
      // Zero-knowledge: decryption happens only on client, server never sees plaintext
      const decryptedBlob = await decryptFile(encryptedBlob, iv, vaultKey);

      // Use metadata from API to preserve original filename and MIME type
      const filename = metadata?.filename || item.title;
      const mimeType = metadata?.type || 'application/octet-stream';

      // Create download link with proper MIME type
      const url = URL.createObjectURL(
        new Blob([decryptedBlob], { type: mimeType })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      const message =
        error instanceof Error ? error.message : "Failed to download file";
      alert(message);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!selectedVault) return;
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const response = await fetch(`/api/vaults/my/${selectedVault.id}/items/${itemId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete");

      await loadVaultItems(selectedVault.id);
    } catch (error) {
      console.error("Error deleting item:", error);
      alert("Failed to delete item");
    }
  };

  const handleDeleteVault = async () => {
    if (!vaultToDelete) return;

    try {
      const response = await fetch(`/api/vaults/my/${vaultToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete vault");
      }

      // Remove vault from memory
      setVaultKeys((prev) => {
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

  if (!authLoading && !isAuthenticated) {
    return null;
  }

  if (loading && vaults.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">My Vaults</h1>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <p className="text-xs text-slate-300">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Unlock Modal */}
      {showUnlockModal && vaultToUnlock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-4">Unlock {vaultToUnlock.name}</h2>
            <p className="text-sm text-slate-400 mb-4">
              {useRecoveryKey 
                ? "Enter your recovery key to unlock this vault" 
                : "Enter your master password to unlock this vault"}
            </p>
            <form onSubmit={handleUnlockSubmit} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecoveryKey(false);
                    setUnlockPassword("");
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
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
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
                    setVaultToUnlock(null);
                    setUnlockPassword("");
                    setUnlockError(null);
                    setUseRecoveryKey(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  disabled={unlocking}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unlocking || !unlockPassword}
                  className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {unlocking ? "Unlocking..." : "Unlock Vault"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {recoveryResetVault && (
        <RecoveryKeyResetModal
          isOpen={showRecoveryResetModal}
          onClose={() => {
            setShowRecoveryResetModal(false);
            setRecoveryResetVault(null);
          }}
          vaultId={recoveryResetVault.id}
          vaultName={recoveryResetVault.name}
          currentVaultKeyHex={recoveryResetVault.keyHex}
          onSuccess={handleRecoveryResetSuccess}
        />
      )}

      {vaultToDelete && (
        <DeleteVaultModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setVaultToDelete(null);
          }}
          vaultName={vaultToDelete.name}
          vaultId={vaultToDelete.id}
          vaultType="my_vault"
          itemsCount={vaultToDelete._count?.items || 0}
          nomineesCount={vaultToDelete._count?.nominees || 0}
          onDelete={handleDeleteVault}
        />
      )}

      {showReviewModal && selectedVault && (
        <VaultReviewModal
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setIsReviewMode(false);
            // Don't clear reviewedCategories here - persist them for next time
          }}
          vaultId={selectedVault.id}
          items={items}
          reviewedCategories={reviewedCategories}
          onReviewComplete={async () => {
            await loadReviewStatus();
            await loadReadinessData();
            // Clear reviewed state after completing review
            setReviewedCategories(new Set());
            setReviewedItems(new Set());
            setIsReviewMode(false);
            // Clear from localStorage
            if (selectedVault) {
              const storageKey = `reviewed_${selectedVault.id}`;
              try {
                localStorage.removeItem(storageKey);
              } catch (error) {
                console.error("Error clearing reviewed state from localStorage:", error);
              }
            }
          }}
          onCategoryClick={(category) => {
            setIsReviewMode(true);
            setSelectedCategory(category);
            setShowFolderDetail(true);
            setShowReviewModal(false);
          }}
        />
      )}

      {showReminderSettings && selectedVault && (
        <ReviewReminderSettings
          isOpen={showReminderSettings}
          onClose={() => setShowReminderSettings(false)}
          vaultId={selectedVault.id}
          onSettingsUpdated={async () => {
            await loadReviewStatus();
          }}
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
          vaultType="my_vault"
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

              const response = await fetch(`/api/vaults/my/${selectedVault.id}/items/${itemId}`, {
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
              const response = await fetch(`/api/vaults/my/${selectedVault.id}/items/${itemId}`, {
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
              await handleDownload(item);
            }
          }}
          onRefresh={async () => {
            if (selectedVault) {
              await loadVaultItems(selectedVault.id);
            }
          }}
          nominees={undefined}
          onAddNominee={undefined}
          reviewMode={isReviewMode}
          reviewedItems={reviewedItems}
          onItemReviewed={(itemId: string) => {
            const newSet = new Set(reviewedItems);
            // Toggle the item's reviewed status
            if (newSet.has(itemId)) {
              newSet.delete(itemId);
            } else {
              newSet.add(itemId);
            }
            setReviewedItems(newSet);
            
            // Check if all items in the current category are reviewed
            if (selectedCategory) {
              const categoryItems = items.filter(i => i.category === selectedCategory.id);
              const allCategoryItemsReviewed = categoryItems.length > 0 && 
                categoryItems.every(item => !item.id || newSet.has(item.id));
              
              if (allCategoryItemsReviewed) {
                // Mark category as reviewed
                const newCategoriesSet = new Set(reviewedCategories);
                newCategoriesSet.add(selectedCategory.id);
                setReviewedCategories(newCategoriesSet);
              } else {
                // Remove category from reviewed if not all items are reviewed
                const newCategoriesSet = new Set(reviewedCategories);
                newCategoriesSet.delete(selectedCategory.id);
                setReviewedCategories(newCategoriesSet);
              }
            }
          }}
          onCloseAndReturnToReview={() => {
            setShowFolderDetail(false);
            setSelectedCategory(null);
            setShowReviewModal(true);
          }}
        />
      )}

      {/* Create Vault Modal */}
      {showCreateModal && (
        <CreateMyVaultModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={async (vaultId, vaultKey) => {
            // CreateMyVaultModal handles vault creation and storage
            // Export key as hex for storage in memory
            const exportedKey = await crypto.subtle.exportKey("raw", vaultKey);
            const keyArray = new Uint8Array(exportedKey);
            const keyHex = Array.from(keyArray)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            
            // Store in memory
            setVaultKeys((prev) => {
              const next = new Map(prev);
              next.set(vaultId, { vaultId, keyHex });
              return next;
            });
            
            setShowCreateModal(false);
            await loadVaults(); // Refresh vault list
            
            // Select the newly created vault after loading
            setTimeout(() => {
              const newVault = vaults.find(v => v.id === vaultId);
              if (newVault) {
                setSelectedVault(newVault);
              }
            }, 100);
          }}
        />
      )}

      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Vaults</h1>
            <p className="mt-1 text-xs text-slate-300">
              Private, client-side encrypted vaults. Each vault has its own password.
            </p>
          </div>
          {/* Only show Create Vault button if user doesn't already own a vault */}
          {user && !vaults.some(v => v.ownerId === user.id || v.owner?.id === user.id) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-700"
            >
              + Create Vault
            </button>
          )}
        </header>

        {/* Vault List */}
        {vaults.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
            <p className="text-sm text-slate-300 mb-4">No vaults yet. Create your first vault to get started.</p>
            {/* Only show Create button if user doesn't already own a vault */}
            {user && !vaults.some(v => v.ownerId === user.id || v.owner?.id === user.id) && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Create Your First Vault
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vaults.map((vault) => {
              const isUnlocked = vaultKeys.has(vault.id);
              const isSelected = selectedVault?.id === vault.id;
              return (
                <div
                  key={vault.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    isSelected
                      ? "border-brand-500 bg-slate-900"
                      : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => handleSelectVault(vault)}
                    >
                      <h3 className="text-base font-semibold text-white">{vault.name}</h3>
                      <div className="mt-2 flex gap-3 text-xs text-slate-400">
                        <span>{vault._count?.items || 0} items</span>
                        <span>•</span>
                        <span>{vault._count?.nominees || 0} nominees</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isUnlocked && (
                        <span className="rounded-full bg-brand-500/20 px-2 py-1 text-[10px] text-brand-300">
                          Unlocked
                        </span>
                      )}
                      {/* Only show delete button if user is the owner of the vault */}
                      {user && (vault.ownerId === user.id || vault.owner?.id === user.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVaultToDelete(vault);
                            setShowDeleteModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          title="Delete vault"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Vault Content - Show unlock prompt if locked */}
        {selectedVault && !vaultKeys.has(selectedVault.id) && (
          <div className="space-y-4 border-t border-slate-800 pt-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 text-center">
              <h2 className="text-lg font-semibold text-white mb-2">{selectedVault.name}</h2>
              <p className="text-sm text-slate-400 mb-4">
                Unlock this vault to view your readiness score, review your documents, and manage your items.
              </p>
              <button
                onClick={() => {
                  setVaultToUnlock(selectedVault);
                  setShowUnlockModal(true);
                }}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Unlock Vault
              </button>
            </div>
          </div>
        )}

        {/* Selected Vault Content - Show when unlocked */}
        {selectedVault && vaultKeys.has(selectedVault.id) && (() => {
          // Check if user is owner
          const isOwner = user && (selectedVault.ownerId === user.id || selectedVault.owner?.id === user.id);
          
          // Check setup completion
          const idItems = items.filter(item => item.category === "identity-vital");
          // Check for both Aadhaar and PAN (mandatory)
          const hasAadhaar = idItems.some(item => 
            item.tags.some(tag => 
              tag.toLowerCase() === "aadhaar" || 
              tag.toLowerCase() === "aadhar" ||
              tag.toLowerCase().includes("aadhaar") ||
              tag.toLowerCase().includes("aadhar")
            )
          );
          const hasPAN = idItems.some(item => 
            item.tags.some(tag => 
              tag.toLowerCase() === "pan" || 
              tag.toLowerCase().includes("pan")
            )
          );
          const hasIds = hasAadhaar && hasPAN;
          
          const bankItems = items.filter(item => item.category === "finance-investments");
          const insuranceItems = items.filter(item => item.category === "insurance");
          const hasLifeInsurance = insuranceItems.some(item => 
            item.tags.some(tag => 
              tag.toLowerCase().includes("life") || 
              tag.toLowerCase().includes("term") ||
              tag === "life-term-insurance"
            )
          );
          const hasHealthInsurance = insuranceItems.some(item =>
            item.tags.some(tag =>
              tag.toLowerCase().includes("health") ||
              tag === "health-insurance"
            )
          );
          // Filter nominees for this specific vault
          // Check myVault relation (API returns myVault with id field) or myVaultId field
          const vaultNomineesCount = allNominees?.filter((n: any) => 
            n.vaultType === "my_vault" && 
            (n.myVault?.id === selectedVault.id || n.myVaultId === selectedVault.id || n.vaultId === selectedVault.id) && 
            n.isActive
          ).length || 0;
          
          const isSetupComplete = 
            hasIds &&
            bankItems.length >= 1 &&
            vaultNomineesCount >= 1 &&
            hasLifeInsurance &&
            hasHealthInsurance;

          return (
            <div className="space-y-6 border-t border-slate-800 pt-6">
              {/* Show wizard if user is owner and setup is incomplete */}
              {isOwner && !isSetupComplete && (
                <VaultSetupWizard
                  items={items}
                  nomineesCount={vaultNomineesCount}
                  vaultId={selectedVault.id}
                  vaultName={selectedVault.name}
                  isOwner={true}
                  onCategoryClick={(categoryId) => {
                    const category = CATEGORIES_CONFIG.find(c => c.id === categoryId);
                    if (category) {
                      setSelectedCategory(category);
                      setShowFolderDetail(true);
                    }
                  }}
                  onAddNominee={() => {
                    setShowNomineeModal(true);
                  }}
                  readinessScore={readinessScore?.score ?? null}
                />
              )}

              {/* Account Security Rotation Nudge */}
              {accountSecurityRotationStatus?.hasRotationNeeded && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Shield className="w-5 h-5 text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-200">
                          🔒 Security Reminder: Rotate Your Account Keys
                        </h3>
                        <p className="text-xs text-red-300/80 mt-1">
                          It's been 6 months since your last security rotation. For your security, we recommend rotating your account keys.
                        </p>
                        <div className="mt-2 space-y-1">
                          {accountSecurityRotationStatus.accountPassword.needsRotation && (
                            <p className="text-xs text-red-300/70">
                              • Account Password ({accountSecurityRotationStatus.accountPassword.daysSinceChange} days old)
                            </p>
                          )}
                        </div>
                        {/* Call To Action Buttons */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {accountSecurityRotationStatus.accountPassword.needsRotation && (
                            <button
                              onClick={() => {
                                if (confirm("To change your account password, you'll need to use the password reset flow. Would you like to proceed?")) {
                                  window.location.href = "/auth/forgot-password";
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-200 hover:text-red-100 border border-red-500/50 rounded-md hover:bg-red-500/20 transition-colors"
                            >
                              Reset Account Password
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Vault Security Rotation Nudge - Only for owners */}
              {securityRotationStatus?.hasRotationNeeded && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Shield className="w-5 h-5 text-red-400 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-200">
                          🔒 Security Reminder: Rotate Your Vault Keys
                        </h3>
                        <p className="text-xs text-red-300/80 mt-1">
                          It's been 6 months since your last security rotation. For your security, we recommend rotating your vault keys.
                        </p>
                        <div className="mt-2 space-y-1">
                          {securityRotationStatus.masterPassword.needsRotation && (
                            <p className="text-xs text-red-300/70">
                              • Vault Master Password ({securityRotationStatus.masterPassword.daysSinceChange} days old)
                            </p>
                          )}
                          {securityRotationStatus.recoveryKey.needsRotation && (
                            <p className="text-xs text-red-300/70">
                              • Recovery Key ({securityRotationStatus.recoveryKey.daysSinceGeneration} days old)
                            </p>
                          )}
                          {securityRotationStatus.members.filter(m => m.needsRotation).length > 0 && (
                            <p className="text-xs text-red-300/70">
                              • Member Keys ({securityRotationStatus.members.filter(m => m.needsRotation).length} member(s) need rotation)
                            </p>
                          )}
                          {securityRotationStatus.nominees.filter(n => n.needsRotation).length > 0 && (
                            <p className="text-xs text-red-300/70">
                              • Nominee Keys ({securityRotationStatus.nominees.filter(n => n.needsRotation).length} nominee(s) need rotation)
                            </p>
                          )}
                        </div>
                        {/* Call To Action Buttons */}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {securityRotationStatus.masterPassword.needsRotation && (
                            <button
                              onClick={() => {
                                if (selectedVault && vaultKeys.has(selectedVault.id)) {
                                  // Vault is unlocked - can reset password via recovery key reset modal
                                  const vaultKeyData = vaultKeys.get(selectedVault.id);
                                  if (vaultKeyData) {
                                    setRecoveryResetVault({
                                      id: selectedVault.id,
                                      name: selectedVault.name,
                                      keyHex: vaultKeyData.keyHex,
                                    });
                                    setShowRecoveryResetModal(true);
                                  }
                                } else {
                                  // Vault not unlocked - need to unlock first
                                  alert("Please unlock your vault first to reset the master password. You can use your recovery key if needed.");
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-200 hover:text-red-100 border border-red-500/50 rounded-md hover:bg-red-500/20 transition-colors"
                            >
                              Reset Master Password
                            </button>
                          )}
                          {securityRotationStatus.recoveryKey.needsRotation && (
                            <button
                              onClick={() => {
                                if (selectedVault && vaultKeys.has(selectedVault.id)) {
                                  // Vault is unlocked - can reset recovery key
                                  const vaultKeyData = vaultKeys.get(selectedVault.id);
                                  if (vaultKeyData) {
                                    setRecoveryResetVault({
                                      id: selectedVault.id,
                                      name: selectedVault.name,
                                      keyHex: vaultKeyData.keyHex,
                                    });
                                    setShowRecoveryResetModal(true);
                                  }
                                } else {
                                  // Vault not unlocked - need to unlock first
                                  alert("Please unlock your vault first to reset the recovery key. You can use your current recovery key if needed.");
                                }
                              }}
                              className="px-3 py-1.5 text-xs font-medium text-red-200 hover:text-red-100 border border-red-500/50 rounded-md hover:bg-red-500/20 transition-colors"
                            >
                              Reset Recovery Key
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Review Reminder Nudge - Only for owners */}
              {reviewStatus?.isOwner && reviewStatus.isReviewDue && (
                <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4 mb-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Bell className="w-5 h-5 text-orange-400 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-orange-200">
                          Time to Review Your Vault
                        </h3>
                        <p className="text-xs text-orange-300/80 mt-1">
                          It's been a while since your last review. Review your vault items to ensure all information is up to date.
                        </p>
                        {reviewStatus.lastReviewedAt && (
                          <p className="text-xs text-orange-300/60 mt-1">
                            Last reviewed: {new Date(reviewStatus.lastReviewedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReminderSettings(true)}
                        className="px-3 py-1.5 text-xs font-medium text-orange-200 hover:text-orange-100 border border-orange-500/50 rounded-md hover:bg-orange-500/20 transition-colors"
                      >
                        Settings
                      </button>
                      <button
                        onClick={() => setShowReviewModal(true)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Review Now
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Readiness Score Section - Only shown after unlock */}
              <ReadinessSection
                myVaults={vaults.filter(v => v.id === selectedVault.id)}
                items={items}
                membersCount={selectedVault.members?.filter((m: any) => m.acceptedAt !== null).length || 0}
                nominees={allNominees}
                activityLogs={activityLogs}
                loading={dashboardLoading}
                onShowImprovements={() => setShowImprovementWizard(true)}
                reviewStatus={reviewStatus}
                onReviewClick={() => setShowReviewModal(true)}
                onReminderSettingsClick={() => setShowReminderSettings(true)}
                onCategoryClick={(categoryId) => {
                  const category = CATEGORIES_CONFIG.find(c => c.id === categoryId);
                  if (category) {
                    setSelectedCategory(category);
                    setShowFolderDetail(true);
                    setShowImprovementWizard(false);
                  }
                }}
                onRotatePassword={() => {
                  // Navigate to forgot password flow for password change
                  if (confirm("To change your password, you'll need to use the password reset flow. Would you like to proceed?")) {
                    window.location.href = "/auth/forgot-password";
                  }
                  setShowImprovementWizard(false);
                }}
                onRotateKeys={() => {
                  if (selectedVault) {
                    const vaultKeyData = vaultKeys.get(selectedVault.id);
                    if (vaultKeyData) {
                      setRecoveryResetVault({
                        id: selectedVault.id,
                        name: selectedVault.name,
                        keyHex: vaultKeyData.keyHex,
                      });
                      setShowRecoveryResetModal(true);
                      setShowImprovementWizard(false);
                    }
                  }
                }}
                onAddMember={async () => {
                  await handleOpenMemberModal();
                  setShowImprovementWizard(false);
                }}
              />

              {/* Readiness Improvement Wizard */}
              {showImprovementWizard && (
                <ReadinessImprovementWizard
                  items={items}
                  membersCount={selectedVault.members?.filter((m: any) => m.acceptedAt !== null).length || 0}
                  nomineesCount={vaultNomineesCount}
                  readinessScore={readinessScore?.score ?? 0}
                  activityLogs={activityLogs || []}
                  onCategoryClick={(categoryId) => {
                    const category = CATEGORIES_CONFIG.find(c => c.id === categoryId);
                    if (category) {
                      setSelectedCategory(category);
                      setShowFolderDetail(true);
                      setShowImprovementWizard(false);
                    }
                  }}
                  onRotatePassword={() => {
                    // Navigate to forgot password flow for password change
                    if (confirm("To change your password, you'll need to use the password reset flow. Would you like to proceed?")) {
                      window.location.href = "/auth/forgot-password";
                    }
                    setShowImprovementWizard(false);
                  }}
                  onRotateKeys={() => {
                    if (selectedVault) {
                      const vaultKeyData = vaultKeys.get(selectedVault.id);
                      if (vaultKeyData) {
                        setRecoveryResetVault({
                          id: selectedVault.id,
                          name: selectedVault.name,
                          keyHex: vaultKeyData.keyHex,
                        });
                        setShowRecoveryResetModal(true);
                        setShowImprovementWizard(false);
                      }
                    }
                  }}
                  onAddMember={() => {
                    setShowMemberModal(true);
                    setShowImprovementWizard(false);
                  }}
                  onClose={() => setShowImprovementWizard(false)}
                />
              )}

              <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedVault.name}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Items and nominee access for this vault
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Only show Nominees button if user is the owner of the vault */}
                {user && (selectedVault.ownerId === user.id || selectedVault.owner?.id === user.id) && (
                  <button
                    onClick={() => setShowNomineeModal(true)}
                    className="flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:bg-slate-700"
                  >
                    <Users className="w-3 h-3" />
                    Nominees
                  </button>
                )}
                <button
                  onClick={handleOpenMemberModal}
                  className="flex items-center gap-1 rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm hover:bg-slate-700"
                >
                  <UserPlus className="w-3 h-3" />
                  Members
                </button>
              </div>
            </div>

            {showUploadModal && (
              <AddItemModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                vaultName={selectedVault.name}
                vaultType="my_vault"
                vaultKey={null} // We'll handle encryption in handleFileUpload
                onUpload={handleFileUpload}
              />
            )}

            {showNomineeModal && (
              <AddNomineeModal
                isOpen={showNomineeModal}
                onClose={() => setShowNomineeModal(false)}
                onSuccess={async () => {
                  // Refresh nominees list and vault items to update wizard
                  await loadReadinessData();
                  if (selectedVault) {
                    await loadVaultItems(selectedVault.id);
                  }
                }}
                vaultKey={nomineeModalVaultKey}
                vaultId={selectedVault.id}
                vaultName={selectedVault.name}
                getMasterPassword={async () => {
                  const pwd = prompt(
                    `Enter your master password for "${selectedVault.name}" to manage nominees:`
                  );
                  return pwd && pwd.trim().length > 0 ? pwd.trim() : null;
                }}
                getVaultKeyHex={async () => {
                  const vaultKeyData = vaultKeys.get(selectedVault.id);
                  return vaultKeyData ? vaultKeyData.keyHex : null;
                }}
              />
            )}

            {showMemberModal && selectedVault && (
              <MemberManagementModal
                isOpen={showMemberModal}
                onClose={async () => {
                  setShowMemberModal(false);
                  // Refresh vault data and readiness score when modal closes
                  // This ensures readiness score updates when member setup is completed
                  await loadVaults();
                  // Update selected vault with latest data
                  if (selectedVault) {
                    const updatedVaults = await fetch("/api/vaults/my").then(res => res.json()).then(data => data.vaults || []).catch(() => []);
                    const updatedVault = updatedVaults.find((v: MyVault) => v.id === selectedVault.id);
                    if (updatedVault) {
                      setSelectedVault(updatedVault);
                    }
                  }
                  await loadReadinessData();
                }}
                vault={{
                  id: selectedVault.id,
                  name: selectedVault.name,
                  members: selectedVault.members || [],
                }}
                onUpdate={async () => {
                  // Refresh vault data and readiness score when members are updated (role change, etc.)
                  await loadVaults();
                  // Update selected vault with latest data
                  if (selectedVault) {
                    const updatedVaults = await fetch("/api/vaults/my").then(res => res.json()).then(data => data.vaults || []).catch(() => []);
                    const updatedVault = updatedVaults.find((v: MyVault) => v.id === selectedVault.id);
                    if (updatedVault) {
                      setSelectedVault(updatedVault);
                    }
                  }
                  await loadReadinessData();
                }}
                getVaultKeyHex={async () => {
                  const vaultKeyData = vaultKeys.get(selectedVault.id);
                  return vaultKeyData ? vaultKeyData.keyHex : null;
                }}
              />
            )}

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

            <section className="space-y-2">
              <h3 className="text-sm font-medium">Vault Items ({items.length})</h3>
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-xs text-slate-300">
                  No items yet. Upload your first encrypted file to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <VaultItemCard
                      key={item.id}
                      item={item}
                      onDownload={() => handleDownload(item)}
                      onDelete={() => handleDelete(item.id)}
                    />
                  ))}
                </div>
              )}
              </section>
            </div>
          );
        })()}
      </div>
    </>
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
  priority?: CategoryPriority;
  microcopy?: string;
  onClick?: () => void;
}) {
  const priorityColors = {
    "must-have": "border-red-500/50 bg-red-500/5",
    "good-to-have": "border-amber-500/50 bg-amber-500/5",
    "optional": "border-slate-700 bg-slate-800/40",
  };

  const priorityBadge = {
    "must-have": { text: "Must Have", color: "bg-red-500/20 text-red-400" },
    "good-to-have": { text: "Good to Have", color: "bg-amber-500/20 text-amber-400" },
    "optional": { text: "Optional", color: "bg-slate-700 text-slate-400" },
  };

  return (
    <div
      onClick={onClick}
      className={`flex cursor-pointer flex-col rounded-lg border p-3 text-xs transition-colors hover:border-slate-600 ${
        priority ? priorityColors[priority] : "border-slate-800 bg-slate-900/60"
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
  onDownload,
  onDelete,
}: {
  item: VaultItem;
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
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          {item.tags.length > 0 && (
            <span>• {item.tags.join(", ")}</span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {item.s3Key && (
          <button
            onClick={onDownload}
            className="rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 flex items-center gap-1"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded-md bg-red-900/50 px-2 py-1 text-xs text-red-300 hover:bg-red-900/70 flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

// Readiness Score Section - Only shown after vault unlock
function ReadinessSection({
  myVaults,
  items,
  membersCount,
  nominees,
  activityLogs,
  loading,
  onShowImprovements,
  onCategoryClick,
  onRotatePassword,
  onRotateKeys,
  onAddMember,
  reviewStatus,
  onReviewClick,
  onReminderSettingsClick,
}: {
  myVaults: MyVault[];
  items: VaultItem[];
  membersCount: number;
  nominees: any[] | null;
  activityLogs: any[] | null;
  loading: boolean;
  onShowImprovements?: () => void;
  onCategoryClick?: (categoryId: string) => void;
  onRotatePassword?: () => void;
  onRotateKeys?: () => void;
  onAddMember?: () => void;
  reviewStatus?: {
    lastReviewedAt: string | null;
    isReviewDue: boolean;
    isOwner: boolean;
  } | null;
  onReviewClick?: () => void;
  onReminderSettingsClick?: () => void;
}) {
  const readiness = useMemo(() => {
    if (!myVaults || !nominees || !activityLogs) {
      return null;
    }

    // Get nominees count for the selected vault (if any)
    const selectedVault = myVaults[0]; // Use first vault as selected
    const vaultNomineesCount = nominees.filter((n: any) => 
      n.vaultType === "my_vault" && 
      (n.myVault?.id === selectedVault?.id || n.myVaultId === selectedVault?.id || n.vaultId === selectedVault?.id) && 
      n.isActive
    ).length;

    const inputs = {
      myVaults: myVaults.map(v => ({
        id: v.id,
        name: v.name,
        _count: v._count,
      })),
      items: items || [],
      membersCount: membersCount || 0,
      nomineesCount: vaultNomineesCount,
      logs: activityLogs,
    };

    return computeReadinessScore(inputs);
  }, [myVaults, items, membersCount, nominees, activityLogs]);

  if (loading || !readiness) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm text-slate-400">Loading readiness score...</p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-4">
        <div className="max-w-xl">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Your Life Readiness
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            {readiness.score >= 80
              ? "You're well prepared. Keep things up to date."
              : readiness.score < 80
              ? "A few steps can significantly improve your preparedness."
              : "The goal is not completion. The goal is confidence."}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <ReadinessRing
            percentage={readiness.score}
            loading={false}
          />
          <div className="mt-2 text-center">
            <p className="text-xs font-medium text-slate-200">
              {readiness.bucketLabel}
            </p>
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
        {onShowImprovements && readiness.score < 100 && (
          <button
            onClick={onShowImprovements}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
          >
            <ArrowRight className="w-4 h-4" />
            View Actions to Improve Score
          </button>
        )}
        {reviewStatus?.isOwner && onReviewClick && (
          <div className="flex gap-2">
            <button
              onClick={onReviewClick}
              disabled={!reviewStatus.isReviewDue}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                reviewStatus.isReviewDue
                  ? "bg-slate-700 text-white hover:bg-slate-600"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
              title={reviewStatus.isReviewDue ? "Review your vault" : "Review will be available once the configured period has passed"}
            >
              <CheckCircle2 className="w-4 h-4" />
              Review Vault
            </button>
            {onReminderSettingsClick && (
              <button
                onClick={onReminderSettingsClick}
                className="rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors flex items-center justify-center"
                title="Review Reminder Settings"
              >
                <Bell className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        {reviewStatus?.isOwner && reviewStatus.lastReviewedAt && (
          <p className="text-xs text-slate-400 text-center mt-2">
            Last reviewed: {new Date(reviewStatus.lastReviewedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </section>
  );
}

function ReadinessRing({
  percentage,
  loading,
}: {
  percentage: number;
  loading: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage || 0)));
  const display = loading ? 0 : clamped;
  const gradient = `conic-gradient(var(--brand-500) ${display * 3.6}deg, rgba(148, 163, 184, 0.3) 0deg)`;

  return (
    <div
      className="relative flex h-28 w-28 items-center justify-center rounded-full bg-slate-900"
      style={{
        backgroundImage: gradient,
      }}
    >
      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-slate-950 border border-slate-800">
        <span className="text-xl font-semibold text-slate-50">
          {display}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-400">
          Ready
        </span>
      </div>
    </div>
  );
}

function computeReadinessScore(inputs: {
  myVaults: Array<{ id: string; name: string; _count?: { items?: number; nominees?: number; members?: number } }>;
  items?: Array<{ category: string; tags: string[] }>; // Items with category and tags
  membersCount?: number; // Active members count
  nomineesCount: number;
  logs: any[];
}) {
  const { myVaults, items = [], membersCount = 0, nomineesCount, logs } = inputs;

  // 1. Vault completion (50 pts) - Based on category priority
  // Must-have categories (identity-vital, finance-investments, insurance)
  const mustHaveCategories = ["identity-vital", "finance-investments", "insurance"];
  const mustHaveItems = items.filter(item => mustHaveCategories.includes(item.category));
  
  // Check for specific must-have items
  const hasAadhaar = items.some(item => 
    item.category === "identity-vital" && 
    item.tags.some(tag => 
      tag.toLowerCase() === "aadhaar" || 
      tag.toLowerCase() === "aadhar" ||
      tag.toLowerCase().includes("aadhaar") ||
      tag.toLowerCase().includes("aadhar")
    )
  );
  const hasPAN = items.some(item => 
    item.category === "identity-vital" && 
    item.tags.some(tag => 
      tag.toLowerCase() === "pan" || 
      tag.toLowerCase().includes("pan")
    )
  );
  const hasIds = hasAadhaar && hasPAN; // Both required
  
  const hasBankAccount = items.some(item => item.category === "finance-investments");
  
  const hasLifeInsurance = items.some(item => 
    item.category === "insurance" && 
    item.tags.some(tag => 
      tag.toLowerCase().includes("life") || 
      tag.toLowerCase().includes("term") ||
      tag === "life-term-insurance"
    )
  );
  const hasHealthInsurance = items.some(item =>
    item.category === "insurance" &&
    item.tags.some(tag =>
      tag.toLowerCase().includes("health") ||
      tag === "health-insurance"
    )
  );
  const hasInsurance = hasLifeInsurance && hasHealthInsurance; // Both required

  // Good-to-have categories (loans-liabilities, digital-assets)
  const goodToHaveCategories = ["loans-liabilities", "digital-assets"];
  const goodToHaveItems = items.filter(item => goodToHaveCategories.includes(item.category));
  
  // Optional categories (legal-property) - deprioritized
  const optionalItems = items.filter(item => item.category === "legal-property");

  // Score calculation based on priority
  // Must-have: 15 pts each (IDs, Bank Account, Insurance) = 45 pts
  // Good-to-have: 3 pts per category = 6 pts max
  // Optional: 1 pt max
  const vaultCompletionPoints =
    (hasIds ? 15 : 0) +                    // IDs (Aadhaar + PAN) - 15 pts
    (hasBankAccount ? 15 : 0) +            // Bank Account - 15 pts
    (hasInsurance ? 15 : 0) +              // Insurance (Life + Health) - 15 pts
    (goodToHaveItems.length > 0 ? 3 : 0) + // Good-to-have items - 3 pts
    (goodToHaveItems.length >= 2 ? 3 : 0) + // Both good-to-have categories - 3 pts
    (optionalItems.length > 0 ? 1 : 0);     // Optional items - 1 pt (deprioritized)

  // 2. Members & Nominee setup (25 pts)
  const hasNominee = (nomineesCount || 0) > 0;
  const hasMembers = (membersCount || 0) > 0;

  const membersAndNomineePoints =
    (hasNominee ? 15 : 0) +      // Nominee - 15 pts
    (hasMembers ? 10 : 0);       // Members - 10 pts

  // Helper to check logs within days
  const withinDays = (days: number, actionPrefix?: string) => {
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;
    return logs.some((log) => {
      if (actionPrefix && !log.action.startsWith(actionPrefix)) return false;
      const t = new Date(log.createdAt).getTime();
      return now - t <= windowMs;
    });
  };

  // 3. Freshness & maintenance (15 pts)
  const reviewedRecently = withinDays(30, "myvault_");
  const passwordRotated = withinDays(90, "password_reset"); // Account password
  const keysRotated = withinDays(180, "myvault_recovery_key_reset");

  // TODO: Add vault-level password and recovery key rotation checks
  // When vault is unlocked, check:
  // - vault.masterPasswordLastChanged (should be within 90 days)
  // - vault.recoveryKeyGeneratedAt (should be within 90 days)
  // This will be integrated with vault security data from /api/account/vaults/security
  // Points: +5 for vault password rotated, +5 for recovery key rotated

  const freshnessPoints =
    (reviewedRecently ? 8 : 0) +
    (passwordRotated ? 4 : 0) +
    (keysRotated ? 3 : 0);

  // 4. Engagement (10 pts)
  const appOpenedRecently = withinDays(30, "login_success") || withinDays(30);
  const hasStarted = items.length > 0;
  const nextBestActionCompleted = hasIds && hasBankAccount && hasInsurance;

  const engagementPoints =
    (appOpenedRecently ? 4 : 0) +
    (hasStarted ? 3 : 0) +
    (nextBestActionCompleted ? 3 : 0);

  const rawScore =
    vaultCompletionPoints +
    membersAndNomineePoints +
    freshnessPoints +
    engagementPoints;

  const score = Math.max(0, Math.min(100, rawScore));
  let bucketLabel = "Getting Started";
  let bucketSubtitle =
    "You've taken the first step. We'll help you prioritise what to add next.";

  if (score >= 81) {
    bucketLabel = "Strongly Prepared";
    bucketSubtitle =
      "You've covered the big rocks. A quick seasonal review keeps everything sharp.";
  } else if (score >= 61) {
    bucketLabel = "Well Prepared";
    bucketSubtitle =
      "You're doing well. A few small updates can strengthen this further.";
  } else if (score >= 31) {
    bucketLabel = "Partially Prepared";
    bucketSubtitle =
      "Key pieces are in place. Let's close a few important gaps together.";
  }

  return {
    score,
    bucketLabel,
    bucketSubtitle,
    details: {
      vaultCompletion: vaultCompletionPoints,
      membersAndNominee: membersAndNomineePoints,
      freshness: freshnessPoints,
      engagement: engagementPoints,
    },
  };
}

// Life Setup Section - Only shown after vault unlock
function LifeSetupSection({
  myVaults,
  familyVaults,
  nominees,
  loading,
}: {
  myVaults: MyVault[];
  familyVaults: any[] | null;
  nominees: any[] | null;
  loading: boolean;
}) {
  if (loading || !myVaults || !familyVaults || !nominees) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-400">
        Loading your setup status…
      </div>
    );
  }

  const hasPersonalVault = myVaults.length > 0;
  const hasPersonalNominee = nominees.some(
    (n: any) => n.vaultType === "my_vault" && n.isActive
  );

  const actions: Array<{ id: string; title: string; explanation: string; href: string; icon: string }> = [];

  if (!hasPersonalVault) {
    actions.push({
      id: "create-personal-vault",
      title: "Create Personal Vault",
      explanation: "Your private space for sensitive information.",
      href: "/my-vault",
      icon: "🔒",
    });
  }

  if (hasPersonalVault && !hasPersonalNominee) {
    actions.push({
      id: "assign-personal-nominee",
      title: "Assign Nominee to Personal Vault",
      explanation: "Choose someone you trust to access it if needed.",
      href: "/my-vault",
      icon: "👤",
    });
  }

  const allComplete = actions.length === 0;

  if (allComplete) {
    return (
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-slate-100">
            Complete Your Life Setup
          </h2>
          <p className="mt-1 text-[11px] text-slate-400">
            These one-time steps help ensure your information is available to the people you trust.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">✅</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-100">
                Your Life Setup is complete
              </h3>
              <p className="mt-1 text-[11px] text-slate-400">
                Completed. You can review or update anytime.
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight text-slate-100">
          Complete Your Life Setup
        </h2>
        <p className="mt-1 text-[11px] text-slate-400">
          These one-time steps help ensure your information is available to the people you trust.
        </p>
      </div>
      <LifeSetupProgressiveWidget actions={actions} />
    </section>
  );
}

function LifeSetupProgressiveWidget({
  actions,
}: {
  actions: Array<{ id: string; title: string; explanation: string; href: string; icon: string }>;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [skippedActions, setSkippedActions] = useState<Set<string>>(new Set());
  const [allViewed, setAllViewed] = useState(false);

  useEffect(() => {
    if (currentStep >= actions.length) {
      setCurrentStep(Math.max(0, actions.length - 1));
    }
  }, [actions.length, currentStep]);

  useEffect(() => {
    if (currentStep === actions.length - 1 && actions.length > 0) {
      setAllViewed(true);
    }
  }, [currentStep, actions.length]);

  if (actions.length === 0) {
    return null;
  }

  const currentAction = actions[currentStep];
  const progress = ((currentStep + 1) / actions.length) * 100;
  const isLastStep = currentStep === actions.length - 1;
  const isFirstStep = currentStep === 0;

  const handleSkip = () => {
    setSkippedActions((prev) => new Set(prev).add(currentAction.id));
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setAllViewed(true);
    }
  };

  const handleDoLater = () => {
    setSkippedActions((prev) => new Set(prev).add(currentAction.id));
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setAllViewed(true);
    }
  };

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep((prev) => prev - 1);
      setAllViewed(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
          <span>Step {currentStep + 1} of {actions.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-start gap-4">
          <span className="text-3xl">{currentAction.icon}</span>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-slate-100 mb-2">
              {currentAction.title}
            </h3>
            <p className="text-sm text-slate-300 mb-4">
              {currentAction.explanation}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={currentAction.href}
                className="inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
              >
                Do this now
              </Link>
              <button
                onClick={handleDoLater}
                className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 hover:border-slate-600 hover:bg-slate-700 transition-colors"
              >
                Do later
              </button>
              <button
                onClick={handleSkip}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Skip
              </button>
            </div>
            {skippedActions.has(currentAction.id) && (
              <p className="mt-2 text-xs text-slate-500 italic">
                You marked this to do later
              </p>
            )}
          </div>
        </div>
      </div>

      {allViewed && isLastStep && (
        <div className="mb-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-300">
            You've reviewed all setup steps. Complete them anytime from your vaults.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        <button
          onClick={handlePrevious}
          disabled={isFirstStep}
          className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <div className="flex items-center gap-1">
          {actions.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStep
                  ? "bg-brand-500"
                  : index < currentStep
                  ? "bg-brand-500/50"
                  : "bg-slate-700"
              }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
        <button
          onClick={handleNext}
          disabled={isLastStep}
          className="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
