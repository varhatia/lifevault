export type CategoryPriority = "must-have" | "good-to-have" | "optional";

export type CategoryConfig = {
  id: string;
  name: string;
  priority: CategoryPriority;
  microcopy: string;
};

export const CATEGORIES_CONFIG: Array<CategoryConfig> = [
  {
    id: "identity-vital",
    name: "Identity & Vital Records",
    priority: "must-have",
    microcopy: "Basic identity documents that are often needed for verification and claims",
  },
  {
    id: "finance-investments",
    name: "Banking, Investments & Tax Records",
    priority: "must-have",
    microcopy: "Details of your main savings, salary, or joint accounts so your family knows where funds are held.",
  },
  {
    id: "insurance",
    name: "Insurance",
    priority: "must-have",
    microcopy: "Insurance documents help your family make timely claims without confusion.",
  },
  {
    id: "loans-liabilities",
    name: "Loans & Liabilities",
    priority: "good-to-have",
    microcopy: "Organize details of outstanding loans (if any) & details of any other liabilities.",
  },
  {
    id: "digital-assets", // Display name will be "Online Accounts & Digital Footprint"
    name: "Online Accounts & Digital Footprint",
    priority: "good-to-have",
    microcopy: "Online account like Email, Social media, Investment Apps, Cloud Storage. Document recovery methods and what to do: Close / Transfer / Memorialize. Avoid storing passwords directly.",
  },
  {
    id: "legal-property",
    name: "Property & Legal Planning",
    priority: "optional",
    microcopy: "Property and Legal documents to help with quick access of important documents.",
  },
];

