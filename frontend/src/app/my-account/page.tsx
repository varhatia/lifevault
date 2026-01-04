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
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm text-slate-400">Loading account information...</p>
        </div>
      </div>
    );
  }

  if (error || !accountData) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-red-500/50 bg-red-500/5 p-6">
          <p className="text-sm text-red-400">
            {error || "Failed to load account information"}
          </p>
          <button
            onClick={loadAccountData}
            className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-white">My Account</h1>
        <p className="mt-1 text-xs text-slate-300">
          Review your account details, security settings, and activity.
        </p>
      </header>

      {/* Profile Section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Information
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400 mb-1">Email Address</p>
              <p className="text-sm font-medium text-white">{accountData.profile.email}</p>
              {accountData.security.emailVerified ? (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-[10px] text-green-400">Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <XCircle className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-amber-400">Not verified</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400 mb-1">Phone Number</p>
              <p className="text-sm font-medium text-white">
                {accountData.profile.phone || "Not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400 mb-1">Full Name</p>
              <p className="text-sm font-medium text-white">
                {accountData.profile.fullName || "Not provided"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
            <div>
              <p className="text-xs text-slate-400 mb-1">Account Created</p>
              <p className="text-sm font-medium text-white">
                {formatDate(accountData.profile.accountCreatedAt)}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Emergency Contact Section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5" />
          Emergency Contact
        </h2>
        {accountData.emergencyContact ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400 mb-1">Name</p>
                <p className="text-sm font-medium text-white">
                  {accountData.emergencyContact.name}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400 mb-1">Email</p>
                <p className="text-sm font-medium text-white">
                  {accountData.emergencyContact.email || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400 mb-1">Phone</p>
                <p className="text-sm font-medium text-white">
                  {accountData.emergencyContact.phone || "Not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400 mb-1">Access Trigger</p>
                <p className="text-sm font-medium text-white">
                  After {accountData.emergencyContact.accessTriggerDays} days of inactivity
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-400">
              No emergency contact configured. Add a nominee in your vault to set up emergency access.
            </p>
          </div>
        )}
      </section>

      {/* Security Section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
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
          <div className="mt-6 pt-4 border-t border-slate-800">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Key className="w-4 h-4" />
              Zero-Knowledge Architecture
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400 mb-1">Server Key Part B</p>
                <p className="text-sm font-medium text-white">
                  Version {accountData.security.serverKeyPartB.version}
                </p>
                {accountData.security.serverKeyPartB.encryptedAt && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Encrypted {formatRelativeTime(accountData.security.serverKeyPartB.encryptedAt)}
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-xs text-slate-400 mb-1">Vault Setup</p>
                <p className="text-sm font-medium text-white">
                  {accountData.security.vaultSetup.completed ? "Completed" : "Incomplete"}
                </p>
                {accountData.security.vaultSetup.completedAt && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Completed {formatRelativeTime(accountData.security.vaultSetup.completedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Last Login */}
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-400 mb-1">Last Sign-In</p>
                <p className="text-sm font-medium text-white">
                  {accountData.security.lastLogin
                    ? `${formatRelativeTime(accountData.security.lastLogin)} (${accountData.securityIndicators.daysSinceLastLogin} days ago)`
                    : "Never"}
                </p>
                {accountData.security.lastLogin && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formatDate(accountData.security.lastLogin)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted Devices */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Trusted Devices
        </h2>
        {devicesLoading ? (
          <p className="text-sm text-slate-400">Loading devices...</p>
        ) : trustedDevices.length > 0 ? (
          <div className="space-y-3">
            {trustedDevices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-slate-400">
                    {getDeviceIcon(
                      device.userAgent?.includes("Mobile") || device.userAgent?.includes("Android") || device.userAgent?.includes("iPhone")
                        ? "Mobile"
                        : device.userAgent?.includes("Tablet") || device.userAgent?.includes("iPad")
                        ? "Tablet"
                        : "Desktop"
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{device.name}</p>
                    <p className="text-xs text-slate-400">
                      Last used {formatRelativeTime(device.lastUsedAt)} • {device.ipAddress || "IP not recorded"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => revokeDevice(device.id)}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Revoke device"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-400">
              No trusted devices. Devices will be added automatically after authorization.
            </p>
          </div>
        )}
      </section>

      {/* Vault Security Section */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Key className="w-5 h-5" />
          Vault Security
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Track master password and recovery key status for each vault. Rotate passwords and keys every 90 days for optimal security.
        </p>
        {vaultsSecurityLoading ? (
          <p className="text-sm text-slate-400">Loading vault security information...</p>
        ) : vaultsSecurity.length > 0 ? (
          <div className="space-y-4">
            {vaultsSecurity.map((vault) => (
              <div
                key={vault.vaultId}
                className="rounded-lg border border-slate-800 bg-slate-900/40 p-4"
              >
                <h3 className="text-sm font-semibold text-white mb-3">{vault.vaultName}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex items-start gap-3">
                    {vault.masterPassword.needsRotation ? (
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : vault.masterPassword.hasVerifier ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-white mb-1">Master Password</p>
                      {vault.masterPassword.hasVerifier ? (
                        <>
                          <p className="text-[10px] text-slate-400">
                            {vault.masterPassword.lastChanged
                              ? `Changed ${formatRelativeTime(vault.masterPassword.lastChanged)}`
                              : "Set up"}
                          </p>
                          {vault.masterPassword.daysSinceChange !== null && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              {vault.masterPassword.daysSinceChange} days ago
                              {vault.masterPassword.needsRotation && (
                                <span className="text-amber-400 ml-1">• Needs rotation</span>
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-400">Not set up</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    {vault.recoveryKey.needsRotation ? (
                      <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    ) : vault.recoveryKey.hasRecoveryKey ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs font-medium text-white mb-1">Recovery Key</p>
                      {vault.recoveryKey.hasRecoveryKey ? (
                        <>
                          <p className="text-[10px] text-slate-400">
                            {vault.recoveryKey.generatedAt
                              ? `Generated ${formatRelativeTime(vault.recoveryKey.generatedAt)}`
                              : "Generated"}
                          </p>
                          {vault.recoveryKey.daysSinceGeneration !== null && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              {vault.recoveryKey.daysSinceGeneration} days ago
                              {vault.recoveryKey.needsRotation && (
                                <span className="text-amber-400 ml-1">• Needs rotation</span>
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[10px] text-slate-400">Not generated</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-400">
              No vaults found. Create a vault to start tracking vault-level security.
            </p>
          </div>
        )}
      </section>

      {/* Recent Sign-Ins */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5" />
          Recent Sign-Ins
        </h2>
        {accountData.recentLogins.length > 0 ? (
          <div className="space-y-3">
            {accountData.recentLogins.map((login) => (
              <div
                key={login.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="text-slate-400">
                    {getDeviceIcon(login.device)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {login.os} • {login.browser}
                    </p>
                    <p className="text-xs text-slate-400">
                      {login.device} • {login.ipAddress || "IP not recorded"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">
                    {formatRelativeTime(login.timestamp)}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatDate(login.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <p className="text-sm text-slate-400">No recent sign-ins recorded.</p>
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
    <div className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      {value ? (
        <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
      )}
      <div>
        <p className="text-xs font-medium text-white mb-1">{label}</p>
        <p className="text-[10px] text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

