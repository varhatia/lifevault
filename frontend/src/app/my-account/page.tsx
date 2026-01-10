"use client";

import { useState, useEffect } from "react";
import { 
  Mail, 
  Phone, 
  User, 
  Shield, 
  Clock, 
  Monitor, 
  Key, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Globe,
  Calendar,
  Smartphone,
  Laptop,
  Tablet,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useRouter } from "next/navigation";
import { usePlanUsage } from "@/hooks/usePlanUsage";
import UpgradeModal from "@/components/UpgradeModal";
import { Sparkles, Info } from "lucide-react";

type AccountData = {
  profile: {
    email: string;
    phone: string | null;
    fullName: string | null;
    accountCreatedAt: string;
    lastUpdatedAt: string;
  };
  emergencyContact: {
    name: string;
    email: string | null;
    phone: string | null;
    accessTriggerDays: number;
    addedAt: string;
  } | null;
  security: {
    emailVerified: boolean;
    emailVerifiedAt: string | null;
    deviceBinding: {
      enabled: boolean;
      keyPresent: boolean;
      trustedDevicesCount: number;
    };
    lastPasswordChange: string | null;
    lastLogin: string | null;
    serverKeyPartB: {
      version: number;
      encryptedAt: string | null;
    };
    vaultSetup: {
      completed: boolean;
      completedAt: string | null;
    };
  };
  vaultsSecurity?: Array<{
    vaultId: string;
    vaultName: string;
    masterPassword: {
      hasVerifier: boolean;
      lastChanged: string | null;
      daysSinceChange: number | null;
      needsRotation: boolean;
    };
    recoveryKey: {
      hasRecoveryKey: boolean;
      generatedAt: string | null;
      daysSinceGeneration: number | null;
      needsRotation: boolean;
    };
    createdAt: string;
  }>;
  recentLogins: Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    device: string;
    browser: string;
    os: string;
    timestamp: string;
  }>;
  securityIndicators: {
    emailVerified: boolean;
    hasDeviceBinding: boolean;
    hasPasswordChanged: boolean;
    vaultSetupCompleted: boolean;
    daysSincePasswordChange: number | null;
    daysUntilPasswordShouldChange: number | null;
    passwordShouldBeChangedBy: string | null;
    daysSinceLastLogin: number | null;
  };
};

export default function MyAccountPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { plan, usage } = usePlanUsage();
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [trustedDevices, setTrustedDevices] = useState<Array<{
    id: string;
    name: string;
    userAgent: string | null;
    ipAddress: string | null;
    lastUsedAt: string;
    createdAt: string;
  }>>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [vaultsSecurity, setVaultsSecurity] = useState<Array<{
    vaultId: string;
    vaultName: string;
    masterPassword: {
      hasVerifier: boolean;
      lastChanged: string | null;
      daysSinceChange: number | null;
      needsRotation: boolean;
    };
    recoveryKey: {
      hasRecoveryKey: boolean;
      generatedAt: string | null;
      daysSinceGeneration: number | null;
      needsRotation: boolean;
    };
    createdAt: string;
  }>>([]);
  const [vaultsSecurityLoading, setVaultsSecurityLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (isAuthenticated) {
      loadAccountData();
      loadTrustedDevices();
      loadVaultsSecurity();
    }
  }, [authLoading, isAuthenticated, router]);

  const loadAccountData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/account");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login");
          return;
        }
        throw new Error("Failed to load account data");
      }
      const data = await res.json();
      setAccountData(data);
    } catch (err) {
      console.error("Error loading account data:", err);
      setError(err instanceof Error ? err.message : "Failed to load account data");
    } finally {
      setLoading(false);
    }
  };

  const loadTrustedDevices = async () => {
    try {
      setDevicesLoading(true);
      const res = await fetch("/api/account/devices");
      if (!res.ok) {
        if (res.status === 401) {
          return;
        }
        throw new Error("Failed to load devices");
      }
      const data = await res.json();
      setTrustedDevices(data.devices || []);
    } catch (err) {
      console.error("Error loading devices:", err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const loadVaultsSecurity = async () => {
    try {
      setVaultsSecurityLoading(true);
      const res = await fetch("/api/account/vaults/security");
      if (!res.ok) {
        if (res.status === 401) {
          return;
        }
        throw new Error("Failed to load vault security");
      }
      const data = await res.json();
      setVaultsSecurity(data.vaults || []);
    } catch (err) {
      console.error("Error loading vault security:", err);
    } finally {
      setVaultsSecurityLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to revoke this device? You will need to authorize it again to log in from it.")) {
      return;
    }

    try {
      const res = await fetch("/api/account/devices", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId }),
      });

      if (!res.ok) {
        throw new Error("Failed to revoke device");
      }

      // Reload devices list
      await loadTrustedDevices();
    } catch (err) {
      console.error("Error revoking device:", err);
      alert("Failed to revoke device. Please try again.");
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-4 h-4" />;
      case "tablet":
        return <Tablet className="w-4 h-4" />;
      default:
        return <Laptop className="w-4 h-4" />;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
          <p className="text-sm text-gray-600">Loading account information...</p>
        </div>
      </div>
    );
  }

  if (error || !accountData) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-600">
            {error || "Failed to load account information"}
          </p>
          <button
            onClick={loadAccountData}
            className="mt-4 rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        limitType="storage"
        currentStorageMB={usage.storageUsedMB}
        maxAllowed={plan === "free" ? 5 : Infinity}
        message="Upgrade to LifeVault Plus for unlimited storage and advanced features."
      />

      <header>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">My Account</h1>
              {/* Tier Badge */}
              <div className="relative">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                    plan === "plus"
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                      : "bg-gray-100 text-gray-700 border border-gray-300"
                  }`}
                  onMouseEnter={() => plan === "free" && setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  {plan === "plus" ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Plus
                    </>
                  ) : (
                    "Free"
                  )}
                </span>
                {/* Tooltip for Free plan */}
                {plan === "free" && showTooltip && (
                  <div className="absolute left-0 top-full mt-2 w-64 z-50 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-gray-900 mb-1">Upgrade to Plus</p>
                        <p className="text-xs text-gray-600">
                          Get unlimited storage, multiple nominees, unlimited members, and priority support.
                        </p>
                      </div>
                    </div>
                    <div className="absolute -top-1 left-4 w-2 h-2 rotate-45 bg-white border-l border-t border-gray-200"></div>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Review your account details, security settings, and activity.
            </p>
          </div>
          {/* Upgrade CTA Button */}
          {plan === "free" && (
            <button
              onClick={() => {
                router.push("/#pricing");
              }}
              className="ml-4 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Upgrade to Plus
            </button>
          )}
        </div>
      </header>

      {/* Profile Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-gray-600" />
          Profile Information
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Email Address</p>
              <p className="text-sm font-medium text-gray-900">{accountData.profile.email}</p>
              {accountData.security.emailVerified ? (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-[10px] text-green-600 font-medium">Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <XCircle className="w-3 h-3 text-amber-600" />
                  <span className="text-[10px] text-amber-600 font-medium">Not verified</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Phone Number</p>
              <p className="text-sm font-medium text-gray-900">
                {accountData.profile.phone || "Not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Full Name</p>
              <p className="text-sm font-medium text-gray-900">
                {accountData.profile.fullName || "Not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Account Created</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(accountData.profile.accountCreatedAt)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Contact Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-gray-600" />
          Emergency Contact
        </h2>
        {accountData.emergencyContact ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {accountData.emergencyContact.name}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-900">
                  {accountData.emergencyContact.email || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <p className="text-sm font-medium text-gray-900">
                  {accountData.emergencyContact.phone || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Access Trigger</p>
                <p className="text-sm font-medium text-gray-900">
                  After {accountData.emergencyContact.accessTriggerDays} days of inactivity
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              No emergency contact configured. Add a nominee in your vault to set up emergency access.
            </p>
          </div>
        )}
      </section>

      {/* Security Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-600" />
          Security & Zero-Knowledge Posture
        </h2>
        
        <div className="space-y-4">
          {/* Security Indicators */}
          <div className="grid gap-3 md:grid-cols-2">
            <SecurityIndicator
              label="Email Verification"
              value={accountData.security.emailVerified}
              detail={accountData.security.emailVerifiedAt ? `Verified on ${formatDate(accountData.security.emailVerifiedAt)}` : "Not verified"}
            />
            <SecurityIndicator
              label="Device Binding"
              value={accountData.security.deviceBinding.enabled}
              detail={
                accountData.security.deviceBinding.enabled
                  ? `${accountData.security.deviceBinding.trustedDevicesCount} trusted device${accountData.security.deviceBinding.trustedDevicesCount !== 1 ? 's' : ''}`
                  : "Not configured - devices will be added after authorization"
              }
            />
            <SecurityIndicator
              label="Account Password Changed"
              value={accountData.securityIndicators.hasPasswordChanged}
              detail={
                accountData.security.lastPasswordChange
                  ? `${formatRelativeTime(accountData.security.lastPasswordChange)} (${accountData.securityIndicators.daysSincePasswordChange} days ago)`
                  : accountData.securityIndicators.passwordShouldBeChangedBy
                  ? `Set during account creation. Should be changed within ${accountData.securityIndicators.daysUntilPasswordShouldChange} days (by ${formatDate(accountData.securityIndicators.passwordShouldBeChangedBy)})`
                  : `Set during account creation (${formatRelativeTime(accountData.profile.accountCreatedAt)})`
              }
            />
          </div>

          {/* Zero-Knowledge Architecture Details */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Key className="w-4 h-4 text-gray-600" />
              Zero-Knowledge Architecture
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1">Server Key Part B</p>
                <p className="text-sm font-medium text-gray-900">
                  Version {accountData.security.serverKeyPartB.version}
                </p>
                {accountData.security.serverKeyPartB.encryptedAt && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Encrypted {formatRelativeTime(accountData.security.serverKeyPartB.encryptedAt)}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500 mb-1">Vault Setup</p>
                <p className="text-sm font-medium text-gray-900">
                  {accountData.security.vaultSetup.completed ? "Completed" : "Incomplete"}
                </p>
                {accountData.security.vaultSetup.completedAt && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Completed {formatRelativeTime(accountData.security.vaultSetup.completedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Last Login */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500 mb-1">Last Sign-In</p>
                <p className="text-sm font-medium text-gray-900">
                  {accountData.security.lastLogin
                    ? `${formatRelativeTime(accountData.security.lastLogin)} (${accountData.securityIndicators.daysSinceLastLogin} days ago)`
                    : "Never"}
                </p>
                {accountData.security.lastLogin && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {formatDate(accountData.security.lastLogin)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted Devices */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-600" />
          Trusted Devices
        </h2>
        {devicesLoading ? (
          <p className="text-sm text-gray-600">Loading devices...</p>
        ) : trustedDevices.length > 0 ? (
          <div className="space-y-3">
            {trustedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-gray-400">
                    {getDeviceIcon(
                      device.userAgent?.includes("Mobile") || device.userAgent?.includes("Android") || device.userAgent?.includes("iPhone")
                        ? "Mobile"
                        : device.userAgent?.includes("Tablet") || device.userAgent?.includes("iPad")
                        ? "Tablet"
                        : "Desktop"
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{device.name}</p>
                    <p className="text-xs text-gray-600">
                      Last used {formatRelativeTime(device.lastUsedAt)} • {device.ipAddress || "IP not recorded"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeDevice(device.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Revoke device"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              No trusted devices. Devices will be added automatically after authorization.
            </p>
          </div>
        )}
      </section>

      {/* Vault Security Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-gray-600" />
          Vault Security
        </h2>
        <p className="text-xs text-gray-600 mb-4">
          Track master password and recovery key status for each vault. Rotate passwords and keys every 90 days for optimal security.
        </p>
        {vaultsSecurityLoading ? (
          <p className="text-sm text-gray-600">Loading vault security information...</p>
        ) : vaultsSecurity.length > 0 ? (
          <div className="space-y-4">
            {vaultsSecurity.map((vault) => (
              <div
                key={vault.vaultId}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4"
              >
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{vault.vaultName}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    {vault.masterPassword.needsRotation ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    ) : vault.masterPassword.hasVerifier ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900 mb-1">Master Password</p>
                      {vault.masterPassword.hasVerifier ? (
                        <>
                          <p className="text-[10px] text-gray-600">
                            {vault.masterPassword.lastChanged
                              ? `Changed ${formatRelativeTime(vault.masterPassword.lastChanged)}`
                              : "Set up"}
                          </p>
                          {vault.masterPassword.daysSinceChange !== null && (
                            <p className="text-[10px] text-gray-500 mt-1">
                              {vault.masterPassword.daysSinceChange} days ago
                              {vault.masterPassword.needsRotation && (
                                <span className="text-amber-600 ml-1 font-medium">• Needs rotation</span>
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-600">Not set up</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {vault.recoveryKey.needsRotation ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    ) : vault.recoveryKey.hasRecoveryKey ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-900 mb-1">Recovery Key</p>
                      {vault.recoveryKey.hasRecoveryKey ? (
                        <>
                          <p className="text-[10px] text-gray-600">
                            {vault.recoveryKey.generatedAt
                              ? `Generated ${formatRelativeTime(vault.recoveryKey.generatedAt)}`
                              : "Generated"}
                          </p>
                          {vault.recoveryKey.daysSinceGeneration !== null && (
                            <p className="text-[10px] text-gray-500 mt-1">
                              {vault.recoveryKey.daysSinceGeneration} days ago
                              {vault.recoveryKey.needsRotation && (
                                <span className="text-amber-600 ml-1 font-medium">• Needs rotation</span>
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-gray-600">Not generated</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              No vaults found. Create a vault to start tracking vault-level security.
            </p>
          </div>
        )}
      </section>

      {/* Recent Sign-Ins */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-soft">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-gray-600" />
          Recent Sign-Ins
        </h2>
        {accountData.recentLogins.length > 0 ? (
          <div className="space-y-3">
            {accountData.recentLogins.map((login) => (
              <div
                key={login.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-gray-400">
                    {getDeviceIcon(login.device)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {login.os} • {login.browser}
                    </p>
                    <p className="text-xs text-gray-600">
                      {login.device} • {login.ipAddress || "IP not recorded"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-600">
                    {formatRelativeTime(login.timestamp)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {formatDate(login.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm text-gray-600">No recent sign-ins recorded.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function SecurityIndicator({
  label,
  value,
  detail,
}: {
  label: string;
  value: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {value ? (
        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <p className="text-xs font-medium text-gray-900 mb-1">{label}</p>
        <p className="text-[10px] text-gray-600">{detail}</p>
      </div>
    </div>
  );
}

