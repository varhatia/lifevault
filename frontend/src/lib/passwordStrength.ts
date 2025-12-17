/**
 * Password strength evaluation utility
 * Validates password against strong requirements and checks for personal information
 */

export type PasswordRequirement = {
  met: boolean;
  message: string;
};

export type PasswordStrengthResult = {
  score: number; // 0-8
  label: string; // "Weak" | "Fair" | "Good" | "Strong"
  color: string; // Tailwind color class
  percentage: number; // 0-100
  requirements: PasswordRequirement[];
  isValid: boolean; // true if all requirements are met
};

/**
 * Evaluates password strength and checks against requirements
 * @param password - The password to evaluate
 * @param personalInfo - Optional object containing user's personal information to check against
 * @returns PasswordStrengthResult with score, label, color, and requirements
 */
export function evaluatePasswordStrength(
  password: string,
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  }
): PasswordStrengthResult {
  const requirements: PasswordRequirement[] = [];
  let score = 0;

  // Requirement 1: Minimum 12 characters
  const hasMinLength = password.length >= 12;
  requirements.push({
    met: hasMinLength,
    message: "At least 12 characters",
  });
  if (hasMinLength) {
    score += 2;
  } else if (password.length >= 8) {
    score += 1; // Partial credit for 8-11 chars
  }

  // Requirement 2: Uppercase letter
  const hasUppercase = /[A-Z]/.test(password);
  requirements.push({
    met: hasUppercase,
    message: "At least one uppercase letter",
  });
  if (hasUppercase) score += 1;

  // Requirement 3: Lowercase letter
  const hasLowercase = /[a-z]/.test(password);
  requirements.push({
    met: hasLowercase,
    message: "At least one lowercase letter",
  });
  if (hasLowercase) score += 1;

  // Requirement 4: Number
  const hasNumber = /[0-9]/.test(password);
  requirements.push({
    met: hasNumber,
    message: "At least one number",
  });
  if (hasNumber) score += 1;

  // Requirement 5: Symbol/special character
  const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  requirements.push({
    met: hasSymbol,
    message: "At least one symbol (!@#$%^&*...)",
  });
  if (hasSymbol) score += 1;

  // Requirement 6: No personal information
  let containsPersonalInfo = false;
  if (personalInfo) {
    const lowerPassword = password.toLowerCase();
    
    if (personalInfo.name) {
      const nameParts = personalInfo.name.toLowerCase().split(/\s+/);
      for (const part of nameParts) {
        if (part.length >= 3 && lowerPassword.includes(part)) {
          containsPersonalInfo = true;
          break;
        }
      }
    }
    
    if (personalInfo.email) {
      const emailLocal = personalInfo.email.toLowerCase().split("@")[0];
      if (emailLocal.length >= 3 && lowerPassword.includes(emailLocal)) {
        containsPersonalInfo = true;
      }
    }
    
    if (personalInfo.phone) {
      // Remove + and spaces from phone for comparison
      const phoneDigits = personalInfo.phone.replace(/[+\s-]/g, "");
      if (phoneDigits.length >= 4 && password.includes(phoneDigits)) {
        containsPersonalInfo = true;
      }
    }
  }
  
  requirements.push({
    met: !containsPersonalInfo,
    message: "Does not contain your name, email, or phone number",
  });
  if (!containsPersonalInfo) score += 1;

  // Bonus points for length beyond minimum
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  // Cap score at 8
  score = Math.min(score, 8);

  // Determine label and color
  let label: string;
  let color: string;
  let percentage: number;

  if (score <= 2) {
    label = "Weak";
    color = "red";
    percentage = 25;
  } else if (score <= 4) {
    label = "Fair";
    color = "orange";
    percentage = 50;
  } else if (score <= 6) {
    label = "Good";
    color = "yellow";
    percentage = 75;
  } else {
    label = "Strong";
    color = "green";
    percentage = 100;
  }

  // Check if all requirements are met
  const isValid = requirements.every((req) => req.met);

  return {
    score,
    label,
    color,
    percentage,
    requirements,
    isValid,
  };
}

