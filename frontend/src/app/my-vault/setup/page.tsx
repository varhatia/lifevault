"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, CheckCircle, AlertCircle, Copy, Download, AlertTriangle, Check } from "lucide-react";
import { 
  deriveKeyFromPassword, 
  encryptTextData, 
  decryptTextData,
  generateRecoveryKey,
  importRecoveryKey,
  encryptVaultKeyWithRecoveryKey,
} from "@/lib/crypto";
import { decryptWithRSAPrivateKey } from "@/lib/crypto-rsa";
import { useAuth } from "@/lib/hooks/useAuth";

function MyVaultSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [token, setToken] = useState<string | null>(searchParams.get("token"));
  const [vaultId, setVaultId] = useState<string | null>(searchParams.get("vaultId"));

  // Restore invitation context from sessionStorage if URL params are missing
  useEffect(() => {
    if ((!token || !vaultId) && isAuthenticated) {
      const inviteData = sessionStorage.getItem('myVaultInvite');
      if (inviteData) {
        try {
          const { token: storedToken, vaultId: storedVaultId } = JSON.parse(inviteData);
          if (storedToken && storedVaultId) {
            setToken(storedToken);
            setVaultId(storedVaultId);
            // Update URL without navigation to maintain context
            const newUrl = `/my-vault/setup?token=${storedToken}&vaultId=${storedVaultId}`;
            window.history.replaceState({}, '', newUrl);
          }
        } catch (e) {
          console.error('Error parsing stored invite data:', e);
        }
      }
    }
  }, [token, vaultId, isAuthenticated]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [vaultName, setVaultName] = useState("");
  const [inviterName, setInviterName] = useState("");
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryKeyCopied, setRecoveryKeyCopied] = useState(false);
  const [recoveryKeySaved, setRecoveryKeySaved] = useState(false);
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);

  // Restore invitation context from sessionStorage if URL params are missing
  useEffect(() => {
    if ((!token || !vaultId) && isAuthenticated) {
      const inviteData = sessionStorage.getItem('myVaultInvite');
      if (inviteData) {
        try {
          const { token: storedToken, vaultId: storedVaultId } = JSON.parse(inviteData);
          if (storedToken && storedVaultId) {
            setToken(storedToken);
            setVaultId(storedVaultId);
            // Update URL without navigation to maintain context
            const newUrl = `/my-vault/setup?token=${storedToken}&vaultId=${storedVaultId}`;
            window.history.replaceState({}, '', newUrl);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored invite data:', e);
        }
      }
    }
  }, [token, vaultId, isAuthenticated]);

  // Check authentication - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Store the invitation link in sessionStorage to redirect back after login
      if (token && vaultId) {
        sessionStorage.setItem('myVaultInvite', JSON.stringify({ token, vaultId }));
      } else {
        // If URL params are missing, try to restore from sessionStorage
        const inviteData = sessionStorage.getItem('myVaultInvite');
        if (inviteData) {
          try {
            const { token: storedToken, vaultId: storedVaultId } = JSON.parse(inviteData);
            if (storedToken && storedVaultId) {
              setToken(storedToken);
              setVaultId(storedVaultId);
            }
          } catch (e) {
            console.error('Error parsing stored invite data:', e);
          }
        }
      }
      router.push("/auth/login");
      return;
    }
  }, [authLoading, isAuthenticated, router, token, vaultId]);

  useEffect(() => {
    if (!token || !vaultId) {
      setError("Invalid invitation link");
      return;
    }

    const verifyInvitation = async () => {
      try {
        const res = await fetch(`/api/vaults/my/${vaultId}/invite/verify?token=${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to verify invitation");
        }
        const data = await res.json();
        setVaultName(data.vaultName);
        setInviterName(data.inviterName);
      } catch (err: any) {
        setError(err.message || "Failed to verify invitation");
      }
    };

    verifyInvitation();
  }, [token, vaultId, isAuthenticated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!masterPassword || masterPassword.length < 8) {
      setError("Master password must be at least 8 characters");
      return;
    }

    if (masterPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token || !vaultId) {
      setError("Invalid invitation link");
      return;
    }

    try {
      setLoading(true);

      // Accept invitation and set master password
      const res = await fetch(`/api/vaults/my/${vaultId}/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          masterPassword: masterPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invitation");
      }

      const data = await res.json();

      // Store vault-specific verifier
      const vaultKey = await deriveKeyFromPassword(masterPassword);
      const verifierKey = `myVaultVerifier_${vaultId}`;
      const verifierPayload = await encryptTextData(
        { verifier: "lifevault-v1", vaultId },
        vaultKey
      );
      localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));

      // Now we need to decrypt the vault key to encrypt it with recovery key
      // Fetch member data to get encrypted vault key and private key
      const membersRes = await fetch(`/api/vaults/my/${vaultId}/members`);
      if (!membersRes.ok) {
        throw new Error("Failed to fetch member data");
      }
      const membersData = await membersRes.json();
      const currentUserMember = membersData.members.find(
        (m: any) => m.user.id === data.member.user.id
      );

      if (!currentUserMember || !currentUserMember.encryptedSharedMasterKey) {
        throw new Error("Failed to retrieve vault key");
      }

      // Decrypt the vault key using RSA private key
      const privateKeyData = JSON.parse(currentUserMember.encryptedPrivateKey || "{}");
      const decryptedPrivateKey = await decryptTextData(privateKeyData, vaultKey);
      const privateKey = decryptedPrivateKey.privateKey;

      // Decrypt the vault key (encrypted with member's public key)
      const vaultKeyHex = await decryptWithRSAPrivateKey(
        currentUserMember.encryptedSharedMasterKey,
        privateKey
      );

      // Generate recovery key
      const recoveryKeyBase64 = generateRecoveryKey();
      setRecoveryKey(recoveryKeyBase64);

      // Encrypt vault key with recovery key
      const recoveryKeyCrypto = await importRecoveryKey(recoveryKeyBase64);
      const encryptedKey = await encryptVaultKeyWithRecoveryKey(
        vaultKeyHex,
        recoveryKeyCrypto
      );

      // Store recovery key encrypted key in localStorage
      const recoveryKeyStorageKey = `recoveryKeyEncryptedKey_my_vault_${vaultId}`;
      localStorage.setItem(
        recoveryKeyStorageKey,
        JSON.stringify(encryptedKey)
      );

      // Update recovery key on server
      const recoveryRes = await fetch(`/api/vaults/my/${vaultId}/recovery-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryKeyEncryptedKey: JSON.stringify(encryptedKey),
        }),
      });

      if (!recoveryRes.ok) {
        console.error("Failed to save recovery key to server");
        // Don't fail the whole process if recovery key save fails
      }

      setSuccess(true);
      setShowRecoveryKey(true);
    } catch (err: any) {
      console.error("Error accepting invitation:", err);
      setError(err.message || "Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const copyRecoveryKey = () => {
    if (recoveryKey) {
      navigator.clipboard.writeText(recoveryKey);
      setRecoveryKeyCopied(true);
      setTimeout(() => setRecoveryKeyCopied(false), 2000);
    }
  };

  const downloadRecoveryKey = () => {
    if (recoveryKey) {
      const blob = new Blob([recoveryKey], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `livpeace-recovery-key-${vaultId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setRecoveryKeySaved(true);
    }
  };

  if (success && showRecoveryKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-2xl p-8">
          <div className="text-center mb-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Recovery Key Generated
            </h1>
            <p className="text-slate-400">
              Save this recovery key securely. You'll need it if you forget your master password.
            </p>
          </div>

          <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-400 mb-2">
                  Important: Save This Recovery Key
                </h3>
                <ul className="text-xs text-amber-300 space-y-1">
                  <li>• Store it in a password manager or secure location</li>
                  <li>• Print it and keep it in a safe place</li>
                  <li>• Do not share it with anyone</li>
                  <li>• You will need this if you forget your master password</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-slate-800 rounded-lg p-4 mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Your Recovery Key:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={recoveryKey || ""}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm font-mono"
              />
              <button
                onClick={copyRecoveryKey}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
              >
                {recoveryKeyCopied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={downloadRecoveryKey}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded text-sm"
            >
              <Download className="w-4 h-4" />
              Download Recovery Key
            </button>
            {recoveryKeySaved && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Recovery key saved
              </span>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <button
              onClick={() => router.push("/my-vault")}
              className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded text-sm font-medium"
            >
              Continue to Vault
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-md p-8">
        <div className="text-center mb-6">
          <Lock className="w-12 h-12 text-brand-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">
            Set Up Vault Access
          </h1>
          {vaultName && (
            <p className="text-slate-400">
              You've been invited to join <strong className="text-white">{vaultName}</strong>
            </p>
          )}
          {inviterName && (
            <p className="text-sm text-slate-500 mt-1">
              Invited by {inviterName}
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Error</h3>
                <p className="text-xs text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Master Password
            </label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Enter your master password"
              required
              minLength={8}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Must be at least 8 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Confirm Master Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your master password"
              required
              minLength={8}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : "Set Up Vault Access"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MyVaultSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <MyVaultSetupContent />
    </Suspense>
  );
}

