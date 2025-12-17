"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { evaluatePasswordStrength } from "@/lib/passwordStrength";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Evaluate password strength in real-time
  const passwordStrength = useMemo(() => {
    if (!password) {
      return null;
    }
    return evaluatePasswordStrength(password, {
      name: fullName,
      email,
      phone,
    });
  }, [password, fullName, email, phone]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Invalid email format");
      return;
    }

    // Validate phone number format (if provided)
    if (phone) {
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        setError("Phone number must be in international format (e.g., +1234567890)");
        return;
      }
    }

    // Validate date of birth (if provided)
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) {
        setError("Invalid date of birth");
        return;
      }

      // Check if user is at least 18 years old
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const dayDiff = today.getDate() - dob.getDate();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

      if (actualAge < 18) {
        setError("You must be at least 18 years old to create an account");
        return;
      }
    }

    // Validate password strength
    if (!passwordStrength || !passwordStrength.isValid) {
      const unmetRequirements = passwordStrength?.requirements
        .filter((req) => !req.met)
        .map((req) => req.message)
        .join(", ") || "Password does not meet requirements";
      setError(`Password requirements not met: ${unmetRequirements}`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email, 
          password, 
          fullName,
          phone: phone || undefined,
          dateOfBirth: dateOfBirth || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to sign up");
        return;
      }

      // On success, redirect to email verification pending page
      router.push(`/auth/verify-email-pending?email=${encodeURIComponent(email)}`);
    } catch (err) {
      console.error("Signup error:", err);
      setError("Unexpected error during signup");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-xs text-slate-300">
          This account identifies you on the server. Your vault contents are still
          encrypted end-to-end with a master password you’ll enter on first use.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="Ada Lovelace"
          />
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="+1234567890"
          />
          <p className="text-[10px] text-slate-400 mt-1">International format with country code (optional)</p>
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Date of Birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
          />
          <p className="text-[10px] text-slate-400 mt-1">Must be 18 years or older (optional)</p>
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            placeholder="At least 12 characters with mixed case, numbers, and symbols"
            required
          />
          
          {/* Password Strength Indicator */}
          {password && passwordStrength && (
            <div className="mt-2 space-y-2">
              {/* Strength Bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordStrength.color === "red"
                        ? "bg-red-500"
                        : passwordStrength.color === "orange"
                        ? "bg-orange-500"
                        : passwordStrength.color === "yellow"
                        ? "bg-yellow-500"
                        : "bg-green-500"
                    }`}
                    style={{ width: `${passwordStrength.percentage}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    passwordStrength.color === "red"
                      ? "text-red-400"
                      : passwordStrength.color === "orange"
                      ? "text-orange-400"
                      : passwordStrength.color === "yellow"
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {passwordStrength.label}
                </span>
              </div>

              {/* Requirements Checklist */}
              <div className="space-y-1">
                {passwordStrength.requirements.map((req, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[10px]">
                    <span className={req.met ? "text-green-400" : "text-slate-500"}>
                      {req.met ? "✓" : "○"}
                    </span>
                    <span className={req.met ? "text-slate-300" : "text-slate-500"}>
                      {req.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1 text-xs">
          <label className="block text-slate-200">Confirm password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none"
            required
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading || (passwordStrength ? !passwordStrength.isValid : false)}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating account..." : "Sign up"}
        </button>

        <p className="text-xs text-slate-400">
          Already have an account?{" "}
          <a href="/auth/login" className="text-brand-400 hover:text-brand-300">
            Log in
          </a>
        </p>
      </form>
    </div>
  );
}


