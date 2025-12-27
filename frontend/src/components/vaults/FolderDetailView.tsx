"use client";

import { useState, useEffect } from "react";
import { X, Check, Plus, MoreVertical, ArrowRight, Shield, UserPlus, Edit2, Trash2, Download } from "lucide-react";
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
  item?: {
    id: string;
    category: string;
    title: string;
    tags: string[];
    s3Key?: string | null;
    iv?: string | null;
    encryptedMetadata?: string | null;
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
  }>;
  onAddDocument: (documentType: string, fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>;
  onEditDocument: (itemId: string, documentType: string, fields: Record<string, any>, file: File | null, vaultKey: CryptoKey) => Promise<void>;
  onDeleteDocument: (itemId: string) => Promise<void>;
  onDownloadDocument?: (itemId: string) => Promise<void>;
  getVaultKey: () => Promise<CryptoKey | null>;
  onAddNominee?: () => void; // For emergency-access folder
  nominees?: Array<{
    id: string;
    nomineeName: string;
    nomineeEmail: string | null;
    nomineePhone: string | null;
    accessTriggerDays: number;
    isActive: boolean;
  }>; // For emergency-access folder
  onRefresh?: () => void; // Callback to refresh items after edit/delete
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
  const baseInputClasses = `w-full px-3 py-2 bg-slate-900 border rounded-lg text-white text-sm focus:outline-none ${
    hasError 
      ? "border-red-500 focus:border-red-500" 
      : "border-slate-700 focus:border-brand-500"
  }`;

  switch (field.type) {
    case "dropdown":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={baseInputClasses}
          required={field.required}
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
          className="w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white [&::file-selector-button]:hidden"
          required={field.required}
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
    value: string; // Value that triggers this
    fields: FieldDefinition[];
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
      label: "Aadhaar Card", 
      required: true, 
      fields: [
        { name: "number", type: "text", label: "Aadhaar Number", required: true },
        { name: "pdf", type: "file", label: "Document", required: false, helpText: "💡 Uploading the document helps your family access it quickly in an emergency" }
      ] 
    },
    { 
      type: "passport", 
      label: "Passport", 
      required: true, 
      fields: [
        { name: "number", type: "text", label: "Passport Number", required: true },
        { name: "expiry", type: "text", label: "Expiry Date", required: true },
        { name: "pdf", type: "file", label: "Document", required: false, helpText: "💡 Uploading the document helps your family access it quickly in an emergency" }
      ] 
    },
    { 
      type: "pan", 
      label: "PAN", 
      required: true, 
      fields: [
        { name: "number", type: "text", label: "PAN Number", required: true },
        { name: "pdf", type: "file", label: "Document", required: false, helpText: "💡 Uploading the document helps your family access it quickly in an emergency" }
      ] 
    },
    { 
      type: "marriage-certificate", 
      label: "Marriage Certificate", 
      required: false, 
      fields: [
        { name: "pdf", type: "file", label: "Document", required: false }
      ] 
    },
    { 
      type: "birth-certificate", 
      label: "Birth Certificate", 
      required: true, 
      fields: [
        { name: "pdf", type: "file", label: "Document", required: true }
      ] 
    },
    { 
      type: "divorce-certificate", 
      label: "Divorce Certificate", 
      required: false, 
      fields: [
        { name: "pdf", type: "file", label: "Document", required: false }
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
        { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
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
        { name: "pdf", type: "file", label: "Upload a document (Optional)", required: false }
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
        { name: "pdf", type: "file", label: "Upload a document (Optional)", required: false }
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
        { name: "pdf", type: "file", label: "Upload a document (Optional)", required: false }
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
        { name: "pdf", type: "file", label: "Upload a document (Optional)", required: false }
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
      { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
    ] },
    { type: "personal-loan", label: "Personal Loan", required: false, fields: [
      { name: "lender", type: "text", label: "Lender", required: true },
      { name: "totalAmount", type: "text", label: "Total Loan Amount", required: false },
      { name: "outstandingAmount", type: "text", label: "Outstanding Amount", required: false },
      { name: "emiDate", type: "text", label: "EMI Date", required: false },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
    ] },
    { type: "vehicle-loan", label: "Vehicle Loan", required: false, fields: [
      { name: "lender", type: "text", label: "Lender", required: true },
      { name: "totalAmount", type: "text", label: "Total Loan Amount", required: false },
      { name: "outstandingAmount", type: "text", label: "Outstanding Amount", required: false },
      { name: "emiDate", type: "text", label: "EMI Date", required: false },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
    ] },
    { type: "other-liability", label: "Other Liabilities", required: false, fields: [
      { name: "liabilityType", type: "text", label: "Liability Type", required: true },
      { name: "notes", type: "textarea", label: "Notes", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
    ] },
  ],
  "legal-property": [
    { type: "property", label: "Property", required: false, fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "notes", type: "textarea", label: "Note", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
    ] },
    { type: "legal", label: "Legal", required: false, fields: [
      { name: "title", type: "text", label: "Title", required: true },
      { name: "notes", type: "textarea", label: "Note", required: false },
      { name: "pdf", type: "file", label: "Upload Document (Optional)", required: false }
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
  "emergency-access": [], // Special folder - handled separately
};

const HELPER_TEXTS: Record<string, string> = {
  "identity-vital": "These documents are required for insurance claims, bank access, and legal processes.",
  "finance-investments": "This helps your family know where to start. Add more later.",
  "insurance": "In emergencies, this folder is the single most valuable for nominees. At least one term and health insurance policy is recommended.",
  "loans-liabilities": "Families often discover loans late → legal + credit issues.",
  "legal-property": "Even a simple will avoids confusion.",
  "digital-assets": "Online Accounts & Apps Details for Nominees. Would help with easy access and perform actions like Close/Transfer.",
  "emergency-access": "Choose someone you trust to access your vault if needed. Set access rules and permissions for emergency situations.",
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
}: FolderDetailViewProps) {
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; type: string; title: string; tags: string[]; s3Key?: string | null; decryptedFields?: Record<string, any> } | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; title: string } | null>(null);

  if (!isOpen) return null;

  // Special handling for Emergency Access Setup folder
  if (category.id === "emergency-access") {
    return (
      <EmergencyAccessView
        isOpen={isOpen}
        onClose={onClose}
        category={category}
        vaultId={vaultId}
        vaultType={vaultType}
        nominees={nominees}
        onAddNominee={onAddNominee}
      />
    );
  }

  const templates = DOCUMENT_TEMPLATES[category.id] || [];
  const requiredDocs = templates.filter(t => t.required);
  const optionalDocs = templates.filter(t => !t.required);

  // Categories that need sections with multiple rows
  const categoriesWithSections = ["finance-investments", "insurance", "loans-liabilities", "digital-assets", "legal-property"];
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
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">🔴 Must-have</span>;
      case "good-to-have":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">🟡 Good to Have</span>;
      case "optional":
        return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-700 text-slate-400">⚪ Optional</span>;
    }
  };

  const handleAddDocument = async (documentType: string) => {
    setSelectedDocumentType(documentType);
    setShowAddForm(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-slate-900 rounded-lg border border-slate-800 w-full max-w-3xl p-6 my-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-brand-500/20 flex items-center justify-center">
                <span className="text-xl">📁</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{category.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {getPriorityBadge(category.priority)}
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-300 mt-2">
              {HELPER_TEXTS[category.id] || category.microcopy}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>


        {/* Document Cards or Sections */}
        <div className="space-y-3 mb-6">
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
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">Required Documents</h3>
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
                  <h3 className="text-xs font-semibold text-slate-400 mb-2">Optional Documents</h3>
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
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-white mb-2">Delete Item</h3>
              <p className="text-sm text-slate-300 mb-6">
                Are you sure you want to delete "{deleteConfirmItem.title}"? This action cannot be undone.
              </p>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirmItem(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
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
}: {
  card: DocumentCard;
  template: { type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string };
  onAdd: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  isDeleting?: boolean;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-center gap-3 flex-1">
        {card.status === "uploaded" ? (
          <Check className="w-5 h-5 text-green-400" />
        ) : (
          <Plus className="w-5 h-5 text-slate-500" />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-white">{card.title}</h4>
            {card.template && (
              <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded">
                {card.template.label}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {card.status === "uploaded" ? (
          <>
            {onDownload && card.item?.s3Key && (
              <button
                onClick={onDownload}
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                title="Download"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onEdit}
              className="p-2 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 rounded transition-colors"
              title="Edit"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onAdd}
            className="px-3 py-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded transition-colors"
          >
            ➕ add
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
  const [file, setFile] = useState<File | null>(null);
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
    
    if (!isValid) return;
    
    setSaving(true);
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) {
        alert("Vault is locked. Please unlock it first.");
        return;
      }
      await onSave(fields, file, vaultKey);
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
      setFile(null);
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
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {renderField(field, value, (val) => handleFieldChange(field.name, val), fieldErrors, documentType, fields)}
        {fieldErrors[field.name] && (
          <p className="text-xs text-red-400 mt-1">{fieldErrors[field.name]}</p>
        )}
        {field.helpText && (
          <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
        )}
        {showConditional && field.conditionalFields && field.conditionalFields.fields.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-slate-700">
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
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
        <div className="p-6 pb-4">
          <h3 className="text-lg font-bold text-white mb-4">Add {template.label}</h3>
          {template.helpText && (
            <p className="text-sm text-slate-300 mb-4 p-3 bg-slate-700/30 rounded-lg">
              {template.helpText}
            </p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 px-6 pb-6">
          {/* Title field - allow editing during first time fill */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={fields.title || ""}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-brand-500"
              placeholder="Enter title"
            />
          </div>
          {template.fields.map(field => {
            if (field.type === "file") {
              return (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                  {!field.required && (
                    <p className="text-xs text-slate-400 mt-1">Optional</p>
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
          <div className="flex items-center gap-3 pt-4 border-t border-slate-700 sticky bottom-0 bg-slate-800 pb-2 -mx-6 px-6 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
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
    const showConditional = field.conditionalFields && 
      fields[field.conditionalFields.condition] === field.conditionalFields.value;

    return (
      <div key={field.name} style={{ marginLeft: `${depth * 20}px` }}>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {field.label}
          {field.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {renderField(field, value, (val) => handleFieldChange(field.name, val), fieldErrors, item.type, fields)}
        {fieldErrors[field.name] && (
          <p className="text-xs text-red-400 mt-1">{fieldErrors[field.name]}</p>
        )}
        {field.helpText && (
          <p className="text-xs text-slate-400 mt-1">{field.helpText}</p>
        )}
        {showConditional && field.conditionalFields && field.conditionalFields.fields.length > 0 && (
          <div className="mt-3 space-y-3 pl-4 border-l-2 border-slate-700">
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
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl p-6 my-8 max-h-[90vh] flex flex-col">
        <h3 className="text-lg font-bold text-white mb-4">Edit {template.label}</h3>
        {template.helpText && (
          <p className="text-sm text-slate-300 mb-4 p-3 bg-slate-700/30 rounded-lg">
            {template.helpText}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          {/* Title field */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Title
            </label>
            <input
              type="text"
              value={fields.title || item.title}
              onChange={(e) => setFields({ ...fields, title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-brand-500"
              placeholder="Enter title"
              required
            />
          </div>

          {/* Other fields from template */}
          {template.fields.map(field => {
            if (field.type === "file") {
              return (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    {file ? "Replace Document (optional)" : "Document (optional)"}
                  </label>
                  {hasDocument && fileName && !file && (
                    <div className="mb-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-xs text-slate-300">
                        <span className="text-slate-400">Current document:</span> {fileName}
                      </p>
                    </div>
                  )}
                  <div className="relative">
                    {hasDocument && !file ? (
                      <>
                        <input
                          type="file"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          id={`file-input-${item.id}`}
                        />
                        <button
                          type="button"
                          onClick={() => document.getElementById(`file-input-${item.id}`)?.click()}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-300 cursor-pointer hover:border-slate-600 hover:bg-slate-800 transition-colors font-medium"
                        >
                          Choose File
                        </button>
                      </>
                    ) : (
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white [&::file-selector-button]:hidden [&::-webkit-file-upload-button]:hidden"
                      />
                    )}
                  </div>
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
          <div className="flex items-center gap-3 pt-4 border-t border-slate-700 sticky bottom-0 bg-slate-800 pb-2 -mx-2 px-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
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

function EmergencyAccessView({
  isOpen,
  onClose,
  category,
  vaultId,
  vaultType,
  nominees = [],
  onAddNominee,
}: {
  isOpen: boolean;
  onClose: () => void;
  category: CategoryConfig;
  vaultId: string;
  vaultType: "my_vault" | "family_vault";
  nominees?: Array<{
    id: string;
    nomineeName: string;
    nomineeEmail: string | null;
    nomineePhone: string | null;
    accessTriggerDays: number;
    isActive: boolean;
  }>;
  onAddNominee?: () => void;
}) {
  if (!isOpen) return null;

  const activeNominees = nominees.filter(n => n.isActive);
  const isConfigured = activeNominees.length > 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{category.name}</h2>
              <p className="text-xs text-slate-400 mt-1">{category.microcopy}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              {isConfigured ? (
                <>
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Emergency access configured</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">Emergency access not configured</span>
                </>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isConfigured
                ? `${activeNominees.length} nominee${activeNominees.length > 1 ? "s" : ""} can access this vault in case of emergency.`
                : "No nominees have been assigned. Add a nominee to enable emergency access."}
            </p>
          </div>

          {/* Nominees List */}
          {activeNominees.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Configured Nominees</h3>
              <div className="space-y-3">
                {activeNominees.map((nominee) => (
                  <div
                    key={nominee.id}
                    className="p-4 bg-slate-800/50 rounded-lg border border-slate-700"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <UserPlus className="w-4 h-4 text-slate-400" />
                          <span className="text-sm font-medium text-white">{nominee.nomineeName}</span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-400">
                          {nominee.nomineeEmail && (
                            <div>Email: {nominee.nomineeEmail}</div>
                          )}
                          {nominee.nomineePhone && (
                            <div>Phone: {nominee.nomineePhone}</div>
                          )}
                          <div>Access after: {nominee.accessTriggerDays} day{nominee.accessTriggerDays !== 1 ? "s" : ""} of inactivity</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add Nominee Button */}
          {onAddNominee && (
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={onAddNominee}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors font-medium"
              >
                <Plus className="w-4 h-4" />
                {activeNominees.length === 0 ? "Add Nominee" : "Add Another Nominee"}
              </button>
            </div>
          )}
        </div>
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
}) {
  // For Finance, group into Bank Accounts and Investments sections
  if (category.id === "finance-investments") {
    const bankAccountTemplate = templates.find(t => t.type === "bank-account");
    const investmentTemplate = templates.find(t => t.type === "investment");
    const bankAccounts = itemsByType["bank-account"] || [];
    const investments = itemsByType["investment"] || [];

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
        />
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
}: {
  title: string;
  description: string;
  template?: { type: string; label: string; required: boolean; fields: FieldDefinition[]; helpText?: string };
  items: Array<{ id: string; category: string; title: string; tags: string[]; s3Key?: string | null; iv?: string | null }>;
  minRows: number;
  onAdd: () => void;
  onEdit: (itemId: string, documentType: string) => void;
  onDelete: (itemId: string, itemTitle: string) => void;
  onDownload?: (itemId: string) => Promise<void>;
  isDeleting: string | null;
}) {
  // Ensure minimum rows are displayed
  const displayItems = [...items];
  while (displayItems.length < minRows) {
    displayItems.push({ id: `placeholder-${displayItems.length}`, category: "", title: "", tags: [], s3Key: null, iv: null });
  }

  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-slate-400 mt-1">{description}</p>
        </div>
        <button
          onClick={onAdd}
          className="px-3 py-1.5 text-xs font-medium text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add more
        </button>
      </div>
      
      <div className="space-y-2">
        {displayItems.map((item, index) => {
          const isPlaceholder = item.id.startsWith("placeholder-");
          const hasFile = !!item.s3Key;
          
          return (
            <div
              key={item.id || index}
              className="flex items-center justify-between p-3 bg-slate-900/50 rounded border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                {isPlaceholder ? (
                  <Plus className="w-4 h-4 text-slate-500" />
                ) : (
                  <Check className="w-4 h-4 text-green-400" />
                )}
                <div className="flex-1">
                  {isPlaceholder ? (
                    <span className="text-sm text-slate-500"></span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-white">{item.title || title}</h4>
                        {template && (
                          <span className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-300 rounded">
                            {template.label}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              {!isPlaceholder && (
                <div className="flex items-center gap-2">
                  {onDownload && hasFile && (
                    <button
                      onClick={() => onDownload(item.id)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(item.id, template?.type || "")}
                    className="p-1.5 text-slate-400 hover:text-yellow-400 hover:bg-slate-700 rounded transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(item.id, item.title || title)}
                    disabled={isDeleting === item.id}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
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
