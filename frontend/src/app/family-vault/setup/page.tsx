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

function FamilyVaultSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading: authLoading, isAuthenticated } = useAuth();
  const token = searchParams.get("token");
  const vaultId = searchParams.get("vaultId");

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

  // Check authentication - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Store the invitation link in sessionStorage to redirect back after login
      if (token && vaultId) {
        sessionStorage.setItem('familyVaultInvite', JSON.stringify({ token, vaultId }));
      }
      router.push("/auth/login");
      return;
    }
  }, [authLoading, isAuthenticated, router, token, vaultId]);

  useEffect(() => {
    if (!token || !vaultId) {
      setError("Invalid invitation link. Please check your email.");
      return;
    }

    // Don't verify if not authenticated yet
    if (!isAuthenticated) {
      return;
    }

    // Verify invitation token and get vault details
    const verifyInvitation = async () => {
      try {
        const res = await fetch(`/api/family/vaults/${vaultId}/invite/verify?token=${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Invalid invitation");
        }
        const data = await res.json();
        setVaultName(data.vaultName);
        setInviterName(data.inviterName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to verify invitation");
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
      // The private key is already encrypted with email, we'll decrypt and re-encrypt with master password on server
      const res = await fetch(`/api/family/vaults/${vaultId}/invite/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          masterPassword: masterPassword, // We'll use this to create verifier and encrypt private key
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to accept invitation");
      }

      const data = await res.json();

      // Store vault-specific verifier (like vault creation)
      const smkKey = await deriveKeyFromPassword(masterPassword);
      const verifierKey = `familyVaultVerifier_${vaultId}`;
      const verifierPayload = await encryptTextData(
        { verifier: "lifevault-v1", vaultId },
        smkKey
      );
      localStorage.setItem(verifierKey, JSON.stringify(verifierPayload));

      // Now we need to decrypt the SMK to encrypt it with recovery key
      // Fetch member data to get encrypted SMK and private key
      const membersRes = await fetch(`/api/family/vaults/${vaultId}/members`);
      if (!membersRes.ok) {
        throw new Error("Failed to fetch member data");
      }
      const membersData = await membersRes.json();
      const currentUserMember = membersData.members.find(
        (m: any) => m.user.id === data.member.user.id
      );

      if (!currentUserMember?.encryptedSharedMasterKey || !currentUserMember?.encryptedPrivateKey) {
        throw new Error("Member data not found after acceptance");
      }

      // Decrypt private key from server
      const encryptedPrivateKeyData = JSON.parse(currentUserMember.encryptedPrivateKey);
      const decryptedPrivateKeyData = await decryptTextData(encryptedPrivateKeyData, smkKey);
      const privateKey = decryptedPrivateKeyData.privateKey;

      if (!privateKey) {
        throw new Error("Failed to decrypt private key");
      }

      // Decrypt SMK from server using the private key
      const decryptedSMK = await decryptWithRSAPrivateKey(
        currentUserMember.encryptedSharedMasterKey,
        privateKey
      );

      // Validate decrypted SMK format
      if (!decryptedSMK || decryptedSMK.length !== 64 || !/^[0-9a-f]{64}$/i.test(decryptedSMK)) {
        throw new Error("Invalid SMK format after decryption");
      }

      // Generate recovery key
      const recoveryKeyBase64 = generateRecoveryKey();
      setRecoveryKey(recoveryKeyBase64);

      // Encrypt SMK with recovery key
      const recoveryKeyCrypto = await importRecoveryKey(recoveryKeyBase64);
      const encryptedSMK = await encryptVaultKeyWithRecoveryKey(
        decryptedSMK,
        recoveryKeyCrypto
      );

      // Store recovery key encrypted SMK in localStorage (for this vault)
      localStorage.setItem(
        `recoveryKeyEncryptedKey_family_vault_${vaultId}`,
        JSON.stringify(encryptedSMK)
      );

      // Store recovery key encrypted SMK on server (per-member, per-vault)
      try {
        await fetch(`/api/family/vaults/${vaultId}/recovery-key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryKeyEncryptedSMK: JSON.stringify(encryptedSMK),
          }),
        });
      } catch (serverError) {
        console.error("Failed to store recovery key on server:", serverError);
        // Continue anyway - localStorage is stored
      }

      // Store SMK and private key locally (encrypted with master password) for faster access
      const encryptedLocalData = await encryptTextData(
        { smkHex: decryptedSMK, privateKey },
        smkKey
      );
      localStorage.setItem(
        `family_vault_${vaultId}`,
        JSON.stringify(encryptedLocalData)
      );

      // Send recovery key via email
      try {
        await fetch("/api/auth/recovery-key/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recoveryKey: recoveryKeyBase64,
            vaultId: vaultId,
            vaultName: vaultName,
          }),
        });
      } catch (emailError) {
        console.error("Failed to send recovery key email:", emailError);
        // Don't fail setup if email fails
      }

      // Show recovery key screen
      setShowRecoveryKey(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up vault access");
    } finally {
      setLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-800 p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-slate-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated (handled by useEffect)
  if (!isAuthenticated) {
    return null;
  }

  if (error && !token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-800 p-6">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Invalid Invitation</h2>
          </div>
          <p className="text-slate-300 mb-4">{error}</p>
          <button
            onClick={() => router.push("/family-vault")}
            className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg"
          >
            Go to Family Vaults
          </button>
        </div>
      </div>
    );
  }

  const handleContinue = () => {
    if (!recoveryKeySaved) {
      alert("Please confirm that you have saved your recovery key before continuing.");
      return;
    }

    setSuccess(true);
    
    // Redirect to family vault page after 2 seconds
    setTimeout(() => {
      router.push("/family-vault");
    }, 2000);
  };

  if (showRecoveryKey && recoveryKey) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-800 p-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white">Save Your Recovery Key</h3>
              <p className="mt-1 text-xs text-slate-300">
                This key can unlock your vault if you forget your master password. Store it securely!
              </p>
            </div>

            <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200">
                  <strong>Important:</strong> Save this recovery key in a secure location. If you lose both your master password and recovery key, you will not be able to access your vault.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">Your Recovery Key</label>
              <div className="relative">
                <textarea
                  readOnly
                  value={recoveryKey}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white font-mono break-all resize-none h-32"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(recoveryKey);
                    setRecoveryKeyCopied(true);
                    setTimeout(() => setRecoveryKeyCopied(false), 2000);
                  }}
                  className="absolute top-2 right-2 p-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs"
                >
                  {recoveryKeyCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([recoveryKey], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `lifevault-recovery-key-${vaultName}.txt`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                  className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 flex items-center justify-center gap-2"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
                <button
                  type="button"
                  onClick={() => setRecoveryKeySaved(true)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    recoveryKeySaved
                      ? "bg-green-600 text-white"
                      : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  } flex items-center justify-center gap-2`}
                >
                  {recoveryKeySaved ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />} I&apos;ve Saved It
                </button>
              </div>
            </div>

            {!recoveryKeySaved && (
              <p className="text-xs text-red-400">
                Please ensure you have saved your recovery key securely before continuing.
              </p>
            )}

            <button
              type="button"
              onClick={handleContinue}
              disabled={!recoveryKeySaved}
              className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-800 p-6">
          <div className="flex items-center gap-3 text-green-400 mb-4">
            <CheckCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Setup Complete!</h2>
          </div>
          <p className="text-slate-300 mb-4">
            Your master password has been set. You can now access the "{vaultName}" vault.
          </p>
          <p className="text-sm text-slate-400 mb-4">
            Redirecting to Family Vaults...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-800 p-6">
        <div className="flex items-center gap-3 text-brand-400 mb-6">
          <Lock className="w-6 h-6" />
          <h2 className="text-xl font-bold">Set Up Vault Access</h2>
        </div>

        {vaultName && (
          <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">Vault Name</p>
            <p className="text-white font-medium">{vaultName}</p>
            {inviterName && (
              <>
                <p className="text-sm text-slate-400 mb-1 mt-3">Invited by</p>
                <p className="text-white">{inviterName}</p>
              </>
            )}
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
              placeholder="Enter master password (min 8 characters)"
              required
              minLength={8}
              disabled={loading}
            />
            <p className="text-xs text-slate-400 mt-1">
              This password will be used to unlock this vault. Make sure to remember it!
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
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-brand-500"
              placeholder="Confirm master password"
              required
              minLength={8}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !masterPassword || !confirmPassword}
            className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Setting up..." : "Set Up Vault Access"}
          </button>
        </form>

        <p className="text-xs text-slate-400 mt-4 text-center">
          By setting up access, you agree to maintain the security of this vault.
        </p>
      </div>
    </div>
  );
}

export default function FamilyVaultSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg border border-slate-800 p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-slate-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-slate-700 rounded w-full mb-2"></div>
            <div className="h-4 bg-slate-700 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    }>
      <FamilyVaultSetupContent />
    </Suspense>
  );
}
