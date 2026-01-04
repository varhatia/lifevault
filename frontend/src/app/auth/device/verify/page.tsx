"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function DeviceVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const verifyDevice = async () => {
      const token = searchParams.get("token");
      const fingerprint = searchParams.get("fingerprint");

      if (!token || !fingerprint) {
        setStatus("error");
        setMessage("Invalid verification link. Missing token or device fingerprint.");
        return;
      }

      try {
        const res = await fetch(
          `/api/auth/device/verify?token=${token}&fingerprint=${fingerprint}`
        );

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setMessage(data.error || "Failed to verify device authorization");
          return;
        }

        setStatus("success");
        setMessage("Device authorized successfully! You can now log in from this device.");

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/auth/login");
        }, 3000);
      } catch (error) {
        console.error("Device verification error:", error);
        setStatus("error");
        setMessage("An unexpected error occurred. Please try again.");
      }
    };

    verifyDevice();
  }, [searchParams, router]);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-brand-400 animate-spin" />
            <p className="text-sm text-slate-300">Verifying device authorization...</p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <h2 className="text-lg font-semibold text-white">Device Authorized</h2>
            <p className="text-sm text-slate-300 text-center">{message}</p>
            <p className="text-xs text-slate-400 text-center">
              Redirecting to login page...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-red-400" />
            <h2 className="text-lg font-semibold text-white">Verification Failed</h2>
            <p className="text-sm text-slate-300 text-center">{message}</p>
            <button
              onClick={() => router.push("/auth/login")}
              className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

