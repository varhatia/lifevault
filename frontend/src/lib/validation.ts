/**
 * Validation utilities for document fields
 */

// Aadhaar: 12 digits, no spaces or dashes
export function validateAadhaar(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Aadhaar number is required" };
  const cleaned = value.replace(/\s|-/g, "");
  if (!/^\d{12}$/.test(cleaned)) {
    return { valid: false, error: "Aadhaar must be exactly 12 digits" };
  }
  return { valid: true };
}

// PAN: Format ABCDE1234F (5 letters, 4 digits, 1 letter)
export function validatePAN(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "PAN number is required" };
  const cleaned = value.replace(/\s|-/g, "").toUpperCase();
  if (!/^[A-Z]{5}\d{4}[A-Z]{1}$/.test(cleaned)) {
    return { valid: false, error: "PAN must be in format ABCDE1234F (5 letters, 4 digits, 1 letter)" };
  }
  return { valid: true };
}

// Passport: Alphanumeric, typically 6-9 characters (varies by country)
// For Indian passports: 8 alphanumeric characters
export function validatePassport(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Passport number is required" };
  const cleaned = value.replace(/\s|-/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6,9}$/.test(cleaned)) {
    return { valid: false, error: "Passport number must be 6-9 alphanumeric characters" };
  }
  return { valid: true };
}

// Bank Account Number: Typically 9-18 digits
export function validateBankAccount(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Account number is required" };
  const cleaned = value.replace(/\s|-/g, "");
  if (!/^\d{9,18}$/.test(cleaned)) {
    return { valid: false, error: "Account number must be 9-18 digits" };
  }
  return { valid: true };
}

// IFSC Code: Format ABCD0123456 (4 letters, 0, 6 digits)
export function validateIFSC(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "IFSC code is required" };
  const cleaned = value.replace(/\s|-/g, "").toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned)) {
    return { valid: false, error: "IFSC must be in format ABCD0123456 (4 letters, 0, 6 alphanumeric)" };
  }
  return { valid: true };
}

// Policy Number: Alphanumeric, typically 8-20 characters
export function validatePolicyNumber(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Policy number is required" };
  const cleaned = value.replace(/\s|-/g, "").toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(cleaned)) {
    return { valid: false, error: "Policy number must be 8-20 alphanumeric characters" };
  }
  return { valid: true };
}

// Loan Account Number: Typically 10-20 alphanumeric characters
export function validateLoanAccount(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Loan account number is required" };
  const cleaned = value.replace(/\s|-/g, "").toUpperCase();
  if (!/^[A-Z0-9]{10,20}$/.test(cleaned)) {
    return { valid: false, error: "Loan account number must be 10-20 alphanumeric characters" };
  }
  return { valid: true };
}

// Credit Card Number: 13-19 digits (Luhn algorithm would be ideal but basic format check for now)
export function validateCreditCard(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Card number is required" };
  const cleaned = value.replace(/\s|-/g, "");
  if (!/^\d{13,19}$/.test(cleaned)) {
    return { valid: false, error: "Card number must be 13-19 digits" };
  }
  return { valid: true };
}

// Email validation
export function validateEmail(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Email is required" };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { valid: false, error: "Please enter a valid email address" };
  }
  return { valid: true };
}

// Phone number: 10 digits (for Indian numbers)
export function validatePhone(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Phone number is required" };
  const cleaned = value.replace(/\s|-|\(|\)/g, "");
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: "Phone number must be exactly 10 digits" };
  }
  return { valid: true };
}

// Date validation (YYYY-MM-DD or DD/MM/YYYY)
export function validateDate(value: string, fieldName?: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Date is required" };
  const dateRegex = /^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/;
  if (!dateRegex.test(value)) {
    return { valid: false, error: "Date must be in format YYYY-MM-DD or DD/MM/YYYY" };
  }
  
  // For expiry/valid dates, check if date is greater than current date
  const lowerField = (fieldName || "").toLowerCase();
  if (lowerField.includes("expiry") || lowerField.includes("valid") || lowerField.includes("renewal")) {
    let dateValue: Date;
    if (value.includes("/")) {
      // DD/MM/YYYY format
      const [day, month, year] = value.split("/");
      dateValue = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      // Validate the date is valid (handles invalid dates like 32/13/2024)
      if (dateValue.getDate() !== parseInt(day) || dateValue.getMonth() !== parseInt(month) - 1 || dateValue.getFullYear() !== parseInt(year)) {
        return { valid: false, error: "Please enter a valid date" };
      }
    } else {
      // YYYY-MM-DD format
      dateValue = new Date(value);
      // Validate the date is valid
      if (isNaN(dateValue.getTime())) {
        return { valid: false, error: "Please enter a valid date" };
      }
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateValue.setHours(0, 0, 0, 0);
    if (dateValue <= today) {
      return { valid: false, error: "Date must be greater than today" };
    }
  }
  
  return { valid: true };
}

// Amount validation (positive number)
export function validateAmount(value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Amount is required" };
  const cleaned = value.replace(/,/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num) || num < 0) {
    return { valid: false, error: "Please enter a valid positive amount" };
  }
  return { valid: true };
}

// Get validation function for a field based on field name and document type
export function getFieldValidator(
  fieldName: string,
  documentType: string
): ((value: string) => { valid: boolean; error?: string }) | null {
  const lowerField = fieldName.toLowerCase();
  const lowerType = documentType.toLowerCase();

  // Date fields - check FIRST before document type checks to avoid conflicts
  if (lowerField.includes("date") || lowerField.includes("expiry") || lowerField.includes("renewal") || lowerField.includes("valid")) {
    return (value: string) => validateDate(value, fieldName);
  }

  // Aadhaar - check both field name and document type
  if (lowerField.includes("aadhaar") || lowerField.includes("aadhar") || lowerType === "aadhaar") {
    return validateAadhaar;
  }

  // PAN - check both field name and document type
  if (lowerField.includes("pan") || lowerType === "pan") {
    return validatePAN;
  }

  // Passport - check both field name and document type (but only for number field, not expiry)
  if ((lowerField.includes("passport") || lowerType === "passport") && !lowerField.includes("expiry") && !lowerField.includes("date")) {
    return validatePassport;
  }

  // For generic "number" field, check document type first (before other number checks)
  if (lowerField === "number") {
    if (lowerType === "aadhaar") {
      return validateAadhaar;
    }
    if (lowerType === "pan") {
      return validatePAN;
    }
    if (lowerType === "passport") {
      return validatePassport;
    }
  }

  // Bank Account - check document type or field name (but exclude accountType dropdown)
  if (lowerType === "bank-account" && (lowerField === "number" || (lowerField.includes("account") && !lowerField.includes("accounttype")))) {
    return validateBankAccount;
  }
  if (lowerField.includes("account") && (lowerField.includes("number") || lowerField.includes("no")) && !lowerField.includes("accounttype")) {
    return validateBankAccount;
  }

  // IFSC
  if (lowerField.includes("ifsc")) {
    return validateIFSC;
  }

  // Policy Number - check document type or field name
  if ((lowerType.includes("insurance") || lowerType.includes("term-life") || lowerType.includes("health") || lowerType.includes("vehicle") || lowerType.includes("home")) && lowerField === "policynumber") {
    return validatePolicyNumber;
  }
  if (lowerField.includes("policy") && (lowerField.includes("number") || lowerField.includes("no"))) {
    return validatePolicyNumber;
  }

  // Loan Account
  if (lowerField.includes("loan") && (lowerField.includes("account") || lowerField.includes("number"))) {
    return validateLoanAccount;
  }

  // Credit Card
  if (lowerField.includes("card") && (lowerField.includes("number") || lowerField.includes("no"))) {
    return validateCreditCard;
  }

  // Email (but exclude usernameEmail which can be email or alphanumeric)
  if (lowerField.includes("email") && !lowerField.includes("usernameemail")) {
    return validateEmail;
  }

  // Phone
  if (lowerField.includes("phone") || lowerField.includes("mobile")) {
    return validatePhone;
  }

  // Amount fields (but exclude coverageType dropdown)
  if ((lowerField.includes("amount") || lowerField.includes("outstanding")) && !lowerField.includes("coveragetype")) {
    return validateAmount;
  }
  // Coverage amount (not coverage type)
  if (lowerField.includes("coverage") && (lowerField.includes("amount") || lowerField.includes("value")) && !lowerField.includes("coveragetype")) {
    return validateAmount;
  }

  return null;
}

