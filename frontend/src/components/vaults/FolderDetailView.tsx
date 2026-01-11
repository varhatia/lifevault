"use client";

import { useState, useEffect } from "react";
import { X, Check, Plus, MoreVertical, ArrowRight, Edit2, Trash2, Download, CheckCircle2, Info } from "lucide-react";
import { CategoryConfig, CategoryPriority } from "./types";
import { encryptFile } from "@/lib/crypto";
import { getFieldValidator } from "@/lib/validation";

type DocumentStatus = "uploaded" | "not-added";

type DocumentCard = {
  id: string;
  type: string;
  status: DocumentStatus;
  title: string;
  fields?: Record<string, any>;
  template?: {
    type: string;
    label: string;
    required: boolean;
    fields: FieldDefinition[];
    helpText?: string;
  };
  item?: {
    id: string;
    category: string;
    title: string;
    tags: string[];
    s3Key?: string | null;
    iv?: string | null;
    encryptedMetadata?: string | null;
    createdAt?: string;
    updatedAt?: string;
    creator?: {
      id: string;
      email: string;
      fullName: string | null;
    };
  };
};

type FolderDetailViewProps = {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryConfig;
  vaultId: string;
  vaultType: "my_vault" | "family_vault";
  items: Array<{
    id: string;
    category: string;
    title: string;
    tags: string[];
    s3Key?: string | null;
    iv?: string | null;
    encryptedMetadata?: string | null; // Base64 encoded encrypted metadata
    createdAt?: string;
    updatedAt?: string;
    creator?: {
      id: string;
      email: string;
      fullName: string | null;
    };
  }>;
  onAddDocument: (documentType: string, fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>;
  onEditDocument: (itemId: string, documentType: string, fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>;
  onDeleteDocument: (itemId: string) => Promise<void>;
  onDownloadDocument?: (itemId: string) => Promise<void>;
  getVaultKey: () => Promise<CryptoKey | null>;
  onAddNominee?: () => void;
  nominees?: Array<{
    id: string;
    nomineeName: string;
    nomineeEmail: string | null;
    nomineePhone: string | null;
    accessTriggerDays: number;
    isActive: boolean;
  }>;
  onRefresh?: () => void; // Callback to refresh items after edit/delete
  reviewMode?: boolean; // Whether this view is opened from review modal
  onItemReviewed?: (itemId: string) => void; // Callback when an item is marked as reviewed
  reviewedItems?: Set<string>; // Set of item IDs that have been reviewed
  onCloseAndReturnToReview?: () => void; // Callback to close and return to review modal
};

// Helper function to render a field based on its definition
function renderField(
  field: FieldDefinition,
  value: any,
  onChange: (value: any) => void,
  fieldErrors: Record<string, string>,
  documentType: string,
  allFields: Record<string, any>
) {
  const hasError = !!fieldErrors[field.name];
  const baseInputClasses = `w-full px-3 py-2 bg-white border rounded-lg text-gray-900 text-sm focus:outline-none ${
    hasError 
      ? "border-red-500 focus:border-red-500" 
      : "border-gray-300 focus:border-brand-500"
  }`;

  switch (field.type) {
    case "dropdown":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClasses}
          required={field.required}
          aria-label={field.label}
        >
          <option value="">Select {field.label}</option>
          {field.options?.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );

    case "textarea":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClasses}
          rows={3}
          placeholder={field.placeholder}
          required={field.required}
        />
      );

    case "yes-no-notsure":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClasses}
          required={field.required}
          aria-label={field.label}
        >
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
          <option value="Not Sure">Not Sure</option>
        </select>
      );

    case "file":
      return (
        <input
          type="file"
          onChange={(e) => onChange(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white [&::file-selector-button]:hidden"
          required={field.required}
          aria-label={field.label}
        />
      );

    default: // text
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseInputClasses} ${field.readOnly ? "opacity-60 cursor-not-allowed" : ""}`}
          placeholder={field.placeholder || `Enter ${field.label}`}
          required={field.required}
          readOnly={field.readOnly}
          disabled={field.readOnly}
        />
      );
  }
}

// Enhanced field definition type
type FieldDefinition = {
  name: string;
  type: "text" | "dropdown" | "textarea" | "file" | "yes-no-notsure";
  label: string;
  required?: boolean;
  options?: string[]; // For dropdown
  placeholder?: string;
  helpText?: string;
  readOnly?: boolean; // For frozen/pre-filled fields
  defaultValue?: string; // Default value for the field
  conditionalFields?: {
    condition: string; // Field name to check
    value: string | string[]; // Value(s) that trigger this
    fields: FieldDefinition[];
  };
  showWhen?: {
    field: string; // Field name to check
    value: string | string[]; // Value(s) that show this field
  };
};

// Document templates with enhanced field definitions
export const DOCUMENT_TEMPLATES: Record<string, Array<{ 
  type: string; 
  label: string; 
  required: boolean; 
  fields: FieldDefinition[];
  helpText?: string;
}>> = {
  "identity-vital": [
    { 
      type: "aadhaar", 
      label: "Aadhaar", 
      required: true, 
      fields: [
        { name: "number", type: "text", label: "Aadhaar Number", required: true },
        { name: "additionalDetails", type: "textarea", label: "Additional Details", required: false, placeholder: "Add any required details if you wish"}, 
        { name: "pdf", type: "file", label: "Upload Document", required: true, helpText: "💡 Uploading the document helps your family access it quickly in an emergency" }
      ] 
    },
    { 
      type: "pan", 
      label: "PAN", 
      required: true, 
      fields: [
        { name: "number", type: "text", label: "PAN Number", required: true },
        { name: "additionalDetails", type: "textarea", label: "Additional Details", required: false, placeholder: "Add any required details if you wish"}, 
        { name: "pdf", type: "file", label: "Upload Document", required: true, helpText: "💡 Uploading the document helps your family access it quickly in an emergency" }
      ] 
    },
    { 
      type: "others-identity", 
      label: "Others (Recommended)", 
      required: false, 
      fields: [
        { 
          name: "documentType", 
          type: "dropdown", 
          label: "Type", 
          required: true,
          options: ["Birth Certificate", "Driving License", "Voter ID", "Passport", "Marriage Certificate", "Divorce Certificate", "Other"]
        },
        { name: "title", type: "text", label: "Title", required: false },
        { name: "number", type: "text", label: "Number", required: false },
        { 
          name: "details", 
          type: "textarea", 
          label: "Details", 
          required: false, 
          placeholder: "Add any required details if you wish"
        },
        { name: "pdf", type: "file", label: "Upload Document", required: true }
      ] 
    },
  ],
  "finance-investments": [
    { 
      type: "bank-account", 
      label: "Bank Account", 
      required: false, 
      fields: [
        { name: "bankName", type: "text", label: "Bank Name", required: true },
        { 
          name: "accountType", 
          type: "dropdown", 
          label: "Account Type", 
          required: true,
          options: ["Current", "Savings"]
        },
        { name: "last4Digits", type: "text", label: "Last 4 Digits", required: false },
        { 
          name: "hasNominee", 
          type: "yes-no-notsure", 
          label: "Has Nominee?", 
          required: true,
          conditionalFields: {
            condition: "hasNominee",
            value: "Yes",
            fields: [
              { name: "nomineeName", type: "text", label: "Nominee Name", required: true },
              { name: "nomineeRelationship", type: "text", label: "Relationship", required: true }
            ]
          }
        },
        { name: "notes", type: "textarea", label: "Notes for Family", required: false, placeholder: "Add any helpful information for your family" },
        { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
      ] 
    },
    { 
      type: "investment", 
      label: "Investment", 
      required: false, 
      fields: [
        { 
          name: "investmentType", 
          type: "dropdown", 
          label: "Investment Type", 
          required: true,
          options: ["Mutual Funds", "Stocks / Demat", "Retirement / Pension", "Bonds / Fixed Income", "Crypto / Digital Assets", "Other Investments"]
        },
        { name: "provider", type: "text", label: "Provider / Platform", required: true },
        { name: "accountFolio", type: "text", label: "Account / Folio (Optional)", required: false },
        { name: "hasNominee", type: "yes-no-notsure", label: "Nominee Added?", required: true },
        { name: "notes", type: "textarea", label: "Add a note for family", required: false, placeholder: "E.g. Reach out to Relationship manager Rajesh (phone)." },
        { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
      ] 
    },
    { 
      type: "tax-records", 
      label: "Tax Records", 
      required: false, 
      fields: [
        { 
          name: "financialYear", 
          type: "dropdown", 
          label: "Financial Year", 
          required: true,
          options: (() => {
            const currentYear = new Date().getFullYear();
            const options: string[] = [];
            // Generate last 30 financial years in descending order (e.g., 2023-2024, 2022-2023, ...)
            for (let i = 0; i < 30; i++) {
              const startYear = currentYear - i - 1;
              const endYear = currentYear - i;
              options.push(`${startYear}-${endYear}`);
            }
            return options;
          })()
        },
        { name: "additionalDetails", type: "textarea", label: "Additional Details", required: false, placeholder: "Add any required details if you wish" },
        { name: "form16", type: "file", label: "Upload Form 16", required: true },
        { name: "itr", type: "file", label: "Upload ITR", required: true }
      ] 
    },
  ],
  "insurance": [
    { 
      type: "life-term-insurance", 
      label: "Life / Term Insurance", 
      required: false, 
      fields: [
        { 
          name: "policyType", 
          type: "text", 
          label: "Policy Type", 
          required: true,
          defaultValue: "Life (Term)",
          readOnly: true
        },
        { name: "insurerName", type: "text", label: "Insurer Name", required: true },
        { name: "policyNumber", type: "text", label: "Policy Number", required: true },
        { name: "policyholderName", type: "text", label: "Policyholder Name", required: true },
        { name: "hasNominee", type: "yes-no-notsure", label: "Nominee Added?", required: true },
        { 
          name: "coverageType", 
          type: "dropdown", 
          label: "Coverage Type", 
          required: false, 
          options: ["Individual", "Family", "Not Applicable"]
        },
        { 
          name: "policyValidTill", 
          type: "text", 
          label: "Policy Valid Till", 
          required: false
        },
        { name: "notes", type: "textarea", label: "Add a note for family", required: false, placeholder: "E.g. Claim via LIC branch or online. Agent: Rajesh (phone)." },
        { name: "pdf", type: "file", label: "Upload Document", required: true }
      ] 
    },
    { 
      type: "health-insurance", 
      label: "Health Insurance", 
      required: false, 
      fields: [
        { 
          name: "policyType", 
          type: "text", 
          label: "Policy Type", 
          required: true,
          defaultValue: "Health",
          readOnly: true
        },
        { name: "insurerName", type: "text", label: "Insurer Name", required: true },
        { name: "policyNumber", type: "text", label: "Policy Number", required: true },
        { name: "policyholderName", type: "text", label: "Policyholder Name", required: true },
        { name: "hasNominee", type: "yes-no-notsure", label: "Nominee Added?", required: true },
        { 
          name: "coverageType", 
          type: "dropdown", 
          label: "Coverage Type", 
          required: false, 
          options: ["Individual", "Family", "Not Applicable"]
        },
        { 
          name: "policyValidTill", 
          type: "text", 
          label: "Policy Valid Till", 
          required: false
        },
        { name: "notes", type: "textarea", label: "Add a note for family", required: false, placeholder: "E.g. Claim via LIC branch or online. Agent: Rajesh (phone)." },
        { name: "pdf", type: "file", label: "Upload Document", required: true }
      ] 
    },
    { 
      type: "other-insurance", 
      label: "Others", 
      required: false, 
      fields: [
        { 
          name: "policyType", 
          type: "dropdown", 
          label: "Policy Type", 
          required: true,
          options: ["Vehicle", "Home / Property", "Accident / Disability", "Other Insurance"]
        },
        { name: "insurerName", type: "text", label: "Insurer Name", required: true },
        { name: "policyNumber", type: "text", label: "Policy Number", required: true },
        { name: "policyholderName", type: "text", label: "Policyholder Name", required: true },
        { name: "hasNominee", type: "yes-no-notsure", label: "Nominee Added?", required: true },
        { 
          name: "coverageType", 
          type: "dropdown", 
          label: "Coverage Type", 
          required: false, 
          options: ["Individual", "Family", "Not Applicable"]
        },
        { 
          name: "policyValidTill", 
          type: "text", 
          label: "Policy Valid Till", 
          required: false
        },
        { name: "notes", type: "textarea", label: "Add a note for family", required: false, placeholder: "E.g. Claim via LIC branch or online. Agent: Rajesh (phone)." },
        { name: "pdf", type: "file", label: "Upload Document", required: true }
      ] 
    },
  ],
  "loans-liabilities": [
    { type: "home-loan", label: "Home Loan", required: false, fields: [
      { name: "lender", type: "text", label: "Lender", required: true },
      { name: "totalAmount", type: "text", label: "Total Loan Amount", required: false },
      { name: "outstandingAmount", type: "text", label: "Outstanding Amount", required: false },
      { name: "emiDate", type: "text", label: "EMI Date", required: false },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
    ] },
    { type: "personal-loan", label: "Personal Loan", required: false, fields: [
      { name: "lender", type: "text", label: "Lender", required: true },
      { name: "totalAmount", type: "text", label: "Total Loan Amount", required: false },
      { name: "outstandingAmount", type: "text", label: "Outstanding Amount", required: false },
      { name: "emiDate", type: "text", label: "EMI Date", required: false },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
    ] },
    { type: "vehicle-loan", label: "Vehicle Loan", required: false, fields: [
      { name: "lender", type: "text", label: "Lender", required: true },
      { name: "totalAmount", type: "text", label: "Total Loan Amount", required: false },
      { name: "outstandingAmount", type: "text", label: "Outstanding Amount", required: false },
      { name: "emiDate", type: "text", label: "EMI Date", required: false },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
    ] },
    { type: "other-liability", label: "Other Liabilities", required: false, fields: [
      { name: "liabilityType", type: "text", label: "Liability Type", required: true },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
    ] },
  ],
  "legal-property": [
    { type: "property", label: "Property", required: false, fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "notes", type: "textarea", label: "Note", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
    ] },
    { type: "legal", label: "Legal", required: false, fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "notes", type: "textarea", label: "Note", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Recommended)", required: false }
    ] },
  ],
  "digital-assets": [
    { 
      type: "email-account", 
      label: "Email", 
      required: false, 
      fields: [
        { 
          name: "accountType", 
          type: "text", 
          label: "Type", 
          required: true,
          defaultValue: "Email",
          readOnly: true
        },
        { name: "platformName", type: "text", label: "Platform Name", required: true },
        { name: "usernameEmail", type: "text", label: "Username / Email (Optional)", required: false },
        { 
          name: "accessHints", 
          type: "textarea", 
          label: "Add access hints (Optional)", 
          required: false, 
          placeholder: "E.g. Recovery email: example@gmail.com, Security questions: Mother's maiden name"
        }
      ] 
    },
    { 
      type: "social-media", 
      label: "Social Media", 
      required: false, 
      fields: [
        { 
          name: "accountType", 
          type: "text", 
          label: "Type", 
          required: true,
          defaultValue: "Social Media",
          readOnly: true
        },
        { name: "platformName", type: "text", label: "Platform Name", required: true },
        { name: "usernameEmail", type: "text", label: "Username / Email (Optional)", required: false },
        { 
          name: "accessHints", 
          type: "textarea", 
          label: "Add access hints (Optional)", 
          required: false, 
          helpText: "We do not recommend storing passwords here. Leave instructions instead.",
          placeholder: "E.g. Recovery email: example@gmail.com, Security questions: Mother's maiden name"
        }
      ] 
    },
    { 
      type: "banking-app", 
      label: "Banking Apps", 
      required: false, 
      fields: [
        { 
          name: "accountType", 
          type: "text", 
          label: "Type", 
          required: true,
          defaultValue: "Banking App",
          readOnly: true
        },
        { name: "platformName", type: "text", label: "Platform Name", required: true },
        { name: "usernameEmail", type: "text", label: "Username / Email (Optional)", required: false },
        { 
          name: "accessHints", 
          type: "textarea", 
          label: "Add access hints (Optional)", 
          required: false, 
          helpText: "We do not recommend storing passwords here. Leave instructions instead.",
          placeholder: "E.g. Recovery email: example@gmail.com, Security questions: Mother's maiden name"
        }
      ] 
    },
    { 
      type: "investment-platform", 
      label: "Investment Platform", 
      required: false, 
      fields: [
        { 
          name: "accountType", 
          type: "text", 
          label: "Type", 
          required: true,
          defaultValue: "Finance / Investment Platform",
          readOnly: true
        },
        { name: "platformName", type: "text", label: "Platform Name", required: true },
        { name: "usernameEmail", type: "text", label: "Username / Email (Optional)", required: false },
        { 
          name: "accessHints", 
          type: "textarea", 
          label: "Add access hints (Optional)", 
          required: false, 
          helpText: "We do not recommend storing passwords here. Leave instructions instead.",
          placeholder: "E.g. Recovery email: example@gmail.com, Security questions: Mother's maiden name"
        }
      ] 
    },
    { 
      type: "other-digital", 
      label: "Other", 
      required: false, 
      fields: [
        { 
          name: "accountType", 
          type: "text", 
          label: "Type", 
          required: true,
          defaultValue: "Other",
          readOnly: true
        },
        { name: "platformName", type: "text", label: "Platform Name", required: true },
        { name: "usernameEmail", type: "text", label: "Username / Email (Optional)", required: false },
        { 
          name: "accessHints", 
          type: "textarea", 
          label: "Add access hints (Optional)", 
          required: false, 
          helpText: "We do not recommend storing passwords here. Leave instructions instead.",
          placeholder: "E.g. Recovery email: example@gmail.com, Security questions: Mother's maiden name"
        }
      ] 
    },
  ],
};

// Helper text for each section to guide users on what to add
const SECTION_HELPER_TEXTS: Record<string, string> = {
  // Identity & Vital Records
  "others-identity": "Add your other available Identify docs like Birth Certificate, Passport, Driving License, Voter ID, Marriage or Divorce Certificate.",
  
  // Finance & Investments
  "bank-account": "Add your main savings or salary account. Add any important joint accounts. Note down branch / relationship manager if relevant.",
  "investment": "Add your investment accounts like mutual funds, stocks, bonds, or other investment portfolios. Include account numbers and broker details.",
  "tax-records": "Add your tax records and returns. Include ITR documents, Form 16, and other tax-related documents for easy access during tax season.",
  
  // Insurance
  "life-term-insurance": "Add your life or term insurance policies. Include policy numbers, coverage amount, nominee details, and premium payment information.",
  "health-insurance": "Add your health insurance policies. Include policy numbers, coverage details, family members covered, and claim procedures.",
  "other-insurance": "Add other insurance policies like vehicle, home, travel, or any other insurance coverage you have.",
  
  // Loans & Liabilities
  "home-loan": "Add your home loan details including loan amount, outstanding balance, EMI details, lender information, and property address.",
  "personal-loan": "Add your personal loan details including loan amount, outstanding balance, EMI details, and lender information.",
  "vehicle-loan": "Add your vehicle loan details including loan amount, outstanding balance, EMI details, vehicle details, and lender information.",
  "credit-card": "Add your credit card details including card number (last 4 digits), credit limit, outstanding balance, and bank information.",
  "other-liability": "Add any other liabilities like education loans, business loans, or any other outstanding debts.",
  
  // Digital Assets
  "email-account": "Add your primary email accounts. Include recovery email addresses and note any important email accounts for account recovery.",
  "social-media": "Add your social media accounts like Facebook, Instagram, LinkedIn, Twitter, etc. Note any accounts that should be memorialized or closed.",
  "banking-app": "Add your banking app accounts and mobile banking details. Include app names, login methods, and any important transaction limits.",
  "investment-platform": "Add your investment platform accounts like Zerodha, Groww, Paytm Money, etc. Include account numbers and login details.",
  "other-digital": "Add any other digital accounts or apps that are important for your nominees to know about.",
  
  // Property & Legal
  "property": "Add your property documents like house ownership papers, land documents, rental agreements, or any property-related legal documents.",
  "legal": "Add your legal documents like wills, power of attorney, contracts, or any other important legal papers.",
};

const HELPER_TEXTS: Record<string, string> = {
  "identity-vital": "These documents are required for insurance claims, bank access, and legal processes.",
  "finance-investments": "This helps your family know where to start. Add more later.",
  "insurance": "In emergencies, this folder is the single most valuable for nominees. At least one term and health insurance policy is recommended.",
  "loans-liabilities": "Families often discover loans late → legal + credit issues.",
  "legal-property": "Even a simple will avoids confusion.",
  "digital-assets": "Online Accounts & Apps Details for Nominees. Would help with easy access and perform actions like Close/Transfer.",
};

export default function FolderDetailView({
  isOpen,
  onClose,
  category,
  vaultId,
  vaultType,
  items,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onDownloadDocument,
  getVaultKey,
  onAddNominee,
  nominees = [],
  onRefresh,
  reviewMode = false,
  onItemReviewed,
  reviewedItems = new Set(),
  onCloseAndReturnToReview,
}: FolderDetailViewProps) {
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; type: string; title: string; tags: string[]; s3Key?: string | null; decryptedFields?: Record<string, any> } | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; title: string } | null>(null);

  if (!isOpen) return null;

  const templates = DOCUMENT_TEMPLATES[category.id] || [];
  const requiredDocs = templates.filter(t => t.required);
  const optionalDocs = templates.filter(t => !t.required);

  // Categories that need sections with multiple rows
  const categoriesWithSections = ["finance-investments", "insurance", "loans-liabilities", "digital-assets", "legal-property", "identity-vital"];
  const needsSections = categoriesWithSections.includes(category.id);

  // For categories with sections, group items by document type
  const itemsByType: Record<string, Array<typeof items[0]>> = {};
  if (needsSections) {
    templates.forEach(template => {
      const matchingItems = items.filter(i => 
        i.tags.includes(template.type) || 
        i.title.toLowerCase().includes(template.type.toLowerCase())
      );
      // Always include templates for legal-property (Property and Legal sections should always show)
      // For other categories, only include if there are items or template is required
      if (category.id === "legal-property" || matchingItems.length > 0 || template.required) {
        itemsByType[template.type] = matchingItems;
      }
    });
  }

  // Map items to document cards - match items to templates by document type in tags
  // For sections, we'll handle multiple items per type differently
  const documentCards: DocumentCard[] = needsSections ? [] : templates.map(template => {
    const item = items.find(i => 
      i.tags.includes(template.type) || 
      i.title.toLowerCase().includes(template.type.toLowerCase())
    );
    return {
      id: item?.id || `template-${template.type}`,
      type: template.type,
      status: item ? "uploaded" : "not-added",
      title: item?.title || template.label,
      fields: item ? {} : undefined, // Fields are stored encrypted, will be decrypted on edit
      template: template, // Include template for displaying document type
      item: item || undefined, // Store full item data for edit/delete
    };
  });

  const getPriorityBadge = (priority: CategoryPriority) => {
    switch (priority) {
      case "must-have":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">🔴 Must-have</span>;
      case "good-to-have":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">🟡 Good to Have</span>;
      case "optional":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-700 border border-gray-200">⚪ Optional</span>;
    }
  };

  const handleAddDocument = async (documentType: string) => {
    // Check if Aadhaar or PAN already exists (only one allowed)
    if (documentType === "aadhaar" || documentType === "pan") {
      const existingItem = items.find(item => 
        item.tags.includes(documentType) || 
        item.title.toLowerCase().includes(documentType.toLowerCase())
      );
      if (existingItem) {
        alert(`You can only have one ${documentType === "aadhaar" ? "Aadhaar" : "PAN"} record. Please edit or delete the existing one.`);
        return;
      }
    }
    setSelectedDocumentType(documentType);
    setShowAddForm(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-3xl max-h-[90vh] my-8 shadow-large flex flex-col">
        {/* Header - Fixed at top */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <span className="text-xl">📁</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {getPriorityBadge(category.priority)}
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {HELPER_TEXTS[category.id] || category.microcopy}
            </p>
          </div>
          <button
            onClick={() => {
              if (reviewMode && onCloseAndReturnToReview) {
                onCloseAndReturnToReview();
              } else {
                onClose();
              }
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-6">
          {/* Review Mode Banner - Only visible when opened from review modal */}
          {reviewMode && (
            <div className="mt-4 mb-4 p-4 rounded-lg border border-brand-200 bg-brand-50 shadow-soft">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-brand-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-brand-900">
                    Review Mode: Mark each item as reviewed when done
                  </p>
                  <p className="text-xs text-brand-700 mt-1">
                    Check the box on each card after reviewing it. The category will be marked complete when all items are reviewed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Document Cards or Sections */}
          <div className="space-y-3 py-4">
          {needsSections ? (
            // Render sections with multiple rows
            <DocumentSectionsView
              category={category}
              templates={templates}
              itemsByType={itemsByType}
              onAddDocument={handleAddDocument}
              onDeleteDocument={onDeleteDocument}
              onDeleteDocumentWithConfirm={(itemId: string, itemTitle: string) => {
                setDeleteConfirmItem({ id: itemId, title: itemTitle });
              }}
              reviewMode={reviewMode}
              reviewedItems={reviewedItems}
              onItemReviewed={onItemReviewed}
              onCloseAndReturnToReview={onCloseAndReturnToReview}
              onEditDocument={async (itemId, documentType) => {
                const item = items.find(i => i.id === itemId);
                if (item) {
                  // Decrypt metadata if available
                  let decryptedFields: Record<string, any> = { title: item.title };
                  if (item.encryptedMetadata) {
                    try {
                      const vaultKey = await getVaultKey();
                      if (vaultKey) {
                        const { decryptTextData } = await import("@/lib/crypto");
                        // encryptedMetadata is base64-encoded JSON string, decode and parse
                        const jsonString = atob(item.encryptedMetadata);
                        const encryptedPayload = JSON.parse(jsonString);
                        decryptedFields = await decryptTextData(encryptedPayload, vaultKey);
                        decryptedFields.title = item.title; // Ensure title is set
                      }
                    } catch (error) {
                      console.error("Error decrypting metadata:", error);
                      // Continue with just title if decryption fails
                    }
                  }
                  setEditingItem({
                    id: item.id,
                    type: documentType,
                    title: item.title,
                    tags: item.tags,
                    s3Key: item.s3Key || null, // Include s3Key to know if document exists
                    decryptedFields, // Pass decrypted fields to populate form
                  });
                  setShowEditForm(true);
                }
              }}
              onDownloadDocument={onDownloadDocument ? async (itemId) => {
                try {
                  await onDownloadDocument(itemId);
                } catch (error) {
                  console.error("Error downloading document:", error);
                  alert("Failed to download document");
                }
              } : undefined}
              isDeleting={deletingItemId}
              getVaultKey={getVaultKey}
            />
          ) : (
            <>
              {/* Required Documents */}
              {requiredDocs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2">Required Documents</h3>
                  <div className="space-y-2">
                {requiredDocs.map(template => {
                  const card = documentCards.find(c => c.type === template.type);
                  if (!card) return null;
                  
                  return (
                    <DocumentCard
                      key={card.id}
                      card={card}
                      template={template}
                      onAdd={() => handleAddDocument(card.type)}
                      reviewMode={reviewMode}
                      onItemReviewed={card.item ? (itemId) => {
                        if (onItemReviewed) {
                          onItemReviewed(itemId);
                          // Check if all items in category are reviewed
                          const allItemsReviewed = items.every(item => 
                            !item.id || reviewedItems.has(item.id) || item.id === itemId
                          );
                          if (allItemsReviewed && onCloseAndReturnToReview) {
                            // Close and return to review modal
                            setTimeout(() => {
                              onCloseAndReturnToReview();
                            }, 500);
                          }
                        }
                      } : undefined}
                      isReviewed={card.item ? reviewedItems.has(card.item.id) : false}
                      onEdit={async () => {
                        if (card.item) {
                          // Decrypt metadata if available
                          let decryptedFields: Record<string, any> = { title: card.item.title };
                          if (card.item.encryptedMetadata) {
                            try {
                              const vaultKey = await getVaultKey();
                              if (vaultKey) {
                                const { decryptTextData } = await import("@/lib/crypto");
                                // encryptedMetadata is base64-encoded JSON string, decode and parse
                                const jsonString = atob(card.item.encryptedMetadata);
                                const encryptedPayload = JSON.parse(jsonString);
                                decryptedFields = await decryptTextData(encryptedPayload, vaultKey);
                                decryptedFields.title = card.item.title; // Ensure title is set
                              }
                            } catch (error) {
                              console.error("Error decrypting metadata:", error);
                              // Continue with just title if decryption fails
                            }
                          }
                          setEditingItem({
                            id: card.item.id,
                            type: card.type,
                            title: card.item.title,
                            tags: card.item.tags,
                            s3Key: card.item.s3Key || null, // Include s3Key to know if document exists
                            decryptedFields, // Pass decrypted fields to populate form
                          });
                          setShowEditForm(true);
                        }
                      }}
                      onDelete={async () => {
                        if (card.item) {
                          setDeleteConfirmItem({ id: card.item.id, title: card.item.title });
                        }
                      }}
                      onDownload={card.item && card.item.s3Key && onDownloadDocument ? async () => {
                        try {
                          await onDownloadDocument(card.item!.id);
                        } catch (error) {
                          console.error("Error downloading document:", error);
                          alert("Failed to download document");
                        }
                      } : undefined}
                      isDeleting={deletingItemId === card.item?.id}
                    />
                  );
                  })}
                  </div>
                </div>
              )}

              {/* Optional Documents */}
              {optionalDocs.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 mb-2">Optional Documents</h3>
                  <div className="space-y-2">
                {optionalDocs.map(template => {
                  const card = documentCards.find(c => c.type === template.type);
                  if (!card) return null;
                  
                  return (
                    <DocumentCard
                      key={card.id}
                      card={card}
                      template={template}
                      onAdd={() => handleAddDocument(card.type)}
                      reviewMode={reviewMode}
                      onItemReviewed={card.item ? (itemId) => {
                        if (onItemReviewed) {
                          onItemReviewed(itemId);
                          // Check if all items in category are reviewed
                          const allItemsReviewed = items.every(item => 
                            !item.id || reviewedItems.has(item.id) || item.id === itemId
                          );
                          if (allItemsReviewed && onCloseAndReturnToReview) {
                            // Close and return to review modal
                            setTimeout(() => {
                              onCloseAndReturnToReview();
                            }, 500);
                          }
                        }
                      } : undefined}
                      isReviewed={card.item ? reviewedItems.has(card.item.id) : false}
                      onEdit={async () => {
                        if (card.item) {
                          // Decrypt metadata if available
                          let decryptedFields: Record<string, any> = { title: card.item.title };
                          if (card.item.encryptedMetadata) {
                            try {
                              const vaultKey = await getVaultKey();
                              if (vaultKey) {
                                const { decryptTextData } = await import("@/lib/crypto");
                                // encryptedMetadata is base64-encoded JSON string, decode and parse
                                const jsonString = atob(card.item.encryptedMetadata);
                                const encryptedPayload = JSON.parse(jsonString);
                                decryptedFields = await decryptTextData(encryptedPayload, vaultKey);
                                decryptedFields.title = card.item.title; // Ensure title is set
                              }
                            } catch (error) {
                              console.error("Error decrypting metadata:", error);
                              // Continue with just title if decryption fails
                            }
                          }
                          setEditingItem({
                            id: card.item.id,
                            type: card.type,
                            title: card.item.title,
                            tags: card.item.tags,
                            s3Key: card.item.s3Key || null, // Include s3Key to know if document exists
                            decryptedFields, // Pass decrypted fields to populate form
                          });
                          setShowEditForm(true);
                        }
                      }}
                      onDelete={async () => {
                        if (card.item) {
                          setDeleteConfirmItem({ id: card.item.id, title: card.item.title });
                        }
                      }}
                      onDownload={card.item && card.item.s3Key && onDownloadDocument ? async () => {
                        try {
                          await onDownloadDocument(card.item!.id);
                        } catch (error) {
                          console.error("Error downloading document:", error);
                          alert("Failed to download document");
                        }
                      } : undefined}
                      isDeleting={deletingItemId === card.item?.id}
                    />
                  );
                  })}
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>

        {/* Add Document Form Modal */}
        {showAddForm && selectedDocumentType && (
          <AddDocumentForm
            isOpen={showAddForm}
            onClose={() => {
              setShowAddForm(false);
              setSelectedDocumentType(null);
            }}
            documentType={selectedDocumentType}
            template={templates.find(t => t.type === selectedDocumentType)}
            onSave={async (fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => {
              if (!selectedDocumentType) return;
              try {
                // Ensure policyType is set for frozen fields
                const template = templates.find(t => t.type === selectedDocumentType);
                if (template) {
                  template.fields.forEach(field => {
                    if (field.readOnly && field.defaultValue && !fields[field.name]) {
                      fields[field.name] = field.defaultValue;
                    }
                  });
                }
                await onAddDocument(selectedDocumentType, fields, file, vaultKey);
                setShowAddForm(false);
                setSelectedDocumentType(null);
                if (onRefresh) onRefresh();
              } catch (error) {
                console.error("Error saving document:", error);
                throw error;
              }
            }}
            getVaultKey={getVaultKey}
          />
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmItem && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-md w-full mx-4 shadow-large">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Item</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete "{deleteConfirmItem.title}"? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmItem(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (deleteConfirmItem) {
                      setDeletingItemId(deleteConfirmItem.id);
                      try {
                        await onDeleteDocument(deleteConfirmItem.id);
                        setDeleteConfirmItem(null);
                        if (onRefresh) onRefresh();
                      } catch (error) {
                        console.error("Error deleting document:", error);
                        alert("Failed to delete document");
                      } finally {
                        setDeletingItemId(null);
                      }
                    }
                  }}
                  disabled={deletingItemId === deleteConfirmItem?.id}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {deletingItemId === deleteConfirmItem?.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Document Form Modal */}
        {showEditForm && editingItem && (
          <EditDocumentForm
            isOpen={showEditForm}
            onClose={() => {
              setShowEditForm(false);
              setEditingItem(null);
            }}
            item={editingItem}
            template={templates.find(t => t.type === editingItem.type)}
            onSave={async (fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => {
              if (!editingItem) return;
              try {
                await onEditDocument(editingItem.id, editingItem.type, fields, file, vaultKey);
                setShowEditForm(false);
                setEditingItem(null);
                if (onRefresh) onRefresh();
              } catch (error) {
                console.error("Error updating document:", error);
                throw error;
              }
            }}
            getVaultKey={getVaultKey}
          />
        )}
      </div>
    </div>
  );
}

function DocumentCard({
  card,
  template,
  onAdd,
  onEdit,
  onDelete,
  onDownload,
  isDeleting = false,
  reviewMode = false,
  onItemReviewed,
  isReviewed = false,
}: {
  card: DocumentCard;
  template: { type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string };
  onAdd: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  isDeleting?: boolean;
  reviewMode?: boolean;
  onItemReviewed?: (itemId: string) => void;
  isReviewed?: boolean;
}) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getOwnerName = (creator?: { id: string; email: string; fullName: string | null }) => {
    if (!creator) return "Unknown";
    return creator.fullName || creator.email || "Unknown";
  };

  return (
    <div className={`flex items-center justify-between p-4 bg-white rounded-lg border transition-colors shadow-soft ${
      isReviewed ? "border-green-500/50 bg-green-50" : "border-gray-200 hover:border-gray-300 hover:shadow-medium"
    }`}>
      <div className="flex items-center gap-3 flex-1">
        {card.status === "uploaded" ? (
          <Check className="w-5 h-5 text-green-600" />
        ) : (
          <Plus className="w-5 h-5 text-gray-400" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-gray-900">{card.title}</h4>
            {isReviewed && (
              <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Reviewed
              </span>
            )}
          </div>
          {card.status === "uploaded" && card.item && (
            <div className="mt-1 text-xs text-gray-500">
              <span>Owner: {getOwnerName(card.item.creator)}</span>
              {(card.item.updatedAt || card.item.createdAt) && (
                <>
                  <span className="mx-2">•</span>
                  <span>Updated: {formatDate(card.item.updatedAt || card.item.createdAt!)}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {card.status === "uploaded" ? (
          <>
            {/* Review Mode Checkbox - Show alongside existing actions */}
            {reviewMode && card.item?.id && onItemReviewed && (
              <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md border border-brand-500/50 bg-brand-50 hover:bg-brand-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isReviewed}
                  onChange={(e) => {
                    if (card.item) {
                      onItemReviewed(card.item.id);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 bg-white text-brand-500 focus:ring-brand-500 focus:ring-2 focus:ring-offset-0"
                />
                <span className="text-xs font-medium text-brand-700 whitespace-nowrap">
                  {isReviewed ? "Reviewed" : "Review"}
                </span>
              </label>
            )}
            {/* Existing actions - always show */}
            {onDownload && card.item?.s3Key && (
              <button
                onClick={onDownload}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-gray-100 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add more
          </button>
        )}
      </div>
    </div>
  );
}

function AddDocumentForm({
  isOpen,
  onClose,
  documentType,
  template,
  onSave,
  getVaultKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  documentType: string;
  template?: { type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string };
  onSave: (fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>;
  getVaultKey: () => Promise<CryptoKey | null>;
}) {
  // Initialize fields with default values from template
  const initialFields: Record<string, any> = {};
  if (template) {
    template.fields.forEach(field => {
      if (field.defaultValue) {
        initialFields[field.name] = field.defaultValue;
      }
    });
  }
  const [fields, setFields] = useState<Record<string, any>>(initialFields);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Update fields when template changes
  useEffect(() => {
    if (template) {
      const newFields: Record<string, any> = {};
      template.fields.forEach(field => {
        if (field.defaultValue) {
          newFields[field.name] = field.defaultValue;
        }
      });
      setFields(newFields);
    }
  }, [template]);

  if (!isOpen || !template) return null;

  const validateField = (fieldName: string, value: string): boolean => {
    if (!value || value.trim() === "") {
      // Clear error if field is empty (required check happens on submit)
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    }
    
    const validator = getFieldValidator(fieldName, documentType);
    if (validator) {
      const result = validator(value);
      if (!result.valid) {
        setFieldErrors(prev => ({ ...prev, [fieldName]: result.error || "Invalid value" }));
        return false;
      }
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return true;
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFields(prev => ({ ...prev, [fieldName]: value }));
    if (value) {
      validateField(fieldName, value);
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let isValid = true;
    // Validate non-file fields
    for (const field of template.fields) {
      if (field.type === "file") continue;
      const value = fields[field.name] || "";
      if (field.required && !value) {
        setFieldErrors(prev => ({ ...prev, [field.name]: "This field is required" }));
        isValid = false;
      } else if (value && field.type === "text") {
        if (!validateField(field.name, value)) {
          isValid = false;
        }
      }
      // Dropdown fields don't need validation beyond required check
    }
    
    // Validate file fields
    for (const field of template.fields) {
      if (field.type === "file" && field.required) {
        if (!files[field.name]) {
          setFieldErrors(prev => ({ ...prev, [field.name]: "This field is required" }));
          isValid = false;
        }
      }
    }
    
    if (!isValid) return;
    
    setSaving(true);
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) {
        alert("Vault is locked. Please unlock it first.");
        return;
      }
      
      // For Tax Records with multiple files, combine them into a zip
      let fileToUpload: File | null = null;
      const fileFields = template.fields.filter(f => f.type === "file");
      
      if (fileFields.length > 1 && documentType === "tax-records") {
        // Combine multiple files into a zip
        const JSZipModule = await import("jszip");
        const JSZip = JSZipModule.default || JSZipModule;
        const zip = new JSZip();
        
        for (const field of fileFields) {
          const file = files[field.name];
          if (file) {
            zip.file(file.name, file);
          }
        }
        
        const zipBlob = await zip.generateAsync({ type: "blob" });
        fileToUpload = new File([zipBlob], `tax-records-${fields.financialYear || 'documents'}.zip`, { type: "application/zip" });
      } else {
        // Single file field or first file - use it directly
        const firstFileField = fileFields.find(f => files[f.name]);
        fileToUpload = firstFileField ? files[firstFileField.name] : null;
      }
      
      await onSave(fields, fileToUpload, vaultKey);
      setFieldErrors({});
      // Reset to default values
      const resetFields: Record<string, any> = {};
      if (template) {
        template.fields.forEach(field => {
          if (field.defaultValue) {
            resetFields[field.name] = field.defaultValue;
          }
        });
      }
      setFields(resetFields);
      setFiles({});
    } finally {
      setSaving(false);
    }
  };

  const renderFieldWithWrapper = (field: FieldDefinition, depth: number = 0) => {
    const value = fields[field.name];
    const showConditional = field.conditionalFields && 
      fields[field.conditionalFields.condition] === field.conditionalFields.value;

    return (
      <div key={field.name} style={{ marginLeft: `${depth * 20}px` }}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-600 ml-1">*</span>}
        </label>
        {renderField(field, value, (val) => handleFieldChange(field.name, val), fieldErrors, documentType, fields)}
        {fieldErrors[field.name] && (
          <p className="text-xs text-red-600 mt-1">{fieldErrors[field.name]}</p>
        )}
        {field.helpText && (
          <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
        )}
        {showConditional && field.conditionalFields && field.conditionalFields.fields.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-300">
            {field.conditionalFields.fields.map(condField => renderFieldWithWrapper(condField, depth + 1))}
          </div>
        )}
        {field.name === "hasNominee" && value === "No" && (
          <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <p className="text-xs text-yellow-400">
              💡 Best practice: Add a nominee to your account as soon as possible. This helps your family access funds when needed.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 overflow-y-auto p-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col my-8 shadow-large">
        <div className="p-6 pb-4">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Add {template.label}</h3>
          {template.helpText && (
            <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              {template.helpText}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 px-6 pb-6">
          {/* Title field - allow editing during first time fill */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={fields.title || ""}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-brand-500"
              placeholder="Enter title"
            />
          </div>
          {template.fields.map(field => {
            if (field.type === "file") {
              const inputId = `file-input-${field.name}`;
              return (
                <div key={field.name}>
                  <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-600 ml-1">*</span>}
                  </label>
                  <input
                    id={inputId}
                    type="file"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0] || null;
                      setFiles(prev => ({ ...prev, [field.name]: selectedFile }));
                      // Clear error when file is selected
                      if (selectedFile) {
                        setFieldErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors[field.name];
                          return newErrors;
                        });
                      }
                    }}
                    className="w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                  {fieldErrors[field.name] && (
                    <p className="text-xs text-red-400 mt-1">{fieldErrors[field.name]}</p>
                  )}
                </div>
              );
            }
            // Skip coverage type and policy valid till - they'll be shown conditionally
            if (field.name === "coverageType" || field.name === "policyValidTill") {
              return null;
            }
            return renderFieldWithWrapper(field);
          })}
          {/* Show coverage type and valid till conditionally for Life, Health, Accident */}
          {template.fields.find(f => f.name === "policyType") && 
           fields.policyType && 
           ["Life (Term)", "Health", "Accident / Disability"].includes(fields.policyType) && (
            <>
              {template.fields.find(f => f.name === "coverageType") && (
                <div className="mt-3">
                  {renderFieldWithWrapper(template.fields.find(f => f.name === "coverageType")!)}
                </div>
              )}
              {template.fields.find(f => f.name === "policyValidTill") && (
                <div className="mt-3">
                  {renderFieldWithWrapper(template.fields.find(f => f.name === "policyValidTill")!)}
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2 -mx-6 px-6 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditDocumentForm({
  isOpen,
  onClose,
  item,
  template,
  onSave,
  getVaultKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: { id: string; type: string; title: string; tags: string[]; decryptedFields?: Record<string, any>; s3Key?: string | null };
  template?: { type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string };
  onSave: (fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>;
  getVaultKey: () => Promise<CryptoKey | null>;
}) {
  // Initialize fields with decrypted metadata or just title
  const [fields, setFields] = useState<Record<string, any>>(
    item.decryptedFields || { title: item.title }
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Get filename from decrypted metadata if available
  const fileName = item.decryptedFields?._fileName || null;
  const hasDocument = !!item.s3Key;
  
  // Update fields when item changes
  useEffect(() => {
    setFields(item.decryptedFields || { title: item.title });
    setFieldErrors({});
  }, [item]);

  if (!isOpen || !template) return null;

  const validateField = (fieldName: string, value: string): boolean => {
    if (!value || value.trim() === "") {
      // Clear error if field is empty (required check happens on submit)
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    }
    
    const validator = getFieldValidator(fieldName, item.type);
    if (validator) {
      const result = validator(value);
      if (!result.valid) {
        setFieldErrors(prev => ({ ...prev, [fieldName]: result.error || "Invalid value" }));
        return false;
      }
    }
    setFieldErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return true;
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFields(prev => ({ ...prev, [fieldName]: value }));
    if (value) {
      validateField(fieldName, value);
    } else {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let isValid = true;
    for (const field of template.fields) {
      if (field.type === "file") continue;
      const value = fields[field.name] || "";
      if (field.required && !value) {
        setFieldErrors(prev => ({ ...prev, [field.name]: "This field is required" }));
        isValid = false;
      } else if (value && field.type === "text") {
        if (!validateField(field.name, value)) {
          isValid = false;
        }
      }
    }
    
    if (!isValid) return;
    
    setSaving(true);
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) {
        alert("Vault is locked. Please unlock it first.");
        return;
      }
      await onSave(fields, file, vaultKey);
    } finally {
      setSaving(false);
    }
  };

  const renderFieldWithWrapper = (field: FieldDefinition, depth: number = 0) => {
    const value = fields[field.name];
    // Check if conditional fields should be shown
    let showConditional = false;
    if (field.conditionalFields) {
      const conditionValue = fields[field.conditionalFields.condition];
      const expectedValue = field.conditionalFields.value;
      if (Array.isArray(expectedValue)) {
        showConditional = expectedValue.includes(conditionValue);
      } else {
        showConditional = conditionValue === expectedValue;
      }
    }
    // Check if this field itself should be shown
    let showField = true;
    if (field.showWhen) {
      const conditionValue = fields[field.showWhen.field];
      const expectedValue = field.showWhen.value;
      if (Array.isArray(expectedValue)) {
        showField = expectedValue.includes(conditionValue);
      } else {
        showField = conditionValue === expectedValue;
      }
    }
    
    if (!showField) return null;

    return (
      <div key={field.name} style={{ marginLeft: `${depth * 20}px` }}>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-600 ml-1">*</span>}
        </label>
        {renderField(field, value, (val) => handleFieldChange(field.name, val), fieldErrors, item.type, fields)}
        {fieldErrors[field.name] && (
          <p className="text-xs text-red-600 mt-1">{fieldErrors[field.name]}</p>
        )}
        {field.helpText && (
          <p className="text-xs text-gray-500 mt-1">{field.helpText}</p>
        )}
        {showConditional && field.conditionalFields && field.conditionalFields.fields.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-300">
            {field.conditionalFields.fields.map(condField => renderFieldWithWrapper(condField, depth + 1))}
          </div>
        )}
        {field.name === "hasNominee" && value === "No" && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-700">
              💡 Best practice: Add a nominee to your account as soon as possible. This helps your family access funds when needed.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 overflow-y-auto p-4">
      <div className="bg-white rounded-lg border border-gray-200 w-full max-w-2xl p-6 my-8 max-h-[90vh] flex flex-col shadow-large">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Edit {template.label}</h3>
        {template.helpText && (
          <p className="text-sm text-gray-600 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            {template.helpText}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Title field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={fields.title || item.title}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:border-brand-500"
              placeholder="Enter title"
              required
            />
          </div>

          {/* Other fields from template */}
          {template.fields.map(field => {
            if (field.type === "file") {
              return (
                <div key={field.name}>
                  <label htmlFor={`file-input-edit-${field.name}`} className="block text-sm font-medium text-gray-700 mb-2">
                    {hasDocument && !file ? `${field.label} (Replace)` : field.label}
                    {field.required && <span className="text-red-600 ml-1">*</span>}
                  </label>
                  {hasDocument && fileName && !file && (
                    <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-300">
                      <p className="text-xs text-gray-600">
                        <span className="text-gray-500">Current document:</span> {fileName}
                      </p>
                    </div>
                  )}
                  <input
                    id={`file-input-edit-${field.name}`}
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                </div>
              );
            }
            // Skip coverage type and policy valid till - they'll be shown conditionally
            if (field.name === "coverageType" || field.name === "policyValidTill") {
              return null;
            }
            return renderFieldWithWrapper(field);
          })}
          {/* Show coverage type and valid till conditionally for Life, Health, Accident */}
          {template.fields.find(f => f.name === "policyType") && 
           fields.policyType && 
           ["Life (Term)", "Health", "Accident / Disability"].includes(fields.policyType) && (
            <>
              {template.fields.find(f => f.name === "coverageType") && (
                <div className="mt-3">
                  {renderFieldWithWrapper(template.fields.find(f => f.name === "coverageType")!)}
                </div>
              )}
              {template.fields.find(f => f.name === "policyValidTill") && (
                <div className="mt-3">
                  {renderFieldWithWrapper(template.fields.find(f => f.name === "policyValidTill")!)}
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white pb-2 -mx-2 px-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Component for rendering sections with multiple rows (Finance, Insurance, Loans, Digital Assets)
function DocumentSectionsView({
  category,
  templates,
  itemsByType,
  onAddDocument,
  onEditDocument,
  onDeleteDocument,
  onDeleteDocumentWithConfirm,
  onDownloadDocument,
  isDeleting,
  getVaultKey,
  reviewMode = false,
  reviewedItems = new Set(),
  onItemReviewed,
  onCloseAndReturnToReview,
}: {
  category: CategoryConfig;
  templates: Array<{ type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string }>;
  itemsByType: Record<string, Array<{ id: string; category: string; title: string; tags: string[]; s3Key?: string | null; iv?: string | null }>>;
  onAddDocument: (documentType: string) => void;
  onEditDocument: (itemId: string, documentType: string) => void;
  onDeleteDocument: (itemId: string) => Promise<void>;
  onDeleteDocumentWithConfirm?: (itemId: string, itemTitle: string) => void;
  onDownloadDocument?: (itemId: string) => Promise<void>;
  isDeleting: string | null;
  getVaultKey: () => Promise<CryptoKey | null>;
  reviewMode?: boolean;
  reviewedItems?: Set<string>;
  onItemReviewed?: (itemId: string) => void;
  onCloseAndReturnToReview?: () => void;
}) {
  // For Finance, group into Bank Accounts, Investments, and Tax Records sections
  if (category.id === "finance-investments") {
    const bankAccountTemplate = templates.find(t => t.type === "bank-account");
    const investmentTemplate = templates.find(t => t.type === "investment");
    const taxRecordsTemplate = templates.find(t => t.type === "tax-records");
    const bankAccounts = itemsByType["bank-account"] || [];
    const investments = itemsByType["investment"] || [];
    const taxRecords = itemsByType["tax-records"] || [];

    return (
      <div className="space-y-6">
        {/* Bank Accounts Section */}
        <DocumentSection
          title="Bank Accounts"
          description="At least 1 bank account is required"
          template={bankAccountTemplate}
          items={bankAccounts}
          minRows={0}
          onAdd={() => onAddDocument("bank-account")}
          onEdit={onEditDocument}
          onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
            if (confirm(`Are you sure you want to delete "${title}"?`)) {
              onDeleteDocument(id);
            }
          })}
          onDownload={onDownloadDocument}
          isDeleting={isDeleting}
          reviewMode={reviewMode}
          reviewedItems={reviewedItems}
          onItemReviewed={onItemReviewed}
          onCloseAndReturnToReview={onCloseAndReturnToReview}
        />
        
        {/* Investments Section */}
        <DocumentSection
          title="Investments"
          description="Add your investment accounts"
          template={investmentTemplate}
          items={investments}
          minRows={0}
          onAdd={() => onAddDocument("investment")}
          onEdit={onEditDocument}
          onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
            if (confirm(`Are you sure you want to delete "${title}"?`)) {
              onDeleteDocument(id);
            }
          })}
          onDownload={onDownloadDocument}
          isDeleting={isDeleting}
          reviewMode={reviewMode}
          reviewedItems={reviewedItems}
          onItemReviewed={onItemReviewed}
          onCloseAndReturnToReview={onCloseAndReturnToReview}
        />

        {/* Tax Records Section */}
        {taxRecordsTemplate && (
          <DocumentSection
            title="Tax Records"
            description="Add your tax records"
            template={taxRecordsTemplate}
            items={taxRecords}
            minRows={0}
            onAdd={() => onAddDocument("tax-records")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
      </div>
    );
  }

  // For Insurance, group into Life/Term, Health, and Others sections
  if (category.id === "insurance") {
    const lifeTermTemplate = templates.find(t => t.type === "life-term-insurance");
    const healthTemplate = templates.find(t => t.type === "health-insurance");
    const otherTemplate = templates.find(t => t.type === "other-insurance");
    const lifeTermItems = itemsByType["life-term-insurance"] || [];
    const healthItems = itemsByType["health-insurance"] || [];
    const otherItems = itemsByType["other-insurance"] || [];

    return (
      <div className="space-y-6">
        {/* Life / Term Insurance Section */}
        {lifeTermTemplate && (
          <DocumentSection
            title="Life / Term Insurance"
            description=""
            template={lifeTermTemplate}
            items={lifeTermItems}
            minRows={0}
            onAdd={() => onAddDocument("life-term-insurance")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
        
        {/* Health Insurance Section */}
        {healthTemplate && (
          <DocumentSection
            title="Health Insurance"
            description=""
            template={healthTemplate}
            items={healthItems}
            minRows={0}
            onAdd={() => onAddDocument("health-insurance")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
        
        {/* Others Section */}
        {otherTemplate && (
          <DocumentSection
            title="Others"
            description=""
            template={otherTemplate}
            items={otherItems}
            minRows={0}
            onAdd={() => onAddDocument("other-insurance")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
      </div>
    );
  }

  // For Digital Assets, group into Email, Social Media, Banking Apps, Investment Platform, Other sections
  if (category.id === "digital-assets") {
    const emailTemplate = templates.find(t => t.type === "email-account");
    const socialMediaTemplate = templates.find(t => t.type === "social-media");
    const bankingAppTemplate = templates.find(t => t.type === "banking-app");
    const investmentPlatformTemplate = templates.find(t => t.type === "investment-platform");
    const otherTemplate = templates.find(t => t.type === "other-digital");
    const emailItems = itemsByType["email-account"] || [];
    const socialMediaItems = itemsByType["social-media"] || [];
    const bankingAppItems = itemsByType["banking-app"] || [];
    const investmentPlatformItems = itemsByType["investment-platform"] || [];
    const otherItems = itemsByType["other-digital"] || [];

    return (
      <div className="space-y-6">
        {/* Email Section */}
        {emailTemplate && (
          <DocumentSection
            title="Emails"
            description=""
            template={emailTemplate}
            items={emailItems}
            minRows={0}
            onAdd={() => onAddDocument("email-account")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
        
        {/* Social Media Section */}
        {socialMediaTemplate && (
          <DocumentSection
            title="Social Media"
            description=""
            template={socialMediaTemplate}
            items={socialMediaItems}
            minRows={0}
            onAdd={() => onAddDocument("social-media")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
        
        {/* Banking Apps Section */}
        {bankingAppTemplate && (
          <DocumentSection
            title="Banking Apps"
            description=""
            template={bankingAppTemplate}
            items={bankingAppItems}
            minRows={0}
            onAdd={() => onAddDocument("banking-app")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
        
        {/* Investment Platform Section */}
        {investmentPlatformTemplate && (
          <DocumentSection
            title="Investment Platform"
            description=""
            template={investmentPlatformTemplate}
            items={investmentPlatformItems}
            minRows={0}
            onAdd={() => onAddDocument("investment-platform")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
        
        {/* Other Section */}
        {otherTemplate && (
          <DocumentSection
            title="Other"
            description=""
            template={otherTemplate}
            items={otherItems}
            minRows={0}
            onAdd={() => onAddDocument("other-digital")}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        )}
      </div>
    );
  }

  // For Legal Estate, group into Property and Legal sections
  if (category.id === "legal-property") {
    const propertyTemplate = templates.find(t => t.type === "property");
    const legalTemplate = templates.find(t => t.type === "legal");
    const propertyItems = itemsByType["property"] || [];
    const legalItems = itemsByType["legal"] || [];

    // Ensure templates exist - they should always be found
    if (!propertyTemplate || !legalTemplate) {
      console.error("Legal Estate templates not found! Available templates:", templates.map(t => t.type));
      return (
        <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg">
          <p className="text-sm text-red-400">
            Error: Property or Legal templates not found. Please check the console for details.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Property Section */}
        <DocumentSection
          title="Property"
          description=""
          template={propertyTemplate}
          items={propertyItems}
          minRows={0}
          onAdd={() => onAddDocument("property")}
          onEdit={onEditDocument}
          onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
            if (confirm(`Are you sure you want to delete "${title}"?`)) {
              onDeleteDocument(id);
            }
          })}
          onDownload={onDownloadDocument}
          isDeleting={isDeleting}
          reviewMode={reviewMode}
          reviewedItems={reviewedItems}
          onItemReviewed={onItemReviewed}
          onCloseAndReturnToReview={onCloseAndReturnToReview}
        />
        
        {/* Legal Section */}
        <DocumentSection
          title="Legal"
          description=""
          template={legalTemplate}
          items={legalItems}
          minRows={0}
          onAdd={() => onAddDocument("legal")}
          onEdit={onEditDocument}
          onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
            if (confirm(`Are you sure you want to delete "${title}"?`)) {
              onDeleteDocument(id);
            }
          })}
          onDownload={onDownloadDocument}
          isDeleting={isDeleting}
          reviewMode={reviewMode}
          reviewedItems={reviewedItems}
          onItemReviewed={onItemReviewed}
          onCloseAndReturnToReview={onCloseAndReturnToReview}
        />
      </div>
    );
  }

  // For Loans - each template type is a section (without "Optional" text)
  return (
    <div className="space-y-6">
      {templates.map(template => {
        const sectionItems = itemsByType[template.type] || [];
        const minRows = template.required ? 1 : 0;
        
        return (
          <DocumentSection
            key={template.type}
            title={template.label}
            description={template.required ? "At least 1 is required" : ""}
            template={template}
            items={sectionItems}
            minRows={minRows}
            onAdd={() => onAddDocument(template.type)}
            onEdit={onEditDocument}
            onDelete={onDeleteDocumentWithConfirm || ((id: string, title: string) => {
              if (confirm(`Are you sure you want to delete "${title}"?`)) {
                onDeleteDocument(id);
              }
            })}
            onDownload={onDownloadDocument}
            isDeleting={isDeleting}
            reviewMode={reviewMode}
            reviewedItems={reviewedItems}
            onItemReviewed={onItemReviewed}
            onCloseAndReturnToReview={onCloseAndReturnToReview}
          />
        );
      })}
    </div>
  );
}

// Component for a single section with multiple rows
function DocumentSection({
  title,
  description,
  template,
  items,
  minRows,
  onAdd,
  onEdit,
  onDelete,
  onDownload,
  isDeleting,
  reviewMode = false,
  reviewedItems = new Set(),
  onItemReviewed,
  onCloseAndReturnToReview,
}: {
  title: string;
  description: string;
  template?: { type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string };
  items: Array<{ 
    id: string; 
    category: string; 
    title: string; 
    tags: string[]; 
    s3Key?: string | null; 
    iv?: string | null;
    createdAt?: string;
    updatedAt?: string;
    creator?: {
      id: string;
      email: string;
      fullName: string | null;
    };
  }>;
  minRows: number;
  onAdd: () => void;
  onEdit: (itemId: string, documentType: string) => void;
  onDelete: (itemId: string, itemTitle: string) => void;
  onDownload?: (itemId: string) => Promise<void>;
  isDeleting: string | null;
  reviewMode?: boolean;
  reviewedItems?: Set<string>;
  onItemReviewed?: (itemId: string) => void;
  onCloseAndReturnToReview?: () => void;
}) {
  // Ensure minimum rows are displayed
  const displayItems = [...items];
  while (displayItems.length < minRows) {
    displayItems.push({ id: `placeholder-${displayItems.length}`, category: "", title: "", tags: [], s3Key: null, iv: null });
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getOwnerName = (creator?: { id: string; email: string; fullName: string | null }) => {
    if (!creator) return "Unknown";
    return creator.fullName || creator.email || "Unknown";
  };

  const [showTooltip, setShowTooltip] = useState(false);
  const helperText = template?.type ? SECTION_HELPER_TEXTS[template.type] : null;

  // Position tooltip above when there are no items (section is small), below otherwise
  const tooltipPosition = items.length === 0 ? 'above' : 'below';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-soft overflow-visible">
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 overflow-visible">
          <div className="flex items-center gap-2 relative overflow-visible">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {helperText && (
              <div className="relative overflow-visible">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  onFocus={() => setShowTooltip(true)}
                  onBlur={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  aria-label={`Help for ${title} section`}
                  title={`Help for ${title} section`}
                >
                  <Info className="w-4 h-4" />
                </button>
                {showTooltip && (
                  <div 
                    className={`absolute left-0 z-[100] w-80 max-w-[90vw] rounded-lg border border-gray-300 bg-white p-4 shadow-large pointer-events-none ${
                      tooltipPosition === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
                    }`}
                  >
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-normal break-words">
                      {helperText}
                    </p>
                    {tooltipPosition === 'above' ? (
                      <div className="absolute -bottom-1 left-4 w-2 h-2 rotate-45 bg-white border-r border-b border-gray-300"></div>
                    ) : (
                      <div className="absolute -top-1 left-4 w-2 h-2 rotate-45 bg-white border-l border-t border-gray-300"></div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        {/* Hide "Add more" button for Aadhaar and PAN if item already exists (only one allowed) */}
        {!(template?.type === "aadhaar" || template?.type === "pan") || items.length === 0 ? (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Add more
          </button>
        ) : null}
      </div>
      
      <div className="space-y-2">
        {displayItems.map((item, index) => {
          const isPlaceholder = item.id.startsWith("placeholder-");
          const hasFile = !!item.s3Key;
          
          const isItemReviewed = !isPlaceholder && item.id && reviewedItems.has(item.id);
          
          return (
            <div
              key={item.id || index}
              className={`flex items-center justify-between p-3 rounded border transition-colors shadow-soft ${
                isItemReviewed ? "bg-green-50 border-green-200" : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-medium"
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {isPlaceholder ? (
                  <Plus className="w-4 h-4 text-gray-400" />
                ) : (
                  <Check className="w-4 h-4 text-green-600" />
                )}
                <div className="flex-1">
                  {isPlaceholder ? (
                    <span className="text-sm text-gray-400"></span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-gray-900">{item.title || title}</h4>
                        {isItemReviewed && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Reviewed
                          </span>
                        )}
                      </div>
                      {!isPlaceholder && (
                        <div className="mt-1 text-xs text-gray-500">
                          <span>Owner: {getOwnerName(item.creator)}</span>
                          {(item.updatedAt || item.createdAt) && (
                            <>
                              <span className="mx-2">•</span>
                              <span>Updated: {formatDate(item.updatedAt || item.createdAt!)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {!isPlaceholder && (
                <div className="flex items-center gap-2">
                  {/* Review Mode Checkbox - Show alongside existing actions */}
                  {reviewMode && item.id && onItemReviewed && (
                    <label className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-md border border-brand-500/50 bg-brand-50 hover:bg-brand-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={!!isItemReviewed}
                        onChange={(e) => {
                          if (item.id && onItemReviewed) {
                            onItemReviewed(item.id);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 bg-white text-brand-500 focus:ring-brand-500 focus:ring-2 focus:ring-offset-0"
                      />
                      <span className="text-xs font-medium text-brand-700 whitespace-nowrap">
                        {isItemReviewed ? "Reviewed" : "Review"}
                      </span>
                    </label>
                  )}
                  {/* Existing actions - always show */}
                  {onDownload && hasFile && (
                    <button
                      onClick={() => onDownload(item.id)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(item.id, template?.type || "")}
                    className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-gray-100 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id, item.title || title)}
                    disabled={isDeleting === item.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
