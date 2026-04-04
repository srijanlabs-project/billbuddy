import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { apiFetch } from "./api";
import SettingsPage from "./components/SettingsPage";
import ConfigurationStudio from "./components/ConfigurationStudio";
import ProductsPage from "./components/ProductsPage";
import OrdersPage from "./components/OrdersPage";
import OrderDetailPage from "./components/OrderDetailPage";
import CustomersPage from "./components/CustomersPage";
import UsersPage from "./components/UsersPage";
import ApprovalsPage from "./components/ApprovalsPage";
import SubscriptionsPage from "./components/SubscriptionsPage";
import PlansPage from "./components/PlansPage";
import LeadsPage from "./components/LeadsPage";
import NotificationsPage from "./components/NotificationsPage";
import DashboardPage from "./components/DashboardPage";
import HelpCenterPage from "./components/HelpCenterPage";
import RbacMatrixPage from "./components/RbacMatrixPage";
import GoLiveGatePage from "./components/GoLiveGatePage";
import SellerDetailModal from "./components/SellerDetailModal";
import NotificationDetailModal from "./components/NotificationDetailModal";
import SubscriptionDetailModal from "./components/SubscriptionDetailModal";
import PlanDetailModal from "./components/PlanDetailModal";
import SellerNotificationsModal from "./components/SellerNotificationsModal";
import QuotationWizardModal from "./components/QuotationWizardModal";
import useQuotationWizard from "./hooks/useQuotationWizard";
import useSellerConfigurationStudio from "./hooks/useSellerConfigurationStudio";
import { applyShippingAddressGstReuse, createEmptyShippingAddress, updateShippingAddressValue } from "./utils/customerShipping";
import {
  getQuotationCustomFieldEntries,
  getQuotationItemDimensionText,
  getQuotationItemQuantityValue,
  getQuotationItemRateValue,
  getQuotationItemTitle,
  getQuotationItemTotalValue
} from "./utils/quotationView";
import quicksyLogo from "./assets/QUICKSY_1.png";
import samsonaLogo from "./assets/Samsona_Services_Logo_Transparent.png";
import srijanLabsLogo from "./assets/Srijan_Labs.png";
import srijanHero from "./assets/srijan_hero.png";
import spanLogo from "./assets/span.jpeg";

const REMEMBER_ME_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const AUTH_STORAGE_KEY = "billbuddyAuth";
const COOKIE_CONSENT_STORAGE_KEY = "quotsyCookieConsent";

const SELLER_MODULES = [
  "Dashboard",
  "Orders",
  "Products",
  "Customers",
  "Approvals",
  "Subscriptions",
  "Help Center",
  "Roles & Permissions",
  "Users",
  "Configuration Studio",
  "Settings"
];

const SUB_USER_MODULES = ["Dashboard", "Help Center"];

const PLATFORM_MODULES = [
  "Dashboard",
  "Help Center",
  "Roles & Permissions",
  "Go-Live Gate",
  "Leads",
  "Sellers",
  "Configuration Studio",
  "Subscriptions",
  "Plans",
  "Notifications",
  "Users",
  "Settings"
];

const QUICK_ACTIONS = ["Create Quotation", "Add Customer"];

const THEME_OPTIONS = [
  { value: "matte-blue", label: "Matte Blue" },
  { value: "sky-blue", label: "Sky Blue" },
  { value: "deep-ocean", label: "Deep Ocean" },
  { value: "cobalt-frost", label: "Cobalt Frost" }
];

const SELLER_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
  { value: "inactive", label: "Inactive" }
];

const BILLING_CYCLE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" }
];

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active (Paid)" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
  { value: "suspended", label: "Suspended" }
];

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "demo_scheduled", label: "Demo Scheduled" },
  { value: "demo_created", label: "Demo Created" },
  { value: "follow_up", label: "Follow-up" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" }
];

const BUSINESS_CATEGORY_SEGMENTS = {
  "Retail & Commerce": [
    "Grocery & Kirana",
    "Supermarkets & Hypermarkets",
    "Fashion & Apparel",
    "Footwear",
    "Electronics & Gadgets",
    "Furniture & Home Decor",
    "Jewelry & Accessories",
    "Books & Stationery",
    "Toys & Gifts",
    "Pet Supplies"
  ],
  "Food & Beverage (F&B)": [
    "Restaurants (Casual Dining / Fine Dining)",
    "QSR (Quick Service Restaurants)",
    "Cloud Kitchens",
    "Cafes & Bakeries",
    "Sweet Shops / Mithai",
    "Juice & Beverage Shops",
    "Catering Services",
    "Tiffin / Meal Services"
  ],
  "Services (Local + Professional)": [
    "Salons & Beauty Parlours",
    "Spa & Wellness",
    "Laundry & Dry Cleaning",
    "Repair Services (Mobile, Electronics, Appliances)",
    "Home Services (Plumbing, Electrical, Carpentry)",
    "Event Services (Photography, Decorators)",
    "Travel & Ticketing",
    "Packers & Movers"
  ],
  "Healthcare & Pharma": [
    "Hospitals",
    "Clinics (General / Specialist)",
    "Diagnostic Labs",
    "Pharmacies / Medical Stores",
    "Physiotherapy Centers",
    "Ayurveda / Homeopathy",
    "Fitness Centers / Gyms"
  ],
  "Education & Training": [
    "Schools",
    "Colleges",
    "Coaching Institutes",
    "Online Learning Platforms",
    "Skill Development Centers",
    "Music / Dance / Art Classes",
    "Tuition Centers"
  ],
  "Manufacturing & Industrial": [
    "FMCG Manufacturing",
    "Textile Manufacturing",
    "Automotive Parts",
    "Electronics Manufacturing",
    "Packaging Units",
    "Chemical & Pharma Manufacturing",
    "Food Processing Units"
  ],
  "Wholesale & Distribution (Critical for India GT)": [
    "FMCG Distributors",
    "Stockists",
    "Super Stockists",
    "B2B Traders",
    "Importers & Exporters",
    "Commodity Traders"
  ],
  "Real Estate & Infrastructure": [
    "Builders & Developers",
    "Real Estate Brokers",
    "Property Management",
    "Construction Companies",
    "Interior Designers",
    "Architects"
  ],
  "Financial Services": [
    "Banks",
    "NBFCs",
    "Insurance Agencies",
    "Loan Providers",
    "Investment Advisors",
    "Fintech Platforms",
    "Payment Gateways"
  ],
  "Logistics & Transportation": [
    "Courier Services",
    "Last-Mile Delivery",
    "Fleet Operators",
    "Warehousing",
    "Cold Storage",
    "Freight & Cargo"
  ],
  "Technology & Digital Businesses": [
    "SaaS Companies",
    "IT Services",
    "Software Development Firms",
    "Digital Marketing Agencies",
    "Web & App Development",
    "AI/ML Solutions",
    "Cybersecurity Firms"
  ],
  "Media, Entertainment & Advertising": [
    "Advertising Agencies",
    "Digital Media",
    "Production Houses",
    "Event Management Companies",
    "Influencer Agencies",
    "OOH & Digital Signage"
  ],
  "Agriculture & Allied": [
    "Farmers / Producers",
    "Agri Input Suppliers (Seeds, Fertilizers)",
    "Dairy Farms",
    "Poultry & Fisheries",
    "Agri Tech Platforms"
  ],
  "Hospitality & Tourism": [
    "Hotels & Resorts",
    "Homestays",
    "Travel Agencies",
    "Tour Operators"
  ],
  "Government & Non-Profit": [
    "Government Bodies",
    "NGOs",
    "Trusts & Foundations",
    "Associations"
  ]
};

const BUSINESS_CATEGORY_OPTIONS = Object.keys(BUSINESS_CATEGORY_SEGMENTS);
const PERMISSION_KEYS = {
  dashboardView: "dashboard.view",
  quotationView: "quotation.view",
  quotationCreate: "quotation.create",
  quotationSearch: "quotation.search",
  quotationDownloadPdf: "quotation.download_pdf",
  quotationEdit: "quotation.edit",
  quotationRevise: "quotation.revise",
  quotationSend: "quotation.send",
  quotationMarkPaid: "quotation.mark_paid",
  customerView: "customer.view",
  customerCreate: "customer.create",
  customerEdit: "customer.edit",
  productView: "product.view",
  productCreate: "product.create",
  productEdit: "product.edit",
  userView: "user.view",
  userCreate: "user.create",
  userEdit: "user.edit",
  notificationView: "notification.view",
  subscriptionView: "subscription.view",
  settingsView: "settings.view",
  configurationView: "configuration.view",
  approvalRequest: "approval.request",
  approvalViewOwn: "approval.view_own",
  approvalViewTeam: "approval.view_team",
  approvalDecide: "approval.decide",
  approvalOverride: "approval.override",
  settingsEdit: "settings.edit",
  configurationEdit: "configuration.edit",
  configurationSaveDraft: "configuration.save_draft",
  configurationPublish: "configuration.publish"
};

function getBusinessSegments(category) {
  return BUSINESS_CATEGORY_SEGMENTS[category] || [];
}

function approvalStatusLabel(status) {
  const normalized = String(status || "not_required").toLowerCase();
  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "pending") return "Pending Approval";
  return "Not Required";
}

function createInitialUserForm() {
  return {
    name: "",
    mobile: "",
    password: "",
    roleId: "",
    createdBy: "",
    status: true,
    approvalMode: "requester",
    approvalLimitAmount: "",
    canApproveQuotations: false,
    canApprovePriceException: false,
    approverUserId: "",
    requesterUserIds: []
  };
}

const ORDER_STATUS_OPTIONS = [
  { value: "NEW", label: "New" },
  { value: "READY_DISPATCH", label: "Ready for Dispatched" },
  { value: "READY_PICKUP", label: "Ready for Pickup" },
  { value: "DELIVERED", label: "Delivered" }
];

const MODULE_META = {
  Dashboard: { eyebrow: "Control Center", title: "Operations Dashboard", subtitle: "A polished daily cockpit for quotations, dispatch, and receivables." },
  "Help Center": { eyebrow: "Support", title: "Help Center", subtitle: "Understand Quotsy workflows, search FAQs, and get role-aware guidance in one place." },
  Users: { eyebrow: "Access", title: "User Access Management", subtitle: "Create master users and team accounts with clear role control." },
  Approvals: { eyebrow: "Governance", title: "Quotation Approvals", subtitle: "Review pending exceptions, approve or reject requests, and keep only the latest quotation version moving forward." },
  Orders: { eyebrow: "Workflow", title: "Quotation Tracker", subtitle: "Monitor quotation status, payment flow, and message-based quotation capture." },
  Products: { eyebrow: "Catalogue", title: "Product Catalogue", subtitle: "Manage upload-ready product structure for matching, inventory, and pricing." },
  Customers: { eyebrow: "CRM", title: "Customer Directory", subtitle: "Keep your customer master clean, searchable, and ready for quotation flow." },
  "Configuration Studio": { eyebrow: "Schema", title: "Configuration Studio", subtitle: "Configure seller-specific catalogue structure, quotation columns, preview, and publishing in one workspace." },
  Subscriptions: { eyebrow: "Plan", title: "Subscription History", subtitle: "Review active, expired, suspended, and historical subscriptions for this seller account." },
  Settings: { eyebrow: "Configuration", title: "Business Settings", subtitle: "Fine tune seller branding, message decoding, quotation design, and platform setup." }
};

const QUOTATION_TEMPLATE_PRESETS = {
  default: {
    label: "Default Template",
    description: "Balanced default quotation layout with GST strip, customer/meta blocks, config-driven item table, totals, and signature panel.",
    defaults: {
      header_text: "Quotation",
      body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
      footer_text: "Thank you for your business.",
      accent_color: "#737373",
      notes_text: "",
      terms_text: ""
    }
  }
};

const QUOTATION_THEME_OPTIONS = {
  default: {
    label: "Default",
    accessTier: "FREE",
    description: "Clean neutral look for demo and free access.",
    accent: "#737373",
    header: "#4B5563",
    surface: "#F3F4F6",
    border: "#D1D5DB",
    text: "#111827",
    muted: "#6B7280"
  },
  royal_blue: {
    label: "Royal Blue",
    accessTier: "PAID",
    description: "Trustworthy commercial blue with clear table contrast.",
    accent: "#1D4ED8",
    header: "#1D4ED8",
    surface: "#DBEAFE",
    border: "#93C5FD",
    text: "#1E3A8A",
    muted: "#475569"
  },
  slate_professional: {
    label: "Slate Professional",
    accessTier: "PAID",
    description: "Premium neutral gray for broad B2B use.",
    accent: "#374151",
    header: "#1F2937",
    surface: "#F3F4F6",
    border: "#CBD5E1",
    text: "#111827",
    muted: "#6B7280"
  },
  warm_ivory: {
    label: "Warm Ivory",
    accessTier: "PAID",
    description: "Softer premium warmth without changing the layout.",
    accent: "#0F3D56",
    header: "#0F3D56",
    surface: "#F8F3EC",
    border: "#E0D4C5",
    text: "#4B3B2F",
    muted: "#7A6A58"
  },
  forest_ledger: {
    label: "Forest Ledger",
    accessTier: "PAID",
    description: "Grounded document feel with deep green emphasis.",
    accent: "#166534",
    header: "#166534",
    surface: "#DCFCE7",
    border: "#86EFAC",
    text: "#14532D",
    muted: "#4D6B57"
  },
  steel_grid: {
    label: "Steel Grid",
    accessTier: "PAID",
    description: "Technical industrial palette with stronger structure.",
    accent: "#334155",
    header: "#334155",
    surface: "#E2E8F0",
    border: "#94A3B8",
    text: "#1F2937",
    muted: "#475569"
  },
  frosted_aura: {
    label: "Frosted Aura",
    accessTier: "PAID",
    description: "Calm frosted blue-gray theme for selective premium use.",
    accent: "#5C7E8F",
    header: "#5C7E8F",
    surface: "#D4DDE2",
    border: "#A2A2A2",
    text: "#374151",
    muted: "#6B7280"
  },
  sorbet: {
    label: "Sorbet",
    accessTier: "PREMIUM",
    description: "Soft sage and blush neutrals for a polished premium feel.",
    accent: "#BA9A91",
    header: "#B7C396",
    surface: "#EDECEC",
    border: "#CCCCCC",
    text: "#4B5563",
    muted: "#7A6E68"
  },
  calcite: {
    label: "Calcite",
    accessTier: "PREMIUM",
    description: "Industrial charcoal and mineral orange with a clean document base.",
    accent: "#FD7B41",
    header: "#3C4044",
    surface: "#EDBF9B",
    border: "#DDDCDB",
    text: "#3C4044",
    muted: "#7C5E4E"
  },
  lapis_velvet_evening: {
    label: "Lapis Velvet Evening",
    accessTier: "PREMIUM",
    description: "Deep blue and velvet plum for a richer premium presentation.",
    accent: "#893172",
    header: "#213885",
    surface: "#ECDFD2",
    border: "#CCCACC",
    text: "#213885",
    muted: "#5B6475"
  },
  opaline: {
    label: "Opaline",
    accessTier: "PREMIUM",
    description: "Minimal neutral grays with a fresh coral highlight.",
    accent: "#FF634A",
    header: "#FF634A",
    surface: "#E7E7E7",
    border: "#D2D2D4",
    text: "#374151",
    muted: "#6B7280"
  },
  tropical_heat: {
    label: "Tropical Heat",
    accessTier: "NICHE",
    description: "High-energy turquoise and citrus-orange for bold branded sellers.",
    accent: "#EB4203",
    header: "#00CEC8",
    surface: "#FCEFC3",
    border: "#FF9C5F",
    text: "#8A3600",
    muted: "#0C6663"
  },
  honey_opal_sunset: {
    label: "Honey Opal Sunset",
    accessTier: "NICHE",
    description: "Golden commercial warmth with a darker executive contrast.",
    accent: "#ECB914",
    header: "#4F3D35",
    surface: "#F6D579",
    border: "#CBB8A0",
    text: "#4F3D35",
    muted: "#7C5D26"
  },
  seashell_garnet_afternoon: {
    label: "Seashell Garnet Afternoon",
    accessTier: "NICHE",
    description: "Creative coral, teal, and steel-blue mix for standout premium quoting.",
    accent: "#09A1A1",
    header: "#30525C",
    surface: "#ACC0D3",
    border: "#D396A6",
    text: "#30525C",
    muted: "#7F4E60"
  }
};

function createFixedFreeFooterBannerDataUrl() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="120" viewBox="0 0 1600 120">
      <defs>
        <linearGradient id="qbg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="70%" stop-color="#f8fbff"/>
          <stop offset="100%" stop-color="#d9e8ff"/>
        </linearGradient>
        <linearGradient id="qwave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
          <stop offset="100%" stop-color="#7fb4ff" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="1600" height="120" rx="8" fill="url(#qbg)"/>
      <rect x="0.5" y="0.5" width="1599" height="119" rx="7.5" fill="none" stroke="#d5dbe6"/>
      <path d="M1170 120 C1290 48 1430 156 1600 26 L1600 120 Z" fill="url(#qwave)"/>
      <path d="M1040 118 C1210 86 1355 96 1600 68" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.85"/>
      <path d="M1100 106 C1270 80 1410 82 1600 50" fill="none" stroke="#fff7d6" stroke-width="3" opacity="0.7"/>
      <text x="120" y="72" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#0f2a4d">Quotsy</text>
      <text x="280" y="72" font-family="Arial, sans-serif" font-size="18" fill="#445066">Powered by Quotsy - Simplify your quoting process</text>
      <text x="1455" y="46" font-family="Arial, sans-serif" font-size="20" fill="#d4a938">✦</text>
      <text x="1490" y="60" font-family="Arial, sans-serif" font-size="14" fill="#e5c56a">✦</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const FIXED_FREE_FOOTER_BANNER = createFixedFreeFooterBannerDataUrl();

function getQuotationThemeConfig(themeKey) {
  return QUOTATION_THEME_OPTIONS[themeKey] || QUOTATION_THEME_OPTIONS.default;
}

function getPlanTemplateAccessTier(subscription) {
  if (!subscription) return "FREE";
  if (subscription.is_demo_plan) return "FREE";
  const tier = String(subscription.template_access_tier || "").trim().toUpperCase();
  return ["FREE", "PAID", "PREMIUM", "NICHE"].includes(tier) ? tier : "FREE";
}

function isThemeAccessibleForTier(themeTier, planTier) {
  const order = { FREE: 0, PAID: 1, PREMIUM: 2, NICHE: 3 };
  const normalizedThemeTier = order[themeTier] !== undefined ? themeTier : "FREE";
  const normalizedPlanTier = order[planTier] !== undefined ? planTier : "FREE";
  return order[normalizedPlanTier] >= order[normalizedThemeTier];
}

const PLATFORM_MODULE_META = {
  Dashboard: { eyebrow: "Platform", title: "Quotsy Control Plane", subtitle: "See seller growth, billing drivers, onboarding progress, and account health in one place." },
  "Help Center": { eyebrow: "Support", title: "Help Center", subtitle: "Search guides and FAQs for platform operations, seller onboarding, and product usage." },
  "Roles & Permissions": { eyebrow: "Governance", title: "Roles & Permissions", subtitle: "Review the current RBAC model, role coverage, and permission boundaries used across platform and seller scopes." },
  "Go-Live Gate": { eyebrow: "Security", title: "Go-Live Gate Sheet", subtitle: "Track production readiness controls, owners, and closure targets before launch." },
  Leads: { eyebrow: "Pipeline", title: "Lead Management", subtitle: "Capture, qualify, and progress prospective sellers from first touch to onboarding." },
  Sellers: { eyebrow: "Tenants", title: "Seller Management", subtitle: "Create sellers, review lifecycle, and manage tenant health from a dedicated operating screen." },
  "Configuration Studio": { eyebrow: "Schema", title: "Seller Configuration Studio", subtitle: "Configure catalogue fields, quotation columns, preview, and publishing as a full workspace instead of a modal." },
  Subscriptions: { eyebrow: "Entitlements", title: "Subscription Management", subtitle: "Review active seller plans, trial windows, and plan state without mixing it into seller profile edits." },
  Plans: { eyebrow: "Commercials", title: "Plan Management", subtitle: "Manage Quotsy plans, feature limits, and upgrade paths in one place." },
  Notifications: { eyebrow: "Engagement", title: "Notification Center", subtitle: "Create platform notices for seller segments and review delivery logs in one place." },
  Users: { eyebrow: "Platform Access", title: "Platform User Management", subtitle: "Control platform-level user access, seller-side administrators, and access governance." },
  Settings: { eyebrow: "Platform Setup", title: "Platform Settings", subtitle: "Onboard sellers, manage lifecycle, and configure the SaaS operating model." }
};

const SUPPORTED_CATALOGUE_FIELD_META = {
  material_name: { formKey: "materialName", label: "Product / Service Name", inputType: "text", required: true },
  material_group: { formKey: "materialGroup", label: "Material Group", inputType: "text" },
  category: { formKey: "category", label: "Category", inputType: "text", required: true },
  color_name: { formKey: "colorName", label: "Colour Name", inputType: "text" },
  thickness: { formKey: "thickness", label: "Thickness", inputType: "text" },
  unit_type: { formKey: "unitType", label: "Unit Type", inputType: "unit-select" },
  pricing_type: { formKey: "pricingType", label: "Pricing Type", inputType: "pricing-select" },
  base_price: { formKey: "basePrice", label: "Base Price", inputType: "number", required: true },
  limit_rate_edit: { formKey: "limitRateEdit", label: "Limit Rate Edit", inputType: "checkbox" },
  max_discount_percent: { formKey: "maxDiscountPercent", label: "Max Discount Limit", inputType: "text" },
  sku: { formKey: "sku", label: "SKU ID", inputType: "text", required: true },
  always_available: { formKey: "alwaysAvailable", label: "Always Available", inputType: "checkbox" },
  ps_supported: { formKey: "psSupported", label: "PS Supported", inputType: "checkbox" }
};

const MANDATORY_SYSTEM_CATALOGUE_KEYS = ["material_name", "category", "sku"];
const ALWAYS_INCLUDED_CATALOGUE_KEYS = [...MANDATORY_SYSTEM_CATALOGUE_KEYS, "limit_rate_edit", "max_discount_percent"];

const SUPPORTED_QUOTATION_COLUMN_META = {
  material_name: { formKey: "materialName", label: "Material Name", inputType: "text" },
  category: { formKey: "category", label: "Category", inputType: "category-select" },
  width: { formKey: "width", label: "Width", inputType: "number" },
  height: { formKey: "height", label: "Height", inputType: "number" },
  unit: { formKey: "unit", label: "Unit", inputType: "unit-select" },
  thickness: { formKey: "thickness", label: "Thickness", inputType: "text" },
  color_name: { formKey: "color", label: "Colour", inputType: "text" },
  other_info: { formKey: "otherInfo", label: "Other Info", inputType: "text" },
  ps: { formKey: "ps", label: "PS", inputType: "checkbox" },
  quantity: { formKey: "quantity", label: "Quantity", inputType: "number" },
  rate: { formKey: "rate", label: "Rate", inputType: "number" },
  note: { formKey: "note", label: "Item Note", inputType: "text", fullWidth: true }
};

function clearStoredAuth() {
  try {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getStoredAuth() {
  try {
    const rawSession = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const rawLocal = localStorage.getItem(AUTH_STORAGE_KEY);
    const raw = rawSession || rawLocal;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.token) {
      clearStoredAuth();
      return null;
    }

    if (parsed.sessionExpiresAt) {
      const expiresAt = new Date(parsed.sessionExpiresAt).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        clearStoredAuth();
        return null;
      }
    }

    return parsed;
  } catch {
    clearStoredAuth();
    return null;
  }
}

function PhoneFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2a1.5 1.5 0 0 1 1.5-.36c1.18.39 2.42.59 3.7.59A1.4 1.4 0 0 1 22 16.84V20a1.4 1.4 0 0 1-1.4 1.4C10.33 21.4 2.6 13.67 2.6 4.4A1.4 1.4 0 0 1 4 3h3.16a1.4 1.4 0 0 1 1.4 1.4c0 1.28.2 2.52.59 3.7a1.5 1.5 0 0 1-.36 1.5l-2.19 2.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockFieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 10V7.75a5 5 0 1 1 10 0V10m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeFieldIcon({ open = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.75 12s3.35-5.5 9.25-5.5 9.25 5.5 9.25 5.5-3.35 5.5-9.25 5.5S2.75 12 2.75 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {!open && <path d="m4 20 16-16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
    </svg>
  );
}

function formatCurrency(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const IST_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatDateIST(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return IST_DATE_FORMATTER.format(parsed).replace(/\//g, "-");
  }

  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  return raw;
}

function formatQuotationLabel(quotation) {
  const visibleNumber = quotation?.custom_quotation_number || quotation?.seller_quotation_number || quotation?.quotation_number;
  if (!visibleNumber) return "-";
  return `${visibleNumber} (Ver.${quotation.version_no || 1})`;
}

function getVisibleQuotationNumber(quotation) {
  return quotation?.custom_quotation_number || quotation?.seller_quotation_number || quotation?.quotation_number || "";
}

function getQuotationFileStem(quotation) {
  const visibleNumber = getVisibleQuotationNumber(quotation) || "quotation";
  const version = quotation?.version_no || 1;
  return `${String(visibleNumber).replace(/[^a-zA-Z0-9-_]+/g, "_")}-V${version}`;
}

function getStoredCookieConsent() {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    return stored === "accepted" || stored === "rejected" ? stored : "";
  } catch {
    return "";
  }
}

function statusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Partial";
  return "Pending";
}

function orderStatusLabel(status) {
  if (status === "READY_DISPATCH") return "Ready for Dispatched";
  if (status === "READY_PICKUP") return "Ready for Pickup";
  if (status === "DELIVERED") return "Delivered";
  return "New";
}

function renderTemplateText(template, data) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : "";
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");
}

function normalizeConfigKey(value) {
  const normalized = normalizeHeader(value);
  if (normalized === "colour") return "color_name";
  if (normalized === "colour_name") return "color_name";
  if (normalized === "material") return "material_name";
  if (normalized === "service") return "material_name";
  if (normalized === "services") return "material_name";
  if (normalized === "service_name") return "material_name";
  if (normalized === "services_name") return "material_name";
  if (normalized === "service_title") return "material_name";
  if (normalized === "services_title") return "material_name";
  if (normalized === "item_name") return "material_name";
  if (normalized === "product_name") return "material_name";
  if (normalized === "price") return "base_price";
  if (normalized === "item_note") return "note";
  return normalized;
}

function getSupportedCatalogueFields(configuration) {
  const configured = configuration?.catalogueFields || [];
  const fallbackFields = createDefaultSellerConfiguration().catalogueFields;
  const resolved = configured
    .map((field) => {
      const normalizedKey = normalizeConfigKey(field.key);
      if (!SUPPORTED_CATALOGUE_FIELD_META[normalizedKey]) return null;
      return {
        ...field,
        normalizedKey,
        meta: SUPPORTED_CATALOGUE_FIELD_META[normalizedKey]
      };
    })
    .filter(Boolean);

  if (resolved.length) {
    const mandatoryFallbacks = fallbackFields
      .filter((field) => ALWAYS_INCLUDED_CATALOGUE_KEYS.includes(normalizeConfigKey(field.key)))
      .filter((field) => !resolved.some((entry) => entry.normalizedKey === normalizeConfigKey(field.key)))
      .map((field) => ({
        ...field,
        normalizedKey: normalizeConfigKey(field.key),
        meta: SUPPORTED_CATALOGUE_FIELD_META[normalizeConfigKey(field.key)]
      }));
    return [...mandatoryFallbacks, ...resolved];
  }

  return fallbackFields
    .map((field) => ({
      ...field,
      normalizedKey: normalizeConfigKey(field.key),
      meta: SUPPORTED_CATALOGUE_FIELD_META[normalizeConfigKey(field.key)]
    }))
    .filter((field) => field.meta);
}

function getUnsupportedCatalogueFields(configuration) {
  return (configuration?.catalogueFields || []).filter((field) => !SUPPORTED_CATALOGUE_FIELD_META[normalizeConfigKey(field.key)]);
}

function sortConfigEntries(entries = []) {
  return [...entries].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a?.displayOrder)) ? Number(a.displayOrder) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b?.displayOrder)) ? Number(b.displayOrder) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a?.label || a?.key || "").localeCompare(String(b?.label || b?.key || ""));
  });
}

function getSupportedQuotationColumns(configuration) {
  const configured = configuration?.quotationColumns || [];
  const resolved = configured
    .map((column) => {
      const normalizedKey = normalizeConfigKey(column.key);
      if (!SUPPORTED_QUOTATION_COLUMN_META[normalizedKey]) return null;
      return {
        ...column,
        normalizedKey,
        meta: SUPPORTED_QUOTATION_COLUMN_META[normalizedKey]
      };
    })
    .filter(Boolean);

  if (resolved.length) return resolved;

  return createDefaultSellerConfiguration().quotationColumns
    .map((column) => ({
      ...column,
      normalizedKey: normalizeConfigKey(column.key),
      meta: SUPPORTED_QUOTATION_COLUMN_META[normalizeConfigKey(column.key)]
    }))
    .filter((column) => column.meta);
}

function getUnsupportedQuotationColumns(configuration) {
  return (configuration?.quotationColumns || []).filter((column) => !SUPPORTED_QUOTATION_COLUMN_META[normalizeConfigKey(column.key)]);
}

function getProductPreviewFieldValue(row, field) {
  const normalizedKey = field.normalizedKey || normalizeConfigKey(field.key);
  switch (normalizedKey) {
    case "material_name":
      return row.materialName || "-";
    case "category":
      return row.category || "-";
    case "thickness":
      return row.thickness || "-";
    case "unit_type":
      return row.unitType || "-";
    case "base_price":
      return row.basePrice ?? 0;
    case "limit_rate_edit":
      return row.limitRateEdit ? "Yes" : "No";
    case "max_discount_percent":
      return formatMaxDiscountLimit(row.maxDiscountPercent, row.maxDiscountType || "percent") || 0;
    case "sku":
      return row.sku || "-";
    case "material_group":
      return row.materialGroup || "-";
    case "color_name":
      return row.colorName || "-";
    case "always_available":
      return row.alwaysAvailable ? "Yes" : "No";
    case "ps_supported":
      return row.psSupported ? "Yes" : "No";
    case "pricing_type":
      return row.pricingType || "-";
    default:
      return row.customFields?.[field.key] ?? "-";
  }
}

function getProductTemplateSampleValue(fieldKey, fieldLabel = "") {
  const label = String(fieldLabel || "").toLowerCase();
  switch (normalizeConfigKey(fieldKey)) {
    case "material_name":
      return label.includes("service") ? "Installation Service" : "Acrylic";
    case "material_group":
      return "Sheets";
    case "category":
      return "Sheet";
    case "color_name":
      return "White";
    case "thickness":
      return "2 mm";
    case "unit_type":
      return "SFT";
    case "pricing_type":
      return "SFT";
    case "base_price":
      return 15;
    case "limit_rate_edit":
      return false;
    case "max_discount_percent":
      return "10%";
    case "sku":
      return "ACR-2";
    case "always_available":
      return true;
    case "ps_supported":
      return false;
    default:
      return "";
  }
}

function getProductConfigurationFieldValue(product, fieldKey) {
  if (!product) return "";
  const normalizedKey = normalizeConfigKey(fieldKey);
  switch (normalizedKey) {
    case "material_name":
      return product.material_name || "";
    case "category":
      return product.category || "";
    case "thickness":
      return product.thickness || "";
    case "unit_type":
      return product.unit_type || "";
    case "base_price":
      return product.base_price ?? "";
    case "limit_rate_edit":
      return Boolean(product.limit_rate_edit);
    case "max_discount_percent":
      return formatMaxDiscountLimit(product.max_discount_percent, product.max_discount_type || "percent");
    case "sku":
      return product.sku || "";
    case "material_group":
      return product.material_group || "";
    case "color_name":
      return product.color_name || "";
    case "always_available":
      return Boolean(product.always_available);
    case "ps_supported":
      return Boolean(product.ps_supported);
    case "pricing_type":
      return product.pricing_type || "";
    default:
      return product.custom_fields?.[fieldKey] ?? product.custom_fields?.[normalizedKey] ?? "";
  }
}

function getCatalogueDrivenQuotationCustomFields(product, columns = [], currentCustomFields = {}) {
  const nextCustomFields = { ...(currentCustomFields || {}) };
  columns.forEach((column) => {
    const boundValue = getProductConfigurationFieldValue(product, column.key);
    if (boundValue !== "" && boundValue !== null && boundValue !== undefined) {
      nextCustomFields[column.key] = boundValue;
    }
  });
  return nextCustomFields;
}

function getProductFieldDisplayValue(product, fieldKey) {
  switch (normalizeConfigKey(fieldKey)) {
    case "material_name":
      return product.material_name || "-";
    case "material_group":
      return product.material_group || "-";
    case "category":
      return product.category || "-";
    case "color_name":
      return product.color_name || "-";
    case "thickness":
      return product.thickness || "-";
    case "unit_type":
      return product.unit_type || "-";
    case "pricing_type":
      return product.pricing_type || "-";
    case "base_price":
      return product.base_price || "-";
    case "limit_rate_edit":
      return product.limit_rate_edit ? "Yes" : "No";
    case "max_discount_percent":
      return formatMaxDiscountLimit(product.max_discount_percent, product.max_discount_type || "percent") || "0";
    case "sku":
      return product.sku || "-";
    case "always_available":
      return product.always_available ? "Yes" : "No";
    case "ps_supported":
      return product.ps_supported ? "Yes" : "No";
    default:
      return product.custom_fields?.[fieldKey] ?? "-";
  }
}

function getConfiguredOptions(field) {
  return Array.isArray(field?.options)
    ? field.options.map((option) => String(option || "").trim()).filter(Boolean)
    : [];
}

function getOptionsInputValue(field) {
  if (typeof field?.optionsText === "string") return field.optionsText;
  return getConfiguredOptions(field).join(", ");
}

function parseOptionsInput(rawValue) {
  return String(rawValue || "")
    .split(/[,\n|]/)
    .map((option) => option.trim())
    .filter(Boolean);
}

function getCustomProductValidationError(fields = [], customFields = {}) {
  for (const field of fields) {
    const value = customFields?.[field.key];
    const fieldLabel = field.label || field.key || "Custom field";
    const fieldType = String(field.type || "text").toLowerCase();

    if (field.required) {
      if (fieldType === "checkbox") {
        if (value !== true) return `${fieldLabel} is required.`;
      } else if (value === undefined || value === null || String(value).trim() === "") {
        return `${fieldLabel} is required.`;
      }
    }

    if (value !== undefined && value !== null && value !== "") {
      if (fieldType === "number" && Number.isNaN(Number(value))) {
        return `${fieldLabel} must be numeric.`;
      }
      if (fieldType === "checkbox" && typeof value !== "boolean") {
        return `${fieldLabel} must be true or false.`;
      }
      if (fieldType === "dropdown") {
        const allowedOptions = getConfiguredOptions(field);
        if (allowedOptions.length && !allowedOptions.includes(String(value).trim())) {
          return `${fieldLabel} must match one of the configured options.`;
        }
      }
    }
  }

  return "";
}

function getCustomQuotationValidationError(columns = [], customFields = {}) {
  for (const column of columns) {
    const value = customFields?.[column.key];
    const fieldLabel = column.label || column.key || "Custom field";
    const fieldType = String(column.type || "text").toLowerCase();

    if (column.required) {
      if (fieldType === "checkbox") {
        if (value !== true) return `${fieldLabel} is required.`;
      } else if (value === undefined || value === null || String(value).trim() === "") {
        return `${fieldLabel} is required.`;
      }
    }

    if (value !== undefined && value !== null && value !== "") {
      if (fieldType === "number" && Number.isNaN(Number(value))) {
        return `${fieldLabel} must be numeric.`;
      }
      if (fieldType === "checkbox" && typeof value !== "boolean") {
        return `${fieldLabel} must be true or false.`;
      }
      if (fieldType === "dropdown") {
        const allowedOptions = Array.isArray(column.options)
          ? column.options.map((option) => String(option || "").trim()).filter(Boolean)
          : [];
        if (allowedOptions.length && !allowedOptions.includes(String(value).trim())) {
          return `${fieldLabel} must match one of the configured options.`;
        }
      }
    }
  }

  return "";
}

function renderConfigurationPreviewControl(field, keySuffix = "preview") {
  const options = getConfiguredOptions(field);

  if (field.type === "checkbox") {
    return (
      <label className="seller-config-preview-checkbox">
        <input type="checkbox" disabled />
        <span>{field.label || field.key || "Checkbox field"}</span>
      </label>
    );
  }

  if (field.type === "dropdown") {
    return (
      <>
        <select disabled defaultValue="">
          <option value="">{field.label || field.key || "Select option"}</option>
          {options.map((option) => (
            <option key={`${field.id || field.key}-${keySuffix}-${option}`} value={option}>{option}</option>
          ))}
        </select>
        {options.length > 0 && (
          <div className="seller-config-option-chips">
            {options.map((option) => (
              <span key={`${field.id || field.key}-${keySuffix}-chip-${option}`} className="badge pending">{option}</span>
            ))}
          </div>
        )}
      </>
    );
  }

  if (field.type === "formula") {
    return (
      <>
        <input
          placeholder={field.formulaExpression || field.key || "formula_expression"}
          value="Computed automatically"
          readOnly
          disabled
        />
        {(field.definition || field.formulaExpression) && (
          <div className="seller-config-option-chips">
            {field.definition ? <span className="badge pending">{field.definition}</span> : null}
            {field.formulaExpression ? <span className="badge success">{field.formulaExpression}</span> : null}
          </div>
        )}
      </>
    );
  }

  return <input placeholder={field.key || "field_key"} disabled />;
}

function toBool(value) {
  return ["true", "yes", "1"].includes(String(value || "").trim().toLowerCase());
}

function rowHasExcelContent(row) {
  return Object.values(row || {}).some((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function mapProductRow(row) {
  const normalized = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value])
  );

  const primaryName =
    normalized.material_name ||
    normalized.material ||
    normalized.service ||
    normalized.services ||
    normalized.service_name ||
    normalized.services_name ||
    normalized.service_title ||
    normalized.services_title ||
    normalized.item_name ||
    normalized.product_name ||
    normalized.product ||
    normalized.name ||
    "";

  const parsedDiscountLimit = parseMaxDiscountLimit(normalized.max_discount_percent || "");

  return {
    materialName: String(primaryName).trim(),
      category: String(normalized.category || "").trim() || null,
      thickness: String(normalized.thickness || "").trim() || null,
      unitType: String(normalized.unit_type || normalized.unit || normalized.uom || "COUNT").trim() || "COUNT",
      basePrice: Number(normalized.base_price || normalized.rate || normalized.price || 0),
      limitRateEdit: toBool(normalized.limit_rate_edit),
    maxDiscountPercent: String(normalized.max_discount_percent || "").trim(),
    maxDiscountType: parsedDiscountLimit.type,
      sku: String(normalized.sku || "").trim() || null,
      alwaysAvailable: toBool(normalized.always_available),
    materialGroup: String(normalized.material_group || normalized.material_type || "").trim() || null,
    colorName: String(normalized.color_name || normalized.colour_name || normalized.colour || normalized.color || "").trim() || null,
    psSupported: toBool(normalized.ps_supported),
    pricingType: String(normalized.pricing_type || "SFT").trim() || "SFT"
  };
}

function parseProductTextRows(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [materialName, category, thickness, unitType, basePrice, sku, alwaysAvailable] = line.split("|").map((part) => part.trim());
      return {
        materialName,
        category: category || null,
        thickness: thickness || null,
        unitType: unitType || "COUNT",
        basePrice: Number(basePrice || 0),
        sku: sku || null,
        alwaysAvailable: toBool(alwaysAvailable),
        materialGroup: null,
        colorName: null,
        psSupported: false,
        pricingType: "SFT"
      };
    })
    .filter((row) => row.materialName);
}

function validateProductRows(rows) {
  return rows.map((row, index) => {
    const issues = [];
    const parsedDiscountLimit = parseMaxDiscountLimit(row.maxDiscountPercent);
    if (!row.materialName) issues.push("Missing primary item name");
    if (!String(row.category || "").trim()) issues.push("Category is required");
    if (!String(row.sku || "").trim()) issues.push("SKU ID is required");
    if (!["COUNT", "SFT"].includes(String(row.unitType || "").toUpperCase())) {
      issues.push("Unit Type should be COUNT or SFT");
    }
    if (Number.isNaN(Number(row.basePrice))) {
      issues.push("Base Price must be numeric");
    }
    if (row.maxDiscountPercent && !parsedDiscountLimit.isValid) {
      issues.push("Max Discount Limit must be a number or percentage like 10%");
    }

    return {
      ...row,
      unitType: String(row.unitType || "COUNT").toUpperCase(),
      basePrice: Number(row.basePrice || 0),
      pricingType: String(row.pricingType || "SFT").toUpperCase(),
      maxDiscountType: parsedDiscountLimit.type,
      rowNumber: index + 1,
      issues
    };
  });
}

function buildQuotationWizardRevisionState(details, {
  products = [],
  customers = [],
  quotationColumns = [],
  createInitialQuotationWizardState,
  createQuotationWizardItem,
  getCatalogueDrivenQuotationCustomFields
}) {
  const quotation = details?.quotation || {};
  const customerId = quotation.customer_id ? String(quotation.customer_id) : "";
  const selectedCustomer = (customers || []).find((entry) => String(entry.id) === customerId) || null;
  const customColumns = (quotationColumns || []).filter((column) => column.visibleInForm && column.type !== "formula");
  const shippingAddresses = Array.isArray(quotation.customer_shipping_addresses) && quotation.customer_shipping_addresses.length
    ? quotation.customer_shipping_addresses
    : [createEmptyShippingAddress()];

  const baseState = createInitialQuotationWizardState();
  return {
    ...baseState,
    mode: "revise",
    quotationId: quotation.id || null,
    lockedCustomer: true,
    customerMode: "existing",
    customerSearch: selectedCustomer?.firm_name || selectedCustomer?.name || quotation.firm_name || quotation.customer_name || quotation.mobile || "",
    selectedCustomerId: customerId,
    customer: {
      name: quotation.customer_name || selectedCustomer?.name || "",
      firmName: quotation.firm_name || selectedCustomer?.firm_name || "",
      mobile: quotation.mobile || selectedCustomer?.mobile || "",
      email: quotation.email || selectedCustomer?.email || "",
      address: quotation.address || selectedCustomer?.address || "",
      gstNumber: quotation.customer_gst_number || selectedCustomer?.gst_number || "",
      gstEnabled: Boolean(Number(quotation.gst_amount || 0) > 0 || quotation.customer_gst_number || selectedCustomer?.gst_number),
      monthlyBilling: Boolean(quotation.customer_monthly_billing ?? selectedCustomer?.monthly_billing),
      shippingAddresses
    },
    items: (details?.items || []).map((item, index) => {
      const product = (products || []).find((entry) => String(entry.id) === String(item.product_id)) || null;
      const baseItem = createQuotationWizardItem(product);
      return {
        ...baseItem,
        id: item.id ? String(item.id) : `existing-${index + 1}`,
        productId: item.product_id ? String(item.product_id) : "",
        catalogueSource: product?.catalogue_source || item.catalogue_source || baseItem.catalogueSource,
        materialName: item.material_name || item.material_type || item.design_name || item.sku || baseItem.materialName,
        category: normalizeQuotationWizardCategory(item.item_category || item.category || product?.category),
        color: item.color_name || product?.color_name || "",
        otherInfo: item.imported_color_note || "",
        ps: Boolean(item.ps_included),
        thickness: item.thickness || product?.thickness || "",
        height: item.dimension_height ?? "",
        width: item.dimension_width ?? "",
        unit: item.dimension_unit || "ft",
        quantity: String(item.quantity ?? "1"),
        rate: String(item.unit_price ?? ""),
        catalogueBasePrice: Number(product?.base_price || 0),
        limitRateEdit: Boolean(product?.limit_rate_edit),
        maxDiscountPercent: formatMaxDiscountLimit(product?.max_discount_percent, product?.max_discount_type || "percent"),
        maxDiscountType: product?.max_discount_type || "percent",
        note: item.item_note || item.design_name || "",
        customFields: getCatalogueDrivenQuotationCustomFields(
          product,
          customColumns,
          {
            ...(item.custom_fields || item.customFields || {}),
            ...(item.size ? { size: item.size } : {})
          }
        )
      };
    }),
    amounts: {
      discountAmount: String(quotation.discount_amount || ""),
      advanceAmount: String(quotation.advance_amount ?? quotation.advanceAmount ?? ""),
      customQuotationNumber: quotation.custom_quotation_number || "",
      deliveryDate: quotation.delivery_date || "",
      referenceRequestId: quotation.reference_request_id || "",
      deliveryType: quotation.delivery_type || "PICKUP",
      deliveryAddress: quotation.delivery_address || "",
      deliveryPincode: quotation.delivery_pincode || ""
    }
  };
}

function normalizeForCompare(value) {
  if (value === null || value === undefined || value === "") return "";
  return String(value).trim().toLowerCase();
}

function getVersionLabel(version) {
  return `Ver.${version.version_no}`;
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDateTime(value) {
  return formatDateIST(value);
}

function formatAuditActionLabel(actionKey) {
  switch (String(actionKey || "").toLowerCase()) {
    case "seller_created":
      return "Seller created";
    case "seller_lifecycle_updated":
      return "Seller lifecycle updated";
    case "subscription_updated":
      return "Subscription updated";
    case "seller_upgrade_requested":
      return "Upgrade requested";
    case "user_password_reset":
      return "Password reset";
    case "lead_created":
      return "Lead created";
    case "lead_updated":
      return "Lead updated";
    case "note_added":
      return "Note added";
    case "demo_created":
      return "Demo created";
    case "seller_created_from_lead":
      return "Seller created from lead";
    default:
      return String(actionKey || "activity").replace(/_/g, " ");
  }
}

function getPaidPlanSuggestions(plans, currentPlanCode) {
  return (plans || [])
    .filter((plan) => Boolean(plan.is_active) && !plan.is_demo_plan && plan.plan_code !== currentPlanCode)
    .sort((left, right) => Number(left.price || 0) - Number(right.price || 0))
    .slice(0, 3);
}

function getSubscriptionBannerData(seller, plans = []) {
  const subscription = seller?.currentSubscription;
  if (!subscription) return null;

  const planName = subscription.plan_name || subscription.plan_code || seller?.subscription_plan || "Plan";
  const suggestedPlans = getPaidPlanSuggestions(plans, subscription.plan_code || seller?.subscription_plan);
  const trialDays = daysUntil(subscription.trial_end_at || seller?.trial_ends_at);
  const statusLabel = String(subscription.status || "").toLowerCase();
  const isTrial = String(subscription.status || "").toLowerCase() === "trial" || Boolean(subscription.is_demo_plan);
  const isExpired = Boolean(subscription.is_expired);

  if (isExpired) {
    return {
      tone: "error",
      title: `${planName} has expired`,
      message: subscription.quotation_creation_locked_after_expiry
        ? "Quotation creation is locked until the account is upgraded to a paid plan."
        : "Trial period has ended. Please upgrade the plan.",
      suggestedPlans,
      showUpgradeCta: true
    };
  }

  if (isTrial) {
    return {
      tone: "warning",
      title: `${planName} is active`,
      message: trialDays !== null
        ? `${Math.max(trialDays, 0)} day(s) remaining in trial. Trial quotations will carry a watermark.`
        : "Trial access is active. Trial quotations will carry a watermark.",
      suggestedPlans,
      showUpgradeCta: true
    };
  }

  return {
    tone: "info",
    title: `${planName} subscription is active`,
    message: statusLabel === "active"
      ? "Your seller account is currently running on the assigned paid subscription."
      : `Current subscription status: ${subscription.status || "active"}.`,
    suggestedPlans: [],
    showUpgradeCta: false
  };
}

function normalizeQuotationWizardCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "services" || raw === "service") return "Services";
  if (raw === "sheet") return "Sheet";
  if (!raw) return "Product";
  return String(value || "Product").trim();
}

function createQuotationWizardItem(product = null) {
  return {
    id: null,
    productId: product?.id ? String(product.id) : "",
    catalogueSource: product?.catalogue_source || "primary",
    materialName: product?.material_name || "",
    category: normalizeQuotationWizardCategory(product?.category),
    color: product?.color_name || "",
    otherInfo: "",
    ps: false,
    thickness: product?.thickness || "",
    height: "",
    width: "",
    unit: "ft",
    quantity: "1",
    rate: product?.base_price ? String(product.base_price) : "",
    catalogueBasePrice: Number(product?.base_price || 0),
    limitRateEdit: Boolean(product?.limit_rate_edit),
    maxDiscountPercent: formatMaxDiscountLimit(product?.max_discount_percent, product?.max_discount_type || "percent"),
    maxDiscountType: product?.max_discount_type || "percent",
    note: "",
    customFields: {}
  };
}

function createInitialQuotationWizardState(firstProduct = null) {
  return {
    mode: "create",
    quotationId: null,
    lockedCustomer: false,
    step: "customer",
    customerMode: "existing",
    customerSearch: "",
    selectedCustomerId: "",
    customer: {
      name: "",
      firmName: "",
      mobile: "",
      email: "",
      address: "",
      gstNumber: "",
      gstEnabled: false,
      monthlyBilling: false,
      shippingAddresses: [createEmptyShippingAddress()]
    },
    itemForm: createQuotationWizardItem(firstProduct),
    editingItemId: null,
    items: [],
    amounts: {
      discountAmount: "",
      advanceAmount: "",
      customQuotationNumber: "",
      deliveryDate: "",
      referenceRequestId: "",
      deliveryType: "PICKUP",
      deliveryAddress: "",
      deliveryPincode: ""
    },
    submittedQuotation: null
  };
}

function createInitialCustomerForm() {
  return {
    name: "",
    firmName: "",
    mobile: "",
    email: "",
    address: "",
    gstNumber: "",
    monthlyBilling: false,
    shippingAddresses: [createEmptyShippingAddress()]
  };
}

function createInitialSingleProductForm() {
  return {
    materialName: "",
    category: "",
    thickness: "",
    unitType: "COUNT",
    basePrice: "",
    limitRateEdit: false,
    maxDiscountPercent: "",
    sku: "",
    alwaysAvailable: true,
    materialGroup: "",
    colorName: "",
    psSupported: false,
    pricingType: "SFT",
    customFields: {}
  };
}

function parseMaxDiscountLimit(value, fallbackType = "percent") {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { type: fallbackType, value: 0, raw: "", isValid: true };
  }

  const isPercent = raw.includes("%");
  const numeric = Number(raw.replace(/%/g, "").replace(/,/g, "").trim());
  const resolvedType = isPercent ? "percent" : "amount";

  return {
    type: resolvedType,
    value: Number.isFinite(numeric) ? Math.max(0, numeric) : 0,
    raw,
    isValid: Number.isFinite(numeric)
  };
}

function formatMaxDiscountLimit(value, type = "percent") {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  return type === "percent" ? `${numeric}%` : String(numeric);
}

function toQuotationWizardAmount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quotationWizardToFeet(value, unit) {
  const numeric = toQuotationWizardAmount(value);
  if (unit === "in") return numeric / 12;
  if (unit === "mm") return numeric * 0.00328084;
  return numeric;
}

function getQuotationWizardRules(item) {
  const category = normalizeQuotationWizardCategory(item?.category);
  return {
    category,
    isServices: category === "Services"
  };
}

function resolveQuotationWizardRate(item) {
  return toQuotationWizardAmount(item?.rate);
}

function calculateQuotationWizardItemTotal(item) {
  const rules = getQuotationWizardRules(item);
  const rate = resolveQuotationWizardRate(item);
  const quantity = toQuotationWizardAmount(item?.quantity || 0);

  if (rules.isServices) {
    return Number((quantity * rate).toFixed(2));
  }

  const width = toQuotationWizardAmount(item?.width);
  const height = toQuotationWizardAmount(item?.height);
  if (width > 0 && height > 0) {
    const widthFeet = quotationWizardToFeet(width, item?.unit);
    const heightFeet = quotationWizardToFeet(height, item?.unit);
    return Number((widthFeet * heightFeet * quantity * rate).toFixed(2));
  }

  return Number((quantity * rate).toFixed(2));
}

function validateQuotationWizardItem(item) {
  if (!item?.materialName) return false;
  if (resolveQuotationWizardRate(item) <= 0) return false;
  if (toQuotationWizardAmount(item?.quantity) <= 0) return false;
  const rules = getQuotationWizardRules(item);
  if (rules.isServices) return true;
  const width = toQuotationWizardAmount(item?.width);
  const height = toQuotationWizardAmount(item?.height);
  if (width > 0 || height > 0) {
    return width > 0 && height > 0;
  }
  return true;
}

function getQuotationRateValidationMessage(item) {
  if (!item?.limitRateEdit) return "";
  const basePrice = toQuotationWizardAmount(item?.catalogueBasePrice);
  const rate = resolveQuotationWizardRate(item);
  const parsedLimit = parseMaxDiscountLimit(item?.maxDiscountPercent, item?.maxDiscountType || "percent");
  const limitValue = parsedLimit.value;
  const limitType = parsedLimit.type;
  if (basePrice <= 0 || rate <= 0) return "";

  const minimumAllowedRate = Number(
    Math.max(
      limitType === "percent"
        ? basePrice - (basePrice * limitValue / 100)
        : basePrice - limitValue,
      0
    ).toFixed(2)
  );
  if (rate + 0.0001 >= minimumAllowedRate) return "";

  const itemName = item.materialName || "This item";
  return `${itemName} cannot be added below Rs ${minimumAllowedRate.toLocaleString("en-IN")}. Maximum allowed discount is ${limitType === "percent" ? `${limitValue}%` : `Rs ${limitValue.toLocaleString("en-IN")}`}.`;
}

function buildQuotationWizardPayloadItems(items) {
  return (items || []).map((item) => {
    const rules = getQuotationWizardRules(item);
    const rate = resolveQuotationWizardRate(item);
    const width = toQuotationWizardAmount(item.width);
    const height = toQuotationWizardAmount(item.height);
    const hasDimensions = !rules.isServices && width > 0 && height > 0;

    if (!hasDimensions) {
      return {
        product_id: item.productId ? Number(item.productId) : null,
        category: item.category || null,
        size: item.customFields?.size || null,
        quantity: toQuotationWizardAmount(item.quantity || 0),
        unitPrice: rate,
        materialType: item.materialName,
        designName: item.note || item.materialName,
        thickness: item.thickness || null,
        sku: null,
        colorName: item.color || null,
        importedColorNote: item.otherInfo || null,
        psIncluded: Boolean(item.ps),
        itemNote: item.note || null,
        pricingType: "UNIT",
        customFields: item.customFields || {}
      };
    }

    const widthFeet = quotationWizardToFeet(width, item.unit);
    const heightFeet = quotationWizardToFeet(height, item.unit);
    const enteredQuantity = toQuotationWizardAmount(item.quantity || 0);
    const totalArea = Number((widthFeet * heightFeet).toFixed(2));
    const effectiveQuantity = totalArea * enteredQuantity;

    return {
      product_id: item.productId ? Number(item.productId) : null,
      category: item.category || null,
      size: `${item.width || 0} x ${item.height || 0}`,
      quantity: enteredQuantity,
      unitPrice: rate,
      totalPrice: Number((effectiveQuantity * rate).toFixed(2)),
      materialType: item.materialName,
      designName: item.note || item.materialName,
      thickness: item.thickness || null,
      sku: item.ps ? "PS" : null,
      colorName: item.color || null,
      importedColorNote: item.otherInfo || null,
      psIncluded: Boolean(item.ps),
      dimensionHeight: height,
      dimensionWidth: width,
      dimensionUnit: item.unit || "ft",
      itemNote: item.note || null,
      pricingType: "SFT",
      customFields: {
        ...(item.customFields || {}),
        total_area: totalArea
      }
    };
  });
}

function mapProductRowWithConfiguration(row, runtimeFields = [], unsupportedFields = []) {
  const baseRow = mapProductRow(row);
  const normalized = Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [normalizeHeader(key), value])
  );

  const customFields = {};
  unsupportedFields.forEach((field) => {
    const rawValue = normalized[normalizeHeader(field.label)] ?? normalized[normalizeHeader(field.key)];
    if (rawValue === undefined || rawValue === null || rawValue === "") return;
    customFields[field.key] = field.type === "checkbox" ? toBool(rawValue) : rawValue;
  });

  for (const field of runtimeFields) {
    const rawValue = normalized[normalizeHeader(field.label)] ?? normalized[normalizeHeader(field.key)];
    if (rawValue === undefined || rawValue === null || rawValue === "") continue;

    switch (field.normalizedKey) {
      case "material_name":
        baseRow.materialName = String(rawValue).trim();
        break;
      case "material_group":
        baseRow.materialGroup = String(rawValue).trim();
        break;
      case "category":
        baseRow.category = String(rawValue).trim();
        break;
      case "color_name":
        baseRow.colorName = String(rawValue).trim();
        break;
      case "thickness":
        baseRow.thickness = String(rawValue).trim();
        break;
      case "unit_type":
        baseRow.unitType = String(rawValue).trim();
        break;
      case "pricing_type":
        baseRow.pricingType = String(rawValue).trim();
        break;
      case "base_price":
        baseRow.basePrice = Number(rawValue || 0);
        break;
      case "limit_rate_edit":
        baseRow.limitRateEdit = toBool(rawValue);
        break;
      case "max_discount_percent":
        baseRow.maxDiscountPercent = String(rawValue || "").trim();
        break;
      case "sku":
        baseRow.sku = String(rawValue).trim();
        break;
      case "always_available":
        baseRow.alwaysAvailable = toBool(rawValue);
        break;
      case "ps_supported":
        baseRow.psSupported = toBool(rawValue);
        break;
      default:
        break;
    }
  }

  return {
    ...baseRow,
    customFields
  };
}

function validateProductRowsWithConfiguration(rows, unsupportedFields = [], runtimeFields = []) {
  const primaryNameField = runtimeFields.find((field) => (field.normalizedKey || normalizeConfigKey(field.key)) === "material_name");
  const primaryLabel = primaryNameField?.label || "Primary item name";
  const categoryLabel = runtimeFields.find((field) => (field.normalizedKey || normalizeConfigKey(field.key)) === "category")?.label || "Category";
  const skuLabel = runtimeFields.find((field) => (field.normalizedKey || normalizeConfigKey(field.key)) === "sku")?.label || "SKU ID";
  return validateProductRows(rows).map((row) => {
    const issues = [...(row.issues || [])].map((issue) => {
      if (issue === "Missing primary item name") return `${primaryLabel} is required`;
      if (issue === "Category is required") return `${categoryLabel} is required`;
      if (issue === "SKU ID is required") return `${skuLabel} is required`;
      return issue;
    });
    unsupportedFields.forEach((field) => {
      const value = row.customFields?.[field.key];
      if (field.required && (value === undefined || value === null || String(value).trim() === "")) {
        issues.push(`${field.label} is required`);
      }
      if (field.type === "number" && value !== undefined && value !== null && value !== "" && Number.isNaN(Number(value))) {
        issues.push(`${field.label} must be numeric`);
      }
      if (field.type === "dropdown" && value !== undefined && value !== null && value !== "") {
        const allowedOptions = Array.isArray(field.options)
          ? field.options.map((option) => String(option || "").trim()).filter(Boolean)
          : [];
        if (allowedOptions.length && !allowedOptions.includes(String(value).trim())) {
          issues.push(`${field.label} must match one of the configured options`);
        }
      }
    });

    return {
      ...row,
      issues
    };
  });
}

function createDefaultSellerConfiguration(seller) {
  return {
    sellerId: seller?.id || null,
    profileId: null,
    profileName: `${seller?.name || "Seller"} Default Configuration`,
    status: "draft",
    publishedAt: null,
    updatedAt: null,
    versions: [],
    itemDisplayConfig: {
      defaultPattern: "",
      categoryRules: []
    },
      modules: {
        products: true,
        quotations: true,
        customers: true,
        payments: true,
        reports: true,
        quotationProductSelector: true,
        combineHelpingTextInItemColumn: false
      },
    catalogueFields: [
      { id: "cat-material-name", displayOrder: 1, key: "material_name", label: "Material Name", type: "text", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-category", displayOrder: 2, key: "category", label: "Category", type: "dropdown", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-sku", displayOrder: 3, key: "sku", label: "SKU ID", type: "text", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-thickness", displayOrder: 4, key: "thickness", label: "Thickness", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true },
      { id: "cat-colour", displayOrder: 5, key: "colour", label: "Colour", type: "text", options: [], required: false, visibleInList: true, uploadEnabled: true },
      { id: "cat-base-price", displayOrder: 6, key: "base_price", label: "Base Price", type: "number", options: [], required: true, visibleInList: true, uploadEnabled: true },
      { id: "cat-limit-rate-edit", displayOrder: 7, key: "limit_rate_edit", label: "Limit Rate Edit", type: "checkbox", options: [], required: false, visibleInList: false, uploadEnabled: false },
      { id: "cat-max-discount", displayOrder: 8, key: "max_discount_percent", label: "Max Discount Limit", type: "text", options: [], required: false, visibleInList: false, uploadEnabled: false }
    ],
    quotationColumns: [
        { id: "col-material", displayOrder: 1, key: "material_name", label: "Material", type: "text", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false },
        { id: "col-thickness", displayOrder: 2, key: "thickness", label: "Thickness", type: "text", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: false },
        { id: "col-width", displayOrder: 3, key: "width", label: "Width", type: "number", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-height", displayOrder: 4, key: "height", label: "Height", type: "number", options: [], definition: "", formulaExpression: "", required: false, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-quantity", displayOrder: 5, key: "quantity", label: "Quantity", type: "number", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-rate", displayOrder: 6, key: "rate", label: "Rate", type: "number", options: [], definition: "", formulaExpression: "", required: true, visibleInForm: true, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true },
        { id: "col-amount", displayOrder: 7, key: "amount", label: "Amount", type: "formula", options: [], definition: "Calculated line amount", formulaExpression: "width * height * quantity * rate", required: false, visibleInForm: false, visibleInPdf: true, helpTextInPdf: false, includedInCalculation: true }
      ]
    };
}

function getQuotationTemplatePresetDefaults(presetKey) {
  return QUOTATION_TEMPLATE_PRESETS[presetKey]?.defaults || QUOTATION_TEMPLATE_PRESETS.default.defaults;
}

function mapSellerConfigurationResponse(config, seller) {
  if (!config) {
    return createDefaultSellerConfiguration(seller);
  }

  const fallback = createDefaultSellerConfiguration(seller);
  const rawItemDisplayConfig = config.itemDisplayConfig || config.modules?.itemDisplayConfig || {};
  const rawCategoryRules = Array.isArray(rawItemDisplayConfig.categoryRules) ? rawItemDisplayConfig.categoryRules : [];

  return {
    ...fallback,
    sellerId: config.sellerId || seller?.id || null,
    profileId: config.profileId || null,
    profileName: config.profileName || fallback.profileName,
    status: config.status || fallback.status,
    publishedAt: config.publishedAt || null,
    updatedAt: config.updatedAt || null,
    versions: Array.isArray(config.versions) ? config.versions : [],
    itemDisplayConfig: {
      defaultPattern: String(rawItemDisplayConfig.defaultPattern || "").trim(),
      categoryRules: rawCategoryRules
        .map((rule) => ({
          category: String(rule.category || "").trim(),
          pattern: String(rule.pattern || "").trim()
        }))
        .filter((rule) => rule.category && rule.pattern)
    },
    modules: {
      ...fallback.modules,
      ...(config.modules || {})
    },
    catalogueFields: (Array.isArray(config.catalogueFields) && config.catalogueFields.length ? config.catalogueFields : fallback.catalogueFields)
      .map((field) => ({ ...field, options: Array.isArray(field.options) ? field.options : [] })),
    quotationColumns: (Array.isArray(config.quotationColumns) && config.quotationColumns.length ? config.quotationColumns : fallback.quotationColumns)
      .map((column) => ({
        ...column,
          options: Array.isArray(column.options) ? column.options : [],
          definition: column.definition || "",
          formulaExpression: column.formulaExpression || ""
          ,
          helpTextInPdf: Boolean(column.helpTextInPdf)
        }))
  };
}

function canConvertToPaid(planCode, status, plans) {
  if (String(status || "").toLowerCase() !== "trial") return false;
  const selectedPlan = (plans || []).find((plan) => plan.plan_code === planCode);
  return Boolean(selectedPlan && !selectedPlan.is_demo_plan);
}

function PublicLeadCapturePage({
  form,
  submitting,
  successMessage,
  errorMessage,
  onChange,
  onSubmit,
  businessCategoryOptions,
  getBusinessSegments
}) {
  return (
    <PublicAcquisitionSignupPage
      mode="lead"
      form={form}
      submitting={submitting}
      successMessage={successMessage}
      errorMessage={errorMessage}
      onChange={onChange}
      onSubmit={onSubmit}
      businessCategoryOptions={businessCategoryOptions}
      getBusinessSegments={getBusinessSegments}
    />
  );
  const segmentOptions = getBusinessSegments(form.businessType);
  return (
    <div className="auth-wrap lead-capture-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="auth-grid lead-capture-grid">
        <div className="glass-card hero-card">
          <p className="eyebrow">Quotsy Lead Capture</p>
          <h1>Start with a quick lead form.</h1>
          <p>Share your business details and requirement. Our team will track your lead, schedule a demo if needed, and move you toward onboarding.</p>
          <div className="lead-capture-points">
            <div>
              <strong>No login needed</strong>
              <span>This page is open for direct lead capture.</span>
            </div>
            <div>
              <strong>Demo-friendly</strong>
              <span>Mark demo interest and weâ€™ll route it into the platform lead workflow.</span>
            </div>
            <div>
              <strong>Sales-ready</strong>
              <span>Your form lands directly inside the platform Leads module.</span>
            </div>
          </div>
        </div>

        <form className="glass-card auth-card lead-capture-form" onSubmit={onSubmit}>
          <h2>Lead Form</h2>
          {successMessage && <div className="notice">{successMessage}</div>}
          {errorMessage && <div className="notice error">{errorMessage}</div>}
          <input placeholder="Name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
          <input placeholder="Mobile Number" value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} required />
          <input placeholder="Email" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
          <input placeholder="Business Name" value={form.businessName} onChange={(e) => onChange("businessName", e.target.value)} />
          <input placeholder="City" value={form.city} onChange={(e) => onChange("city", e.target.value)} />
          <select value={form.businessType} onChange={(e) => onChange("businessType", e.target.value)}>
            <option value="">Select Business Category</option>
            {businessCategoryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <select value={form.businessSegment} onChange={(e) => onChange("businessSegment", e.target.value)} disabled={!form.businessType}>
            <option value="">{form.businessType ? "Select Segment" : "Select category first"}</option>
            {segmentOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {form.interestedInDemo ? (
            <label className="seller-toggle">
              <input type="checkbox" checked={Boolean(form.wantsSampleData)} onChange={(e) => onChange("wantsSampleData", e.target.checked)} style={{ width: "auto" }} />
              Seed sample data for this business category
            </label>
          ) : null}
          <textarea rows={4} placeholder="Requirement" value={form.requirement} onChange={(e) => onChange("requirement", e.target.value)} />
          <label className="seller-toggle">
            <input type="checkbox" checked={form.interestedInDemo} onChange={(e) => onChange("interestedInDemo", e.target.checked)} style={{ width: "auto" }} />
            Interested in Demo
          </label>
          <button type="submit" disabled={submitting}>{submitting ? "Submitting..." : "Submit Lead"}</button>
          <a className="glass-btn lead-login-link" href="/login">Go to login</a>
        </form>
      </div>
    </div>
  );
}

const PUBLIC_VISITOR_FAQS = [
  {
    question: "What is Quotsy?",
    answer: "Quotsy is a quotation-first business workspace that helps teams manage customers, products, quotations, branding, PDFs, and follow-up workflows from one system."
  },
  {
    question: "Who is Quotsy built for?",
    answer: "Quotsy is designed for MSMEs, distributors, manufacturers, fabricators, contractors, and service providers who need faster quotation and customer operations."
  },
  {
    question: "Can I try Quotsy before buying a plan?",
    answer: "Yes. You can register for a demo account and explore the workflow in a ready-to-use workspace before moving to a paid plan."
  },
  {
    question: "How long is the demo access?",
    answer: "The demo signup flow creates a seller workspace with a 14-day trial so your team can evaluate the product in real working conditions."
  },
  {
    question: "Do I need technical knowledge to use Quotsy?",
    answer: "No. Quotsy is designed for operational teams, sales teams, and business owners, not just technical users."
  },
  {
    question: "Can I create quotations in PDF format?",
    answer: "Yes. Quotations can be previewed and downloaded as branded PDFs using seller-specific templates."
  },
  {
    question: "Can I use my company logo or header image in quotation PDFs?",
    answer: "Yes. You can upload either a full quotation header image or a company logo and configure the PDF branding from Business Settings."
  },
  {
    question: "Can my team use the same seller account together?",
    answer: "Yes. Seller accounts support multiple users with different roles such as admin, master user, and sub-user."
  },
  {
    question: "What can a sub-user do?",
    answer: "A sub-user gets a focused workspace to create quotations, search quotations, create customers during quotation entry, and download PDFs."
  },
  {
    question: "Can I manage my product catalogue in Quotsy?",
    answer: "Yes. You can maintain a structured product catalogue and also create secondary catalogue items directly during quotation creation."
  },
  {
    question: "What is secondary catalogue?",
    answer: "Secondary catalogue stores new seller-specific items created during quotation entry, so your team can reuse them later without polluting the main structured catalogue."
  },
  {
    question: "Can I add a customer while creating a quotation?",
    answer: "Yes. The quotation wizard lets you create a new customer without leaving the quotation flow."
  },
  {
    question: "Can a customer have multiple shipping addresses?",
    answer: "Yes. Customers can have multiple shipping addresses, and each shipping location can also store warehouse GST details."
  },
  {
    question: "Does Quotsy support GST details?",
    answer: "Yes. Seller GST, customer GST, and warehouse GST can be captured and used where relevant in quotations and PDFs."
  },
  {
    question: "Can I control who edits price while preparing quotations?",
    answer: "Yes. Products can be configured with rate-edit protection using a Max Discount Limit. You can define it as a percentage like 10% or as a fixed amount like 100, and the system blocks rates that go below the allowed minimum."
  },
  {
    question: "Can Quotsy support different business types?",
    answer: "Yes. During onboarding, users can choose business category and segment so the system can seed relevant fields, quotation settings, and optional sample data."
  },
  {
    question: "What business categories are supported in demo onboarding?",
    answer: "Demo onboarding currently supports Traders and Distributors, Manufacturers and Fabricators, Contractors and Project-Based Businesses, and Service Providers."
  },
  {
    question: "Will I get sample data in the demo account?",
    answer: "Yes, if you choose sample data during demo signup. Quotsy can seed category-specific products, customers, and configuration to help you explore faster."
  },
  {
    question: "Can I use my own data instead of sample data?",
    answer: "Yes. You can choose to start with your own data and still get the category-based system structure without inserting sample products or customers."
  },
  {
    question: "Can I upload products in bulk?",
    answer: "Yes. Sellers can use the product import flow and upload catalogue data using the system template."
  },
  {
    question: "Can I search quotations by customer name or mobile number?",
    answer: "Yes. Quotation search supports customer name, firm name, quotation number, and mobile number to make retrieval faster for daily operations."
  },
  {
    question: "Does Quotsy support OTP login?",
    answer: "Yes. In addition to password login, Quotsy also supports OTP-based login for supported users."
  },
  {
    question: "Can platform admins manage multiple sellers?",
    answer: "Yes. Quotsy includes a platform control plane for leads, sellers, subscriptions, plans, onboarding, and notifications across tenants."
  },
  {
    question: "Is Quotsy only for quotations?",
    answer: "Quotsy is quotation-first, but it also supports customer management, product master setup, branding, subscription workflows, configuration control, and operational coordination."
  },
  {
    question: "How quickly can I get started?",
    answer: "Most teams can get started by setting up branding, catalogue, and customers first, then creating their first quotation the same day."
  }
];

const PUBLIC_QUOTSY_FEATURE_SECTIONS = [
  {
    title: "Quotation Control",
    points: [
      "Guided quotation creation with customer, item, charge, and preview flow",
      "Quotation version maintenance with latest and historical version visibility",
      "Approval mechanism based on amount limits and pricing exceptions",
      "Final download and sending blocked until approval is complete"
    ]
  },
  {
    title: "Commercial Governance",
    points: [
      "Requester, approver, and both-type user structure",
      "Approval request recreation on quotation revision",
      "Superseded request handling with latest-version warning",
      "Role-based access control for seller teams and platform governance"
    ]
  },
  {
    title: "Design and Flexibility",
    points: [
      "Configurable quotation fields and PDF columns",
      "Industry-friendly quotation structure and helping text support",
      "Seller-specific branding with logo, header image, and accent color",
      "Custom quotation layouts through Configuration Studio"
    ]
  },
  {
    title: "Operational Workflow",
    points: [
      "Search quotations by customer, mobile, or quotation number",
      "Approval counters, badges, and notifications across dashboard and tracker",
      "Product, customer, and secondary catalogue integration",
      "Direct quotation email sending from the application"
    ]
  }
];

const PUBLIC_QUOTSY_COMPARISON_ROWS = [
  {
    feature: "Quotation-first workflow",
    quotsy: "Built specifically around quotation creation, revision, approval, sending, and tracking.",
    zoho: "Quotes are part of a broader finance workflow and convert into sales orders or invoices.",
    odoo: "Quotations live inside the larger Sales and ERP flow with strong process linkage.",
    vyapar: "Estimate and quotation creation is available with sharing and conversion to invoice.",
    gogst: "Quotation and proforma support exists inside GST billing and invoicing workflow."
  },
  {
    feature: "Version maintenance",
    quotsy: "Native quotation revision history with latest vs historical version clarity.",
    zoho: "Quote status and conversion flow are supported, but version-led quotation governance is not the primary message.",
    odoo: "Strong quotation lifecycle, but quotation-version governance is typically handled within broader sales operations.",
    vyapar: "Focus is on fast quote creation and conversion, not deep version control.",
    gogst: "Focus is on fast GST quotation generation and document templates."
  },
  {
    feature: "Approval mechanism",
    quotsy: "Built-in requester/approver workflow with limits, supersede logic, and decision tracking.",
    zoho: "Broader workflow tools exist, but quotation-specific approval depth is not the headline value in quote flow.",
    odoo: "Can be configured across ERP workflows, but not positioned as a quotation-first approval product.",
    vyapar: "Permission and activity monitoring are available, but quotation approval is lighter.",
    gogst: "Staff access exists, but quotation-first approval control is not the main proposition."
  },
  {
    feature: "Configurable quotation structure",
    quotsy: "Configurable quotation fields, columns, formula fields, helping text, and layout logic.",
    zoho: "Templates and quote workflow support are available.",
    odoo: "Quotation templates and configurable sales documents are available through the sales suite.",
    vyapar: "Templates, branding, and GST-ready quotation formats are available.",
    gogst: "Quotation templates and GST-oriented document formats are available."
  },
  {
    feature: "MSME fit for quotation teams",
    quotsy: "Designed for MSMEs needing a practical middle ground between manual quoting and heavy ERP.",
    zoho: "Strong business suite option for broader finance operations.",
    odoo: "Strong ERP option for businesses comfortable with larger process scope.",
    vyapar: "Very accessible for fast billing and estimate use cases.",
    gogst: "Strong GST billing orientation with quotation support for Indian SMEs."
  }
];

function PublicPageHeader({ activePath }) {
  const links = [
    { href: "/quotsy-features", label: "Features" },
    { href: "/quotsy-features#comparison", label: "Comparison" },
    { href: "/user-guide", label: "User Guide" },
    { href: "/try-demo", label: "Start Demo" },
    { href: "/login", label: "Login" }
  ];

  return (
    <header className="labs-topbar public-page-topbar">
      <div className="labs-topbar-inner public-page-topbar-inner">
        <a className="public-page-brand" href="/" aria-label="Go to Quotsy home">
          <div className="brand-block public-page-brand-lockup">
            <div className="brand-dot" />
            <div>
              <h2>Quotsy</h2>
              <p>Quotation workflows for growing MSMEs</p>
            </div>
          </div>
        </a>
        <nav className="labs-nav public-page-nav" aria-label="Public page navigation">
          {links.map((link) => (
          <a
            key={link.href}
            className={`public-page-nav-link${activePath === link.href ? " is-active" : ""}`}
            href={link.href}
          >
            {link.label}
          </a>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PublicVisitorFaqPage() {
  const [openQuestion, setOpenQuestion] = useState(PUBLIC_VISITOR_FAQS[0]?.question || "");

  return (
    <div className="auth-wrap lead-capture-shell public-page-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="public-page-stage">
        <PublicPageHeader activePath="/user-guide" />
      <div className="auth-grid auth-grid-public-help-single">
        <section className="glass-card auth-card auth-visitor-faq-card auth-visitor-faq-page-card auth-visitor-faq-page-wide">
          <div className="auth-visitor-faq-head">
            <p className="eyebrow">User Guide</p>
            <h3>Before You Sign Up</h3>
            <p>Everything a first-time visitor usually wants to understand before starting a demo, creating an account, or sharing Quotsy internally with a team.</p>
          </div>
          <div className="lead-capture-points auth-visitor-info-grid">
            <div>
              <strong>What You Will Learn</strong>
              <span>What Quotsy does, who it is built for, how demo setup works, and how quotations, GST, catalogue, and team access fit together.</span>
            </div>
            <div>
              <strong>Who This Helps</strong>
              <span>Business owners, operations managers, sales teams, fabricators, distributors, contractors, and service providers evaluating the platform.</span>
            </div>
          </div>
          <div className="auth-visitor-faq-list">
            {PUBLIC_VISITOR_FAQS.map((faq) => {
              const isOpen = openQuestion === faq.question;
              return (
                <article key={faq.question} className={`auth-visitor-faq-item${isOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="auth-visitor-faq-toggle"
                    onClick={() => setOpenQuestion((current) => (current === faq.question ? "" : faq.question))}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="auth-visitor-faq-plus" aria-hidden="true">{isOpen ? "-" : "+"}</span>
                  </button>
                  {isOpen && <p className="auth-visitor-faq-answer">{faq.answer}</p>}
                </article>
              );
            })}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

function PublicQuotsyFeaturesPage() {
  return (
    <div className="auth-wrap lead-capture-shell public-page-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="public-page-stage">
        <PublicPageHeader activePath="/quotsy-features" />
      <div className="auth-grid auth-grid-public-features-single">
        <section className="glass-card auth-card auth-visitor-faq-card auth-visitor-faq-page-card public-features-page-card public-features-page-wide">
          <div className="auth-visitor-faq-head">
            <p className="eyebrow">Why Quotsy</p>
            <h3>Quotation software built for MSMEs that need speed and control</h3>
            <p>This page focuses on what Quotsy does best for quotation-heavy MSME workflows and how it compares with broader billing or ERP options specifically from a quotation perspective.</p>
          </div>

          <div className="auth-value-stack public-feature-hero-stack">
            <div className="auth-value-card auth-value-card-blue">
              <span className="auth-value-icon" aria-hidden="true" />
              <div>
                <strong>Quotation-first workflow</strong>
                <span>Create, revise, approve, send, and track quotations from one focused operational flow.</span>
              </div>
            </div>
            <div className="auth-value-card auth-value-card-indigo">
              <span className="auth-value-icon" aria-hidden="true" />
              <div>
                <strong>Built for MSMEs</strong>
                <span>Designed for distributors, manufacturers, contractors, and service businesses that need structure without ERP heaviness.</span>
              </div>
            </div>
            <div className="auth-value-card auth-value-card-mustard">
              <span className="auth-value-icon" aria-hidden="true" />
              <div>
                <strong>Professional output</strong>
                <span>Generate branded quotations with configurable layout, approval control, and direct email delivery from the application.</span>
              </div>
            </div>
          </div>

          <div className="public-feature-grid">
            {PUBLIC_QUOTSY_FEATURE_SECTIONS.map((section) => (
              <article key={section.title} className="public-feature-card">
                <h4>{section.title}</h4>
                <ul>
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </article>
            ))}
          </div>

          <div id="comparison" className="public-comparison-block">
            <div className="auth-visitor-faq-head">
              <p className="eyebrow">Quotation Comparison</p>
              <h3>How Quotsy compares on quotation workflow focus</h3>
              <p>Comparison is limited to quotation workflow depth and based on publicly described product capabilities. It does not try to compare the full ERP or accounting scope of each platform.</p>
            </div>
            <div className="public-comparison-table-wrap">
              <table className="public-comparison-table">
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Quotsy</th>
                    <th>Zoho</th>
                    <th>Odoo</th>
                    <th>Vyapar</th>
                    <th>GoGST</th>
                  </tr>
                </thead>
                <tbody>
                  {PUBLIC_QUOTSY_COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature}>
                      <td><strong>{row.feature}</strong></td>
                      <td className="comparison-fit-strong">{row.quotsy}</td>
                      <td className="comparison-fit-medium">{row.zoho}</td>
                      <td className="comparison-fit-medium">{row.odoo}</td>
                      <td className="comparison-fit-strong-soft">{row.vyapar}</td>
                      <td className="comparison-fit-strong-soft">{row.gogst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="public-feature-footer-note">
            <strong>Where Quotsy stands out</strong>
            <p>Quotsy is especially strong when a business wants quotation workflow depth such as version maintenance, approval routing, configurable quotation design, seller-team access control, and operational clarity without jumping into a much larger ERP implementation.</p>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}

function PublicAcquisitionSignupPage({
  mode,
  form,
  submitting,
  successMessage,
  errorMessage,
  onChange,
  onSubmit,
  businessCategoryOptions,
  getBusinessSegments
}) {
  const isDemoMode = mode === "demo";
  const [showPassword, setShowPassword] = useState(false);
  const categoryKey = isDemoMode ? "businessCategory" : "businessType";
  const categoryValue = form[categoryKey] || "";
  const segmentOptions = getBusinessSegments(categoryValue);
  const shouldShowSampleDataChoices = isDemoMode || Boolean(form.interestedInDemo);

  return (
    <div className="auth-wrap lead-capture-shell public-page-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="public-page-stage">
        <PublicPageHeader activePath={isDemoMode ? "/try-demo" : "/lead"} />
        <div className="auth-grid lead-capture-grid">
          <div className="glass-card hero-card auth-showcase-card">
            <p className="eyebrow">{isDemoMode ? "Quotsy Demo" : "Quotsy Lead Capture"}</p>
            <h1>{isDemoMode ? "Register for Demo" : "Share Your Requirement"}</h1>
            <p>
              {isDemoMode
                ? "Create your seller workspace in minutes and start a 14-day trial with category-aware setup."
                : "Use this same guided form to share your requirement, and convert to demo whenever you are ready."}
            </p>
            <div className="auth-value-stack">
              <div className="auth-value-card auth-value-card-blue">
                <span className="auth-value-icon" aria-hidden="true" />
                <div>
                  <strong>One Unified Form</strong>
                  <span>Lead and demo onboarding now follow one consistent form experience.</span>
                </div>
              </div>
              <div className="auth-value-card auth-value-card-indigo">
                <span className="auth-value-icon" aria-hidden="true" />
                <div>
                  <strong>Category-Aware Setup</strong>
                  <span>Business category and segment selections drive setup and sample data options.</span>
                </div>
              </div>
              <div className="auth-value-card auth-value-card-mustard">
                <span className="auth-value-icon" aria-hidden="true" />
                <div>
                  <strong>Fast Start</strong>
                  <span>Complete the form once and move to login or demo flow without re-entering data.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="auth-public-side">
            <div className="glass-card auth-card auth-panel-card auth-demo-panel">
              <div className="auth-panel-tabs" role="tablist" aria-label="Public onboarding navigation">
                <a className="auth-panel-tab auth-panel-tab-link" href="/login">Login</a>
                <a className={`auth-panel-tab ${!isDemoMode ? "active" : "auth-panel-tab-link"}`} href="/lead">Lead Form</a>
                <a className={`auth-panel-tab ${isDemoMode ? "active" : "auth-panel-tab-link"}`} href="/try-demo">Demo Signup</a>
              </div>
              <div className="auth-panel-divider" />
              <div className="auth-panel-copy">
                <h2>{isDemoMode ? "Register for Demo" : "Submit Lead"}</h2>
                <p>{isDemoMode ? "Create your demo workspace instantly." : "Share your details and we will continue your onboarding."}</p>
              </div>
              {successMessage && <div className="notice">{successMessage}</div>}
              {errorMessage && <div className="notice error">{errorMessage}</div>}
              <form className="auth-form-shell auth-demo-form" onSubmit={onSubmit}>
                <label className="auth-field auth-field-caps">
                  <span>Your Name</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <input placeholder="Enter your name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
                  </div>
                </label>
                <label className="auth-field auth-field-caps">
                  <span>Mobile Number</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <input placeholder="Enter mobile number" value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} required />
                  </div>
                </label>
                {isDemoMode ? (
                  <label className="auth-field auth-field-caps">
                    <span>Password</span>
                    <div className="auth-input-shell">
                      <span className="auth-input-icon"><LockFieldIcon /></span>
                      <input
                        placeholder="Create password"
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(e) => onChange("password", e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="auth-input-toggle"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        <EyeFieldIcon open={showPassword} />
                      </button>
                    </div>
                  </label>
                ) : null}
                <label className="auth-field auth-field-caps">
                  <span>Email</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <input placeholder="Enter email address" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
                  </div>
                </label>
                <label className="auth-field auth-field-caps">
                  <span>Business Name</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <input placeholder="Enter business name" value={form.businessName} onChange={(e) => onChange("businessName", e.target.value)} />
                  </div>
                </label>
                <label className="auth-field auth-field-caps">
                  <span>Business Category</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <select value={categoryValue} onChange={(e) => onChange(categoryKey, e.target.value)}>
                      <option value="">Select business category</option>
                      {businessCategoryOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </label>
                <label className="auth-field auth-field-caps">
                  <span>Business Segment</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <select value={form.businessSegment} onChange={(e) => onChange("businessSegment", e.target.value)} disabled={!categoryValue}>
                      <option value="">{categoryValue ? "Select segment" : "Select category first"}</option>
                      {segmentOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </label>
                {!isDemoMode ? (
                  <label className="seller-toggle">
                    <input type="checkbox" checked={Boolean(form.interestedInDemo)} onChange={(e) => onChange("interestedInDemo", e.target.checked)} style={{ width: "auto" }} />
                    Interested in Demo
                  </label>
                ) : null}
                {shouldShowSampleDataChoices ? (
                  <label className="auth-field auth-field-caps">
                    <span>Demo Data Preference</span>
                    <div className="auth-choice-group">
                      <label className="auth-choice-pill">
                        <input type="radio" name={`sampleData-${mode}`} checked={Boolean(form.wantsSampleData)} onChange={() => onChange("wantsSampleData", true)} />
                        <span>Use sample data</span>
                      </label>
                      <label className="auth-choice-pill">
                        <input type="radio" name={`sampleData-${mode}`} checked={!form.wantsSampleData} onChange={() => onChange("wantsSampleData", false)} />
                        <span>I will use my own data</span>
                      </label>
                    </div>
                  </label>
                ) : null}
                {!isDemoMode ? (
                  <label className="auth-field auth-field-caps">
                    <span>Requirement</span>
                    <div className="auth-input-shell">
                      <span className="auth-input-icon"><PhoneFieldIcon /></span>
                      <textarea rows={3} placeholder="Share your requirement" value={form.requirement} onChange={(e) => onChange("requirement", e.target.value)} />
                    </div>
                  </label>
                ) : null}
                <button type="submit" className="auth-submit-btn" disabled={submitting}>
                  {submitting
                    ? (isDemoMode ? "Creating demo..." : "Submitting lead...")
                    : (isDemoMode ? "Create Demo Account ->" : "Submit Lead ->")}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PublicDemoSignupPage({
  form,
  submitting,
  successMessage,
  errorMessage,
  onChange,
  onSubmit,
  businessCategoryOptions,
  getBusinessSegments
}) {
  return (
    <PublicAcquisitionSignupPage
      mode="demo"
      form={form}
      submitting={submitting}
      successMessage={successMessage}
      errorMessage={errorMessage}
      onChange={onChange}
      onSubmit={onSubmit}
      businessCategoryOptions={businessCategoryOptions}
      getBusinessSegments={getBusinessSegments}
    />
  );
  const [showPassword, setShowPassword] = useState(false);
  const segmentOptions = getBusinessSegments(form.businessCategory);
  const demoValueCards = [
    {
      title: "Instant Demo Workspace",
      text: "Create your demo seller account in one step and start exploring the full workflow immediately.",
      tone: "blue"
    },
    {
      title: "14-Day Trial Access",
      text: "Get a ready-to-use Quotsy workspace with the demo plan applied automatically for two weeks.",
      tone: "indigo"
    },
    {
      title: "Upgrade When Ready",
      text: "Move from demo to a paid seller journey once your team is comfortable with the platform.",
      tone: "mustard"
    }
  ];

  return (
    <div className="auth-wrap lead-capture-shell public-page-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="public-page-stage">
        <PublicPageHeader activePath="/try-demo" />
      <div className="auth-grid lead-capture-grid">
        <div className="glass-card hero-card auth-showcase-card">
          <p className="eyebrow">Quotsy Demo</p>
          <h1>Quotsy Demo</h1>
          <p>Start a 14-day trial with full access, watermark-enabled quotations, and a ready-to-use seller workspace without waiting for manual onboarding.</p>
          <div className="auth-value-stack">
            {demoValueCards.map((card) => (
              <div key={card.title} className={`auth-value-card auth-value-card-${card.tone}`}>
                <span className="auth-value-icon" aria-hidden="true" />
                <div>
                  <strong>{card.title}</strong>
                  <span>{card.text}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card auth-visitor-mini-card">
            <strong>{PUBLIC_VISITOR_FAQS[0].question}</strong>
            <p>{PUBLIC_VISITOR_FAQS[0].answer}</p>
          </div>
        </div>

        <div className="auth-public-side">
          <div className="glass-card auth-card auth-panel-card auth-demo-panel">
            <div className="auth-panel-tabs" role="tablist" aria-label="Demo and login navigation">
              <a className="auth-panel-tab auth-panel-tab-link" href="/login">Login</a>
              <span className="auth-panel-tab active">Register for Demo</span>
            </div>
            <div className="auth-panel-divider" />
            <div className="auth-panel-copy">
              <h2>Register for Demo</h2>
              <p>Create your demo seller workspace and start a 14-day trial instantly.</p>
            </div>
            {successMessage && <div className="notice">{successMessage}</div>}
            {errorMessage && <div className="notice error">{errorMessage}</div>}
            <form className="auth-form-shell auth-demo-form" onSubmit={onSubmit}>
              <label className="auth-field auth-field-caps">
                <span>Your Name</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><PhoneFieldIcon /></span>
                  <input placeholder="Enter your name" value={form.name} onChange={(e) => onChange("name", e.target.value)} required />
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Mobile Number</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><PhoneFieldIcon /></span>
                  <input placeholder="Enter mobile number" value={form.mobile} onChange={(e) => onChange("mobile", e.target.value)} required />
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Password</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><LockFieldIcon /></span>
                  <input
                    placeholder="Create password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => onChange("password", e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    <EyeFieldIcon open={showPassword} />
                  </button>
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Email</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><PhoneFieldIcon /></span>
                  <input placeholder="Enter email address" type="email" value={form.email} onChange={(e) => onChange("email", e.target.value)} />
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Business Name</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><PhoneFieldIcon /></span>
                  <input placeholder="Enter business name" value={form.businessName} onChange={(e) => onChange("businessName", e.target.value)} />
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Business Category</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><PhoneFieldIcon /></span>
                  <select value={form.businessCategory} onChange={(e) => onChange("businessCategory", e.target.value)}>
                    <option value="">Select business category</option>
                    {businessCategoryOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Business Segment</span>
                <div className="auth-input-shell">
                  <span className="auth-input-icon"><PhoneFieldIcon /></span>
                  <select value={form.businessSegment} onChange={(e) => onChange("businessSegment", e.target.value)} disabled={!form.businessCategory}>
                    <option value="">{form.businessCategory ? "Select segment" : "Select category first"}</option>
                    {segmentOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </label>
              <label className="auth-field auth-field-caps">
                <span>Demo Data Preference</span>
                <div className="auth-choice-group">
                  <label className="auth-choice-pill">
                    <input type="radio" name="sampleData" checked={Boolean(form.wantsSampleData)} onChange={() => onChange("wantsSampleData", true)} />
                    <span>Use sample data</span>
                  </label>
                  <label className="auth-choice-pill">
                    <input type="radio" name="sampleData" checked={!form.wantsSampleData} onChange={() => onChange("wantsSampleData", false)} />
                    <span>I will use my own data</span>
                  </label>
                </div>
              </label>
              <div className="auth-panel-footer-note">
                <span>We will configure your demo workspace based on your business category and selected segment.</span>
                <strong>{form.wantsSampleData ? "Sample catalogue and quotation setup will be created for you." : "We will create the structure and you can upload your own data."}</strong>
              </div>
              <button type="submit" className="auth-submit-btn" disabled={submitting}>{submitting ? "Creating demo..." : "Create Demo Account ->"}</button>
            </form>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function PublicLoginPage({
  bootstrapRequired,
  bootstrapHint,
  loginForm,
  setupForm,
  rememberMe,
  infoMessage,
  errorMessage,
  onLoginFormChange,
  onSetupFormChange,
  onRememberMeChange,
  onLogin,
  onBootstrapAdmin
}) {
  const showSetup = Boolean(bootstrapRequired);
  const showLogin = !showSetup;
  const [showPassword, setShowPassword] = useState(false);
  const authTitle = showSetup ? "First-Time Setup" : "Login";
  const authSubtitle = showSetup
    ? "Create the first platform admin account to bootstrap Quotsy."
    : "Sign in to manage quotations, customers, products, and platform operations.";
  const valueCards = [
    {
      title: "Seller Workspace",
      text: "Manage quotations, customers, products, and follow-ups from one connected workspace.",
      tone: "blue"
    },
    {
      title: "Platform Management",
      text: "Control sellers, subscriptions, onboarding, and governance from a single admin console.",
      tone: "indigo"
    },
    {
      title: "Faster Business",
      text: "Move MSME workflows out of scattered chats and sheets into a clean operating system.",
      tone: "mustard"
    }
  ];

  return (
    <div className="auth-wrap public-page-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <div className="auth-bg-glow" />
      <div className="public-page-stage">
      <PublicPageHeader activePath="/login" />
      <div className={`auth-grid ${showSetup || showLogin ? "auth-grid-duo" : ""}`}>
        {(showSetup || showLogin) && (
          <div className="glass-card hero-card auth-showcase-card">
            <p className="eyebrow">Quotsy Multi-Tenant SaaS</p>
            <h1>Quotsy Platform</h1>
            <p>Run your sales, quotations, customer operations, and multi-tenant governance from one connected workspace built for growing MSMEs.</p>
            <div className="auth-value-stack">
              {valueCards.map((card) => (
                <div key={card.title} className={`auth-value-card auth-value-card-${card.tone}`}>
                  <span className="auth-value-icon" aria-hidden="true" />
                  <div>
                    <strong>{card.title}</strong>
                    <span>{card.text}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="glass-card auth-visitor-mini-card">
              <strong>{PUBLIC_VISITOR_FAQS[0].question}</strong>
              <p>{PUBLIC_VISITOR_FAQS[0].answer}</p>
            </div>
          </div>
        )}

        <div className="auth-public-side">
          <div className="glass-card auth-card auth-panel-card">
            <div className="auth-panel-tabs" role="tablist" aria-label="Authentication mode">
              {showSetup ? (
                <span className="auth-panel-tab active">First-Time Setup</span>
              ) : (
                <>
                  <span className="auth-panel-tab active">Login</span>
                  <a className="auth-panel-tab auth-panel-tab-link" href="/try-demo">Register for Demo</a>
                </>
              )}
            </div>
            <div className="auth-panel-divider" />
            <div className="auth-panel-copy">
              {!showSetup && <div className="auth-access-badge">Secure Access</div>}
              <h2>{showSetup ? authTitle : "Welcome back"}</h2>
              <p>{showSetup ? authSubtitle : "Sign in to manage quotations, customers, products, and platform operations."}</p>
            </div>

            {bootstrapHint && (
              <div className="notice info">
                First-time platform setup is required before normal login. Open <a href="/platform-setup">Platform Setup</a>.
              </div>
            )}

            {showLogin && (
              <form className="auth-form-shell" onSubmit={onLogin}>
                <label className="auth-field auth-field-caps">
                  <span>Mobile Number</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><PhoneFieldIcon /></span>
                    <input
                      placeholder="Enter your mobile number"
                      value={loginForm.mobile}
                      onChange={(e) => onLoginFormChange({ ...loginForm, mobile: e.target.value })}
                      required
                    />
                  </div>
                </label>
                <label className="auth-field auth-field-caps">
                  <span>Password</span>
                  <div className="auth-input-shell">
                    <span className="auth-input-icon"><LockFieldIcon /></span>
                    <input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={loginForm.password}
                      onChange={(e) => onLoginFormChange({ ...loginForm, password: e.target.value })}
                      required
                    />
                    <button
                      type="button"
                      className="auth-input-toggle"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      <EyeFieldIcon open={showPassword} />
                    </button>
                  </div>
                </label>
                <div className="auth-login-meta-row">
                  <label className="auth-checkbox-row">
                    <input type="checkbox" checked={rememberMe} onChange={(e) => onRememberMeChange(e.target.checked)} />
                    <span>Remember me on this device</span>
                  </label>
                  <button type="button" className="auth-forgot-link" onClick={() => onLoginFormChange({ ...loginForm, password: "", otp: "" })}>
                    Forgot?
                  </button>
                </div>
                {infoMessage && <div className="notice info">{infoMessage}</div>}
                <button type="submit" className="auth-submit-btn">
                  {"Sign In ->"}
                </button>
                <div className="auth-panel-meta">
                  <span>Trusted by growing sellers & teams</span>
                  <strong>Srijan Labs</strong>
                </div>
              </form>
            )}

            {showSetup && (
              <form className="auth-form-shell" onSubmit={onBootstrapAdmin}>
                <label className="auth-field">
                  <span>Admin Name</span>
                  <input placeholder="Enter admin name" value={setupForm.name} onChange={(e) => onSetupFormChange({ ...setupForm, name: e.target.value })} required />
                </label>
                <label className="auth-field">
                  <span>Mobile Number</span>
                  <input placeholder="Enter admin mobile number" value={setupForm.mobile} onChange={(e) => onSetupFormChange({ ...setupForm, mobile: e.target.value })} required />
                </label>
                <label className="auth-field">
                  <span>Password</span>
                  <input placeholder="Create admin password" type="password" value={setupForm.password} onChange={(e) => onSetupFormChange({ ...setupForm, password: e.target.value })} required />
                </label>
                <button type="submit">Create Platform Admin</button>
                <div className="auth-panel-footer-note">
                  <span>This setup appears only until the first user is created.</span>
                  <strong>After setup, normal seller/admin login will appear here.</strong>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      </div>
      {errorMessage && <div className="error-toast">{errorMessage}</div>}
    </div>
  );
}

function PublicLandingPage() {
  const products = [
    {
      name: "Quicksy",
      eyebrow: "Commerce Platform",
      title: "Smart quotation and operations management for MSMEs that need speed and control.",
      description:
        "Manage quotations, customers, deliveries, and daily execution from one modern system designed to help MSMEs move beyond manual coordination.",
      bullets: [
        "Quotation management",
        "Customer management",
        "Delivery tracking",
        "Business dashboards"
      ],
      primaryHref: "/lead",
      primaryLabel: "Explore Quicksy"
    },
    {
      name: "Quotsy",
      eyebrow: "Quotation & Billing SaaS",
      title: "Professional quotation and billing workflows for growing MSME teams.",
      description:
        "Create polished quotations faster, organize customer data, and run billing operations through a scalable multi-user SaaS platform built for digitization.",
      bullets: [
        "Quotation generation",
        "Customer database",
        "GST-ready workflow",
        "Multi-user access"
      ],
      primaryHref: "/try-demo",
      primaryLabel: "Explore Quotsy"
    }
  ];

  const capabilities = [
    {
      title: "MSME Digitization",
      text: "We help MSMEs move from WhatsApp threads, registers, and scattered sheets into structured digital systems."
    },
    {
      title: "Operational Discipline",
      text: "Our products bring clarity to quotations, follow-ups, and day-to-day business operations."
    },
    {
      title: "Commerce Enablement",
      text: "We build practical platforms for retail, distribution, fabrication, and service-led businesses that need real execution support."
    },
    {
      title: "Growth Readiness",
      text: "We create systems that help MSMEs become more reliable, more measurable, and more ready to scale."
    }
  ];

  const industries = [
    "Retail & Quick Commerce",
    "Manufacturing",
    "Distribution",
    "B2B Trade",
    "Service Businesses",
    "Digital-First Startups"
  ];

  const reasons = [
    {
      title: "Built for real MSME workflows",
      text: "Our products are shaped by how business owners, operators, and teams actually work on the ground."
    },
    {
      title: "Digitization that feels practical",
      text: "We focus on replacing friction with structure, so digitization feels useful from day one instead of overwhelming."
    },
    {
      title: "Ready to grow with you",
      text: "Our systems are secure, scalable, and designed to support future automation, analytics, and expansion."
    }
  ];

  const partners = [
    {
      name: "Samsona",
      role: "Sales & Service Partner",
      logo: samsonaLogo,
      description:
        "Samsona serves as the Sales and Service partner for Srijan Labs, supporting customer acquisition, onboarding, and ongoing service delivery. Their strong field presence and customer support capabilities ensure that businesses adopting our platforms receive timely assistance and smooth implementation.",
      bullets: [
        "Product consultation and onboarding",
        "Implementation support",
        "Customer service and training",
        "Ongoing operational assistance"
      ],
      closing:
        "This collaboration ensures that customers not only adopt our technology but also gain the guidance needed to use it effectively in their daily operations."
    },
    {
      name: "Span Media",
      role: "Hardware Partner â€“ Digital Media Transformation",
      logo: spanLogo,
      description:
        "Span Media partners with Srijan Labs to provide the hardware infrastructure required for digital media transformation solutions. Their expertise in display technologies and digital hardware enables organizations to implement modern screen networks and smart media systems.",
      bullets: [
        "Digital display networks",
        "Commercial screen infrastructure",
        "Media hardware for digital signage",
        "Integrated hardware setups for content management platforms"
      ],
      closing:
        "With Span Mediaâ€™s hardware capabilities and Srijan Labsâ€™ software platforms, organizations can build complete end-to-end digital media ecosystems."
    }
  ];

  return (
    <div className="landing-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>

      <header className="labs-topbar">
        <div className="labs-topbar-inner">
          <div className="labs-brand">
            <img className="labs-brand-logo" src={srijanLabsLogo} alt="Srijan Labs" />
            <div>
              <div className="labs-brand-title">Srijan Labs</div>
              <div className="labs-brand-subtitle">Digital platforms built to empower MSMEs</div>
            </div>
          </div>

          <nav className="labs-nav">
            <a href="#products">Products</a>
            <a href="#solutions">Solutions</a>
            <a href="#industries">Industries</a>
            <a href="#partners">Partners</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>

          <div className="labs-top-actions">
            <a className="labs-btn labs-btn-secondary" href="/login">Sign In</a>
            <a className="labs-btn labs-btn-primary" href="/try-demo">Get Started</a>
          </div>
        </div>
      </header>

      <main className="labs-main">
        <section className="labs-hero">
          <div className="labs-hero-copy">
            <div className="labs-pill">MSME Digitization Â· SaaS Products Â· Operational Systems</div>
            <h1>Empowering MSMEs through practical digitization and modern business software.</h1>
            <p>
              Srijan Labs builds modern SaaS products that help MSMEs digitize quotations, customers,
              billing, and operations without losing the practical rhythm of how their business actually runs.
            </p>
            <div className="labs-hero-actions">
              <a className="labs-btn labs-btn-primary" href="#products">Explore Products</a>
              <a className="labs-btn labs-btn-secondary" href="/lead">Talk to Us</a>
            </div>
            <div className="labs-metrics">
              <div><span>2</span> flagship MSME platforms</div>
              <div><span>Digitization</span> with practical adoption</div>
              <div><span>Built for</span> real business workflows</div>
            </div>
          </div>

          <div className="labs-hero-visual-column">
            <div className="labs-hero-image-wrap">
              <div className="labs-hero-image-frame">
                <img className="labs-hero-image" src={srijanHero} alt="MSME digitization and business operations illustration" />
              </div>
            </div>

            <div className="labs-hero-support-grid">
              <article className="labs-hero-support-card">
                <p className="eyebrow">Quicksy</p>
                <img className="labs-product-logo" src={quicksyLogo} alt="Quicksy" />
                <h4>Commerce operations for MSME teams</h4>
                <div className="labs-mini-list">
                  <span>Quotations · Customers · Deliveries</span>
                  <span>Inventory visibility</span>
                </div>
              </article>

              <article className="labs-hero-support-card">
                <p className="eyebrow">Quotsy</p>
                <h4>Quotation intelligence for modern MSMEs</h4>
                <div className="labs-mini-list">
                  <span>Fast quotation creation</span>
                  <span>Customer database</span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="products" className="labs-section">
          <div className="labs-section-head">
            <p className="eyebrow">Our Products</p>
            <h2>Products built to help MSMEs digitize and grow without bloated complexity.</h2>
            <p>A focused product ecosystem for commerce execution, quotation workflows, operational visibility, and everyday business discipline.</p>
          </div>

          <div className="labs-product-grid">
            {products.map((product) => (
              <article key={product.name} className="labs-product-card">
                <div className="labs-product-head">
                  <div>
                    <p className="eyebrow">{product.eyebrow}</p>
                    {product.name === "Quicksy" ? (
                      <img className="labs-product-logo large" src={quicksyLogo} alt="Quicksy" />
                    ) : (
                      <h3>{product.name}</h3>
                    )}
                  </div>
                  <div className="labs-flagship-badge">Flagship</div>
                </div>
                <p className="labs-product-title">{product.title}</p>
                <p className="labs-product-description">{product.description}</p>
                <div className="labs-product-bullets">
                  {product.bullets.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                <div className="labs-product-actions">
                  <a className="labs-btn labs-btn-green" href={product.primaryHref}>{product.primaryLabel}</a>
                  <span>See platform details</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="solutions" className="labs-section labs-section-soft">
          <div className="labs-section-head">
            <p className="eyebrow">Capabilities</p>
            <h2>What we are building for MSMEs moving from manual operations to digital systems.</h2>
          </div>
          <div className="labs-capability-grid">
            {capabilities.map((item) => (
              <article key={item.title} className="labs-capability-card">
                <div className="labs-icon-block" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="labs-section">
          <div className="labs-dual-showcase">
            <article className="labs-showcase-card dark">
              <p className="eyebrow">Quicksy</p>
              <h3>The modern commerce platform for everyday execution.</h3>
              <p>Built for MSME teams that need operational speed across quotation management, customer tracking, and delivery orchestration.</p>
              <div className="labs-dark-kpis">
                <div><p>Quotations Today</p><strong>284</strong></div>
                <div><p>Active Riders</p><strong>42</strong></div>
              </div>
              <div className="labs-bar-panel">
                <div />
                <div />
                <div />
                <div />
                <div />
              </div>
            </article>

            <article className="labs-showcase-card">
              <p className="eyebrow">Quotsy</p>
              <h3>Smart quotation and billing control for growth-stage MSMEs.</h3>
              <p>Designed for businesses that need faster quotations, cleaner customer handling, and stronger billing discipline.</p>
              <div className="labs-quote-card">
                <div className="labs-quote-head">
                  <div>
                    <p>Quotation #BB-2048</p>
                    <span>Sai Laser Solutions</span>
                  </div>
                  <div className="labs-live-badge">GST Ready</div>
                </div>
                <div className="labs-quote-lines">
                  <div><span>Acrylic Sheet</span><strong>Rs 14,200</strong></div>
                  <div><span>Laser Cutting</span><strong>Rs 6,850</strong></div>
                  <div><span>GST</span><strong>Rs 3,789</strong></div>
                </div>
                <div className="labs-quote-total"><span>Total</span><strong>Rs 24,839</strong></div>
              </div>
            </article>
          </div>
        </section>

        <section id="partners" className="labs-section labs-section-soft">
          <div className="labs-section-head">
            <p className="eyebrow">Our Partners</p>
            <h2>Built on collaboration that helps businesses digitize faster and operate better.</h2>
            <p>
              At Srijan Labs, we collaborate with trusted partners who extend our ability to deliver reliable technology
              solutions and seamless customer experiences. Our partners help businesses adopt digital transformation
              faster and more efficiently.
            </p>
          </div>

          <div className="labs-partner-grid">
            {partners.map((partner) => (
              <article key={partner.name} className="labs-partner-card">
                <div className="labs-partner-head">
                  <img className="labs-partner-logo" src={partner.logo} alt={partner.name} />
                  <div>
                    <h3>{partner.name}</h3>
                    <p className="labs-partner-role">{partner.role}</p>
                  </div>
                </div>

                <p>{partner.description}</p>

                <div className="labs-partner-points">
                  {partner.bullets.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>

                <p className="labs-partner-closing">{partner.closing}</p>
              </article>
            ))}
          </div>

          <div className="labs-collaboration-note">
            <h3>Built on Collaboration</h3>
            <p>
              By combining technology innovation, strong service support, and reliable hardware infrastructure,
              Srijan Labs and its partners work together to deliver solutions that help businesses operate smarter and scale faster.
            </p>
          </div>
        </section>

        <section id="industries" className="labs-section labs-section-soft">
          <div className="labs-section-head">
            <p className="eyebrow">Industries</p>
            <h2>We are building for MSMEs across multiple business segments, not just one fashionable niche.</h2>
          </div>
          <div className="labs-industry-grid">
            {industries.map((industry) => (
              <div key={industry} className="labs-industry-chip">{industry}</div>
            ))}
          </div>
        </section>

        <section id="about" className="labs-section">
          <div className="labs-reason-grid">
            {reasons.map((reason) => (
              <article key={reason.title} className="labs-reason-card">
                <h3>{reason.title}</h3>
                <p>{reason.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className="labs-section labs-contact-wrap">
          <div className="labs-contact-card">
            <div className="labs-contact-grid">
              <div>
                <p className="eyebrow">Let&apos;s Build</p>
                <h2>Ready to digitize business operations with software that actually helps MSMEs?</h2>
                <p>Explore Quicksy and Quotsy, or connect with Srijan Labs to build the next digital layer your business actually needs.</p>
              </div>

              <div className="labs-contact-actions">
                <a className="labs-btn labs-btn-green" href="#products">Explore Products</a> &nbsp; &nbsp;
                <a className="labs-btn labs-btn-secondary-light" href="/lead">Contact Us</a>
                <div className="labs-contact-note">
                  Built for founders, operators, commercial teams, and businesses tired of fragmented systems.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="labs-footer">
        <div className="labs-footer-grid">
            <div>
              <div className="labs-brand footer">
              <img className="labs-brand-logo footer" src={srijanLabsLogo} alt="Srijan Labs" />
              <div>
                <div className="labs-brand-title">Srijan Labs</div>
                <div className="labs-brand-subtitle">Digital platforms built for MSME growth</div>
              </div>
            </div>
            <p className="labs-footer-copy">
              Building practical SaaS platforms for MSME digitization, commerce operations, quotation workflows, and operational control.
            </p>
          </div>

          <div>
            <h4>Products</h4>
            <div className="labs-footer-links">
              <a href="#products">Quicksy</a>
              <a href="#products">Quotsy</a>
            </div>
          </div>

          <div>
            <h4>Solutions</h4>
            <div className="labs-footer-links">
              <a href="#solutions">Digital Transformation</a>
              <a href="#solutions">Commerce Platforms</a>
              <a href="#solutions">Product Development</a>
            </div>
          </div>

          <div>
            <h4>Company</h4>
            <div className="labs-footer-links">
              <a href="#about">About</a>
              <a href="#partners">Partners</a>
              <a href="#contact">Contact</a>
              <a href="/login">Login</a>
            </div>
          </div>
        </div>
        <div className="labs-footer-bottom">Â© 2026 Srijan Labs. All rights reserved.</div>
      </footer>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(getStoredAuth());
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapRequired, setBootstrapRequired] = useState(null);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(getStoredCookieConsent);

  const [activeModule, setActiveModule] = useState("Dashboard");
  const [dashboardRange, setDashboardRange] = useState("daily");
  const [search, setSearch] = useState("");
  const [orderSort, setOrderSort] = useState({ key: "created_at", direction: "desc" });

  const [loginForm, setLoginForm] = useState({ mobile: "", password: "", otp: "" });
  const [setupForm, setSetupForm] = useState({ name: "", mobile: "", password: "" });
  const [rememberMe, setRememberMe] = useState(() => Boolean(getStoredAuth()?.rememberMe));
  const [publicDemoForm, setPublicDemoForm] = useState({
    name: "",
    mobile: "",
    password: "",
    email: "",
    businessName: "",
    businessCategory: "",
    businessSegment: "",
    wantsSampleData: true
  });
  const [publicLeadForm, setPublicLeadForm] = useState({
    name: "",
    mobile: "",
    email: "",
    businessName: "",
    city: "",
    businessType: "",
    businessSegment: "",
    wantsSampleData: true,
    requirement: "",
    interestedInDemo: false
  });
  const [publicLeadSubmitting, setPublicLeadSubmitting] = useState(false);
  const [publicLeadSuccess, setPublicLeadSuccess] = useState("");
  const [publicLeadError, setPublicLeadError] = useState("");
  const [publicDemoSubmitting, setPublicDemoSubmitting] = useState(false);
  const [publicDemoSuccess, setPublicDemoSuccess] = useState("");
  const [publicDemoError, setPublicDemoError] = useState("");

  const [dashboardData, setDashboardData] = useState(null);
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [approvalFilter, setApprovalFilter] = useState("pending");
  const [selectedApprovalId, setSelectedApprovalId] = useState("");
  const [selectedApprovalDetail, setSelectedApprovalDetail] = useState(null);
  const [approvalDecisionLoading, setApprovalDecisionLoading] = useState(false);
  const [approvalDecisionNote, setApprovalDecisionNote] = useState("");

  const [seller, setSeller] = useState(null);
  const [sellerSetupStatus, setSellerSetupStatus] = useState(null);
  const [theme, setTheme] = useState("matte-blue");
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [businessName, setBusinessName] = useState("");
  const [quotationNumberPrefix, setQuotationNumberPrefix] = useState("QTN");
  const [sellerGstNumber, setSellerGstNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  const [sellers, setSellers] = useState([]);
  const [platformFormulaRules, setPlatformFormulaRules] = useState([]);
  const [platformUnitConversions, setPlatformUnitConversions] = useState([]);
  const [platformFormulaLoading, setPlatformFormulaLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [goLiveGates, setGoLiveGates] = useState([]);
  const [goLiveGatesLoading, setGoLiveGatesLoading] = useState(false);
  const [goLiveGateSavingId, setGoLiveGateSavingId] = useState(null);
  const [leads, setLeads] = useState([]);
  const [usageOverview, setUsageOverview] = useState(null);
  const [decodeRules, setDecodeRules] = useState({
    customer_line: 1,
    mobile_line: 2,
    item_line: 3,
    delivery_date_line: 4,
    delivery_type_line: 5,
    enabled: true
  });
  const [quotationTemplate, setQuotationTemplate] = useState({
    template_preset: "default",
    template_theme_key: "default",
    header_text: "Quotation",
    body_template: "Dear {{customer_name}}, please find our quotation {{quotation_number}} for your review.",
    footer_text: "Thank you for your business.",
    company_phone: "",
    company_email: "",
    company_address: "",
    header_image_data: null,
    show_header_image: false,
    logo_image_data: null,
    show_logo_only: false,
    footer_image_data: null,
    show_footer_image: false,
    accent_color: "#737373",
    notes_text: "Delivery and installation charges are extra unless mentioned.",
    terms_text: "Payment terms and final scope will be confirmed at quotation stage.",
    show_bank_details: true,
    show_notes: true,
    show_terms: true,
    email_enabled: false,
    whatsapp_enabled: true
  });

  const [sellerForm, setSellerForm] = useState({
    name: "",
    sellerCode: "",
    mobile: "",
    email: "",
    status: "pending",
    trialEndsAt: "",
    subscriptionPlan: "DEMO",
    maxUsers: "",
    maxOrdersPerMonth: "",
    isLocked: false,
    themeKey: "matte-blue",
    brandPrimaryColor: "#2563eb",
    masterName: "",
    masterMobile: "",
    masterPassword: ""
  });
  const [showSellerCreateModal, setShowSellerCreateModal] = useState(false);
  const [sellerSearch, setSellerSearch] = useState("");
  const [sellerLifecycleDrafts, setSellerLifecycleDrafts] = useState({});
  const [planDrafts, setPlanDrafts] = useState({});
  const [showPlanCreateModal, setShowPlanCreateModal] = useState(false);
  const [planSearch, setPlanSearch] = useState("");
  const [subscriptionSearch, setSubscriptionSearch] = useState("");
  const [selectedSellerSubscription, setSelectedSellerSubscription] = useState(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionModalDraft, setSubscriptionModalDraft] = useState({
    subscriptionId: null,
    sellerId: null,
    planCode: "",
    status: "trial",
    trialEndAt: "",
    convertedFromTrial: false
  });
  const [selectedSellerDetail, setSelectedSellerDetail] = useState(null);
  const [showSellerDetailModal, setShowSellerDetailModal] = useState(false);
  const [sellerDetailLoading, setSellerDetailLoading] = useState(false);
  const [currentSellerConfiguration, setCurrentSellerConfiguration] = useState(null);
  const [selectedPlanDetail, setSelectedPlanDetail] = useState(null);
  const [showPlanDetailModal, setShowPlanDetailModal] = useState(false);
  const [upgradeRequestLoading, setUpgradeRequestLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedLeadDetail, setSelectedLeadDetail] = useState(null);
  const [leadDetailLoading, setLeadDetailLoading] = useState(false);
  const [leadActivityNote, setLeadActivityNote] = useState("");
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);
  const [showLeadConvertModal, setShowLeadConvertModal] = useState(false);
  const [leadConvertSubmitting, setLeadConvertSubmitting] = useState(false);
  const [leadConvertForm, setLeadConvertForm] = useState({
    sellerName: "",
    businessName: "",
    sellerCode: "",
    city: "",
    state: "",
    businessCategory: "",
    businessSegment: "",
    wantsSampleData: true,
    brandingMode: "header",
    headerImageData: null,
    logoImageData: null,
    masterUserName: "",
    masterUserMobile: "",
    masterUserPassword: ""
  });
  const [planForm, setPlanForm] = useState({
    planCode: "",
    planName: "",
    price: "",
    billingCycle: "monthly",
    isActive: true,
    isDemoPlan: false,
    planAccessType: "FREE",
    templateAccessTier: "FREE",
    trialEnabled: false,
    trialDurationDays: "14",
    watermarkText: "Quotsy - Trial Version",
    maxUsers: "",
    maxQuotations: "",
    maxCustomers: "",
    inventoryEnabled: true,
    reportsEnabled: true,
    gstEnabled: true,
    exportsEnabled: true,
    quotationWatermarkEnabled: true,
    quotationCreationLockedAfterExpiry: true
  });
  const [notificationForm, setNotificationForm] = useState({
    title: "",
    message: "",
    audienceType: "all_sellers",
    channel: "in_app",
    sendNow: true,
    scheduledAt: "",
    sellerId: ""
  });
  const [showNotificationCreateModal, setShowNotificationCreateModal] = useState(false);
  const [selectedNotificationDetail, setSelectedNotificationDetail] = useState(null);
  const [showNotificationDetailModal, setShowNotificationDetailModal] = useState(false);
  const [notificationDetailLoading, setNotificationDetailLoading] = useState(false);
  const [showSellerNotificationsModal, setShowSellerNotificationsModal] = useState(false);

  const [userForm, setUserForm] = useState(createInitialUserForm);
  const [userFormErrors, setUserFormErrors] = useState({});
  const [customerForm, setCustomerForm] = useState(createInitialCustomerForm);
  const [customerGstValidation, setCustomerGstValidation] = useState({
    status: "idle",
    gstNumber: "",
    profile: null,
    message: ""
  });
  const [customerShippingGstValidation, setCustomerShippingGstValidation] = useState({});
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUserEditModal, setShowUserEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showProductUploadModal, setShowProductUploadModal] = useState(false);
  const [showSingleProductModal, setShowSingleProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [singleProductForm, setSingleProductForm] = useState(() => createInitialSingleProductForm());
  const [productUploadText, setProductUploadText] = useState("");
  const [productPreviewRows, setProductPreviewRows] = useState([]);
  const [showProductPreviewModal, setShowProductPreviewModal] = useState(false);
  const [productUploadModalMessage, setProductUploadModalMessage] = useState("");
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [orderVersions, setOrderVersions] = useState([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [sellerPage, setSellerPage] = useState(1);
  const [customerPage, setCustomerPage] = useState(1);
  const [productPage, setProductPage] = useState(1);
  const [productSourceFilter, setProductSourceFilter] = useState("all");
  const [userPage, setUserPage] = useState(1);
  const [subUserAction, setSubUserAction] = useState("");
  const [subUserSearchInput, setSubUserSearchInput] = useState("");

  const PAGE_SIZE = 10;
  const isPlatformAdmin = Boolean(auth?.user?.isPlatformAdmin);
  const isSubUser = !isPlatformAdmin && auth?.user?.role === "Sub User";
  const grantedPermissions = useMemo(() => new Set(Array.isArray(auth?.user?.permissions) ? auth.user.permissions : []), [auth?.user?.permissions]);
  const hasPermission = (permissionKey) => grantedPermissions.has("*") || grantedPermissions.has(permissionKey);
  const canViewDashboard = hasPermission(PERMISSION_KEYS.dashboardView);
  const canViewQuotations = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationView);
  const canCreateQuotation = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationCreate);
  const canSearchQuotation = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationSearch);
  const canDownloadQuotationPdf = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationDownloadPdf);
  const canEditQuotation = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationEdit);
  const canReviseQuotation = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationRevise);
  const canSendQuotation = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationSend);
  const canMarkPaid = !isPlatformAdmin && hasPermission(PERMISSION_KEYS.quotationMarkPaid);
  const canViewCustomers = hasPermission(PERMISSION_KEYS.customerView);
  const canCreateCustomer = hasPermission(PERMISSION_KEYS.customerCreate);
  const canEditCustomer = hasPermission(PERMISSION_KEYS.customerEdit);
  const canViewProducts = hasPermission(PERMISSION_KEYS.productView);
  const canCreateProduct = hasPermission(PERMISSION_KEYS.productCreate);
  const canEditProduct = hasPermission(PERMISSION_KEYS.productEdit);
  const canViewUsers = hasPermission(PERMISSION_KEYS.userView);
  const canCreateUser = hasPermission(PERMISSION_KEYS.userCreate);
  const canEditUser = hasPermission(PERMISSION_KEYS.userEdit);
  const canViewNotifications = hasPermission(PERMISSION_KEYS.notificationView);
  const canViewSubscriptions = hasPermission(PERMISSION_KEYS.subscriptionView);
  const canViewSettings = hasPermission(PERMISSION_KEYS.settingsView);
  const canViewConfiguration = hasPermission(PERMISSION_KEYS.configurationView);
  const canViewOwnApprovals = hasPermission(PERMISSION_KEYS.approvalViewOwn);
  const canViewApprovals = hasPermission(PERMISSION_KEYS.approvalViewTeam) || hasPermission(PERMISSION_KEYS.approvalOverride);
  const canAccessApprovals = canViewApprovals || canViewOwnApprovals;
  const canDecideApprovals = hasPermission(PERMISSION_KEYS.approvalDecide);
  const canEditSettings = hasPermission(PERMISSION_KEYS.settingsEdit);
  const canEditConfiguration = hasPermission(PERMISSION_KEYS.configurationEdit);
  const canSaveConfigurationDraft = hasPermission(PERMISSION_KEYS.configurationSaveDraft);
  const canPublishConfiguration = hasPermission(PERMISSION_KEYS.configurationPublish);
  const sellerModules = SELLER_MODULES.filter((module) => {
    if (module === "Approvals" && !canAccessApprovals) return false;
    if (module === "Users" && !canViewUsers) return false;
    if (module === "Subscriptions" && !canViewSubscriptions) return false;
    if (module === "Settings" && !canViewSettings) return false;
    if (module === "Configuration Studio" && !canViewConfiguration && !canEditConfiguration) return false;
    return true;
  });
  const currentModules = isPlatformAdmin ? PLATFORM_MODULES : isSubUser ? SUB_USER_MODULES : sellerModules;
  const currentModuleMeta = isPlatformAdmin ? PLATFORM_MODULE_META : MODULE_META;
  const sellerSetupStage = !isPlatformAdmin ? String(sellerSetupStatus?.stage || "ready").toLowerCase() : "ready";
  const setupFieldLabelMap = {
    business_name: "Business Name",
    quotation_prefix: "Quotation Prefix",
    seller_gst_number: "Seller GST Number",
    company_contact: "Company Phone or Company Email",
    company_address: "Company Address"
  };
  const pendingSetupLabels = Array.isArray(sellerSetupStatus?.missingSettings)
    ? sellerSetupStatus.missingSettings.map((entry) => setupFieldLabelMap[entry] || entry)
    : [];
  const setupAllowedModules = useMemo(() => {
    if (isPlatformAdmin || isSubUser) return null;
    if (sellerSetupStage === "settings") return new Set(["Settings", "Help Center", "Subscriptions"]);
    if (sellerSetupStage === "configuration") return new Set(["Settings", "Configuration Studio", "Help Center", "Subscriptions"]);
    return null;
  }, [isPlatformAdmin, isSubUser, sellerSetupStage]);
  const getModuleSetupLockMessage = (module) => {
    if (isPlatformAdmin || isSubUser || !setupAllowedModules || setupAllowedModules.has(module)) return "";
    if (sellerSetupStage === "settings") {
      return "Complete mandatory business settings to unlock other modules.";
    }
    if (sellerSetupStage === "configuration") {
      return "Complete Configuration Studio setup to unlock other modules.";
    }
    return "";
  };
  const isModuleSetupLocked = (module) => Boolean(getModuleSetupLockMessage(module));
  const sellerSubscriptionBanner = getSubscriptionBannerData(seller, plans);
  const publicLeadPaths = new Set(["/lead", "/lead-capture"]);
  const publicDemoPaths = new Set(["/try-demo", "/demo-signup"]);
  const publicVisitorHelpPaths = new Set(["/user-guide", "/visitor-help", "/visitor-faqs"]);
  const publicFeaturesPaths = new Set(["/quotsy-features", "/features"]);
  const bootstrapSetupPaths = new Set(["/platform-setup", "/setup-admin"]);
  const isPublicLandingPage = window.location.pathname === "/";
  const isPublicLeadPage = publicLeadPaths.has(window.location.pathname);
  const isPublicDemoPage = publicDemoPaths.has(window.location.pathname);
  const isPublicVisitorHelpPage = publicVisitorHelpPaths.has(window.location.pathname);
  const isPublicFeaturesPage = publicFeaturesPaths.has(window.location.pathname);
  const isBootstrapSetupPage = bootstrapSetupPaths.has(window.location.pathname);

  useEffect(() => {
    document.title = isPublicLandingPage ? "Srijan Labs" : "Quotsy";
  }, [isPublicLandingPage]);

  useEffect(() => {
    if (
      auth?.token ||
      !bootstrapRequired ||
      isBootstrapSetupPage
    ) {
      return;
    }

    window.history.replaceState({}, "", "/platform-setup");
  }, [
    auth?.token,
    bootstrapRequired,
    isBootstrapSetupPage
  ]);

  function saveAuth(authData, shouldRemember = true) {
    const nextAuth = {
      ...authData,
      rememberMe: shouldRemember,
      sessionExpiresAt: authData.sessionExpiresAt || (shouldRemember ? new Date(Date.now() + REMEMBER_ME_DURATION_MS).toISOString() : null)
    };
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      if (shouldRemember) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
      }
    } catch {
      // Keep auth in-memory if browser storage is unavailable.
    }
    setAuth(nextAuth);
  }

  function clearAuth(message = "") {
    clearStoredAuth();
    setAuth(null);
    setSellerSetupStatus(null);
    if (message) setError(message);
    setSuccessNotice("");
  }

  async function handleApiError(err) {
    function humanizeErrorField(field) {
      const normalized = String(field || "").trim();
      if (!normalized) return "";
      const map = {
        mobile: "Mobile Number",
        gstNumber: "GST Number",
        "itemDisplayConfig.categoryRules": "Item Display Category Rules",
        business_name: "Business Name",
        quotation_prefix: "Quotation Prefix",
        seller_gst_number: "Seller GST Number",
        company_contact: "Company Contact",
        company_address: "Company Address"
      };
      if (map[normalized]) return map[normalized];
      const arrayMatch = normalized.match(/^shippingAddresses\[(\d+)\]\.gstNumber$/);
      if (arrayMatch) {
        return `Shipping Address ${Number(arrayMatch[1]) + 1} GST Number`;
      }
      return normalized
        .replace(/[._]/g, " ")
        .replace(/\[(\d+)\]/g, " $1 ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function normalizeErrorReason(message) {
      const raw = String(message || "").trim();
      if (!raw) return "Please check the entered values and try again.";
      const lower = raw.toLowerCase();
      if (lower.includes("character varying")) return "Entered value is too long for the allowed limit.";
      if (lower.includes("duplicate key") || lower.includes("unique constraint")) return "This value already exists. Please use a different value.";
      if (lower.includes("invalid input syntax")) return "Entered value format is invalid.";
      return raw;
    }

    setSuccessNotice("");
    if (err?.status === 401) {
      clearAuth("Session expired. Please login again.");
      setAuthReady(true);
      return;
    }
    const reason = normalizeErrorReason(err?.message);
    const fieldLabel = humanizeErrorField(err?.field);
    const finalMessage = fieldLabel ? `${fieldLabel}: ${reason}` : reason;
    setError(finalMessage);
  }

  useEffect(() => {
    setError("");
  }, [activeModule]);

  function updatePublicLeadField(field, value) {
    setPublicLeadForm((prev) => ({
      ...prev,
      ...(field === "businessType"
        ? {
            businessType: value,
            businessSegment: getBusinessSegments(value)[0] || ""
          }
        : {
            [field]: value
          })
    }));
  }

  function updatePublicDemoField(field, value) {
    setPublicDemoForm((prev) => ({
      ...prev,
      ...(field === "businessCategory"
        ? {
            businessCategory: value,
            businessSegment: getBusinessSegments(value)[0] || ""
          }
        : {
            [field]: value
          })
    }));
  }

  async function handleLeadConvertBrandingImageChange(targetField, event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setLeadConvertForm((prev) => ({
        ...prev,
        [targetField]: dataUrl
      }));
    } catch (err) {
      handleApiError(err);
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmitPublicLead(event) {
    event.preventDefault();
    try {
      setPublicLeadSubmitting(true);
      setPublicLeadError("");
      setPublicLeadSuccess("");
      const response = await apiFetch("/api/lead-capture", {
        method: "POST",
        body: JSON.stringify(publicLeadForm)
      });
      setPublicLeadSuccess(response.message || "Lead submitted successfully.");
      setPublicLeadForm({
        name: "",
        mobile: "",
        email: "",
        businessName: "",
        city: "",
        businessType: "",
        businessSegment: "",
        wantsSampleData: true,
        requirement: "",
        interestedInDemo: false
      });
    } catch (err) {
      setPublicLeadError(err.message || "Failed to submit lead");
    } finally {
      setPublicLeadSubmitting(false);
    }
  }

  async function loadSetupStatus() {
    try {
      const response = await apiFetch("/api/auth/setup-status");
      setBootstrapRequired(Boolean(response.bootstrapRequired));
    } catch {
      setBootstrapRequired(false);
    }
  }

  async function verifySession() {
    if (!auth?.token) {
      await loadSetupStatus();
      setAuthReady(true);
      return;
    }

    try {
      const me = await apiFetch("/api/auth/me");
      saveAuth(
        {
          token: auth.token,
          user: me.user,
          sessionExpiresAt: auth.sessionExpiresAt || null
        },
        Boolean(auth.rememberMe)
      );
      setBootstrapRequired(false);
    } catch {
      clearAuth("Please login to continue.");
      await loadSetupStatus();
    } finally {
      setAuthReady(true);
    }
  }

  async function refreshSellerSetupStatus() {
    if (!auth?.token || isPlatformAdmin || isSubUser) return;
    try {
      const setupStatusResponse = await apiFetch("/api/sellers/me/setup-status").catch(() => null);
      setSellerSetupStatus(setupStatusResponse);
    } catch (_error) {
      // Keep existing setup status if refresh fails.
    }
  }

  async function loadSellerSettings() {
    try {
      const [response, configResponse, setupStatusResponse] = await Promise.all([
        apiFetch("/api/sellers/me"),
        apiFetch("/api/seller-configurations/current/me").catch(() => ({ config: null })),
        apiFetch("/api/sellers/me/setup-status").catch(() => null)
      ]);
      const currentSeller = response?.seller || null;
      setSeller(currentSeller);
      setSellerSetupStatus(setupStatusResponse);
      setCurrentSellerConfiguration(configResponse?.config || null);
      if (currentSeller?.theme_key) {
        setTheme(currentSeller.theme_key);
      }
      setBusinessName(currentSeller?.business_name || "");
      if (currentSeller?.brand_primary_color) {
        setBrandColor(currentSeller.brand_primary_color);
      }
      if (currentSeller?.quotation_number_prefix) {
        setQuotationNumberPrefix(currentSeller.quotation_number_prefix);
      }
      setSellerGstNumber(currentSeller?.gst_number || "");
      setBankName(currentSeller?.bank_name || "");
      setBankBranch(currentSeller?.bank_branch || "");
      setBankAccountNo(currentSeller?.bank_account_no || "");
      setBankIfsc(currentSeller?.bank_ifsc || "");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function refreshCurrentSellerConfiguration() {
    if (!auth?.token || isPlatformAdmin) return;

    try {
      const configResponse = await apiFetch("/api/seller-configurations/current/me").catch(() => ({ config: null }));
      setCurrentSellerConfiguration(configResponse?.config || null);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function loadAdminData() {
    if (!auth?.user?.isPlatformAdmin) return;

    try {
      const [sellerRows, usage, planRows, leadRows, subscriptionRows, notificationRows, gateRows, formulaResponse, unitConversionResponse] = await Promise.all([
        apiFetch("/api/sellers"),
        apiFetch("/api/sellers/usage/overview"),
        apiFetch("/api/plans"),
        apiFetch("/api/leads"),
        apiFetch("/api/subscriptions"),
        apiFetch("/api/notifications"),
        apiFetch("/api/security-gates").catch(() => []),
        apiFetch("/api/formulas").catch(() => ({ formulas: [] })),
        apiFetch("/api/formulas/unit-conversions").catch(() => ({ unitConversions: [] }))
      ]);
      setSellers(sellerRows);
      setUsageOverview(usage);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setLeads(Array.isArray(leadRows) ? leadRows : []);
      setSubscriptions(Array.isArray(subscriptionRows) ? subscriptionRows : []);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      setGoLiveGates(Array.isArray(gateRows) ? gateRows : []);
      setPlatformFormulaRules(Array.isArray(formulaResponse?.formulas) ? formulaResponse.formulas : []);
      setPlatformUnitConversions(Array.isArray(unitConversionResponse?.unitConversions) ? unitConversionResponse.unitConversions : []);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function refreshPlatformFormulaRules() {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      const response = await apiFetch("/api/formulas");
      setPlatformFormulaRules(Array.isArray(response?.formulas) ? response.formulas : []);
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function refreshPlatformUnitConversions() {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      const response = await apiFetch("/api/formulas/unit-conversions");
      setPlatformUnitConversions(Array.isArray(response?.unitConversions) ? response.unitConversions : []);
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function handleCreatePlatformFormula(payload) {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      await apiFetch("/api/formulas", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await refreshPlatformFormulaRules();
      setError("Formula created successfully.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function handleUpdatePlatformFormula(formulaId, payload) {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      await apiFetch(`/api/formulas/${formulaId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      await refreshPlatformFormulaRules();
      setError("Formula updated successfully.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function handleDeletePlatformFormula(formulaId) {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      await apiFetch(`/api/formulas/${formulaId}`, { method: "DELETE" });
      await refreshPlatformFormulaRules();
      setError("Formula deleted successfully.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function handleCreatePlatformUnitConversion(payload) {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      await apiFetch("/api/formulas/unit-conversions", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      await refreshPlatformUnitConversions();
      setError("Unit conversion created successfully.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function handleUpdatePlatformUnitConversion(id, payload) {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      await apiFetch(`/api/formulas/unit-conversions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      await refreshPlatformUnitConversions();
      setError("Unit conversion updated successfully.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function handleDeletePlatformUnitConversion(id) {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setPlatformFormulaLoading(true);
      await apiFetch(`/api/formulas/unit-conversions/${id}`, {
        method: "DELETE"
      });
      await refreshPlatformUnitConversions();
      setError("Unit conversion deleted successfully.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setPlatformFormulaLoading(false);
    }
  }

  async function refreshGoLiveGates() {
    if (!auth?.user?.isPlatformAdmin) return;
    try {
      setGoLiveGatesLoading(true);
      const gateRows = await apiFetch("/api/security-gates");
      setGoLiveGates(Array.isArray(gateRows) ? gateRows : []);
    } catch (err) {
      handleApiError(err);
    } finally {
      setGoLiveGatesLoading(false);
    }
  }

  async function handleUpdateGoLiveGate(gateId, draft) {
    try {
      setGoLiveGateSavingId(Number(gateId));
      const response = await apiFetch(`/api/security-gates/${gateId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: draft.status,
          priority: draft.priority,
          ownerName: draft.ownerName || null,
          targetDate: draft.targetDate || null,
          notes: draft.notes || null,
          evidenceLink: draft.evidenceLink || null
        })
      });
      if (response?.gate) {
        setGoLiveGates((prev) => prev.map((entry) => (Number(entry.id) === Number(response.gate.id) ? response.gate : entry)));
      }
      setError(response?.message || "Gate updated.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setGoLiveGateSavingId(null);
    }
  }

  async function handleSubmitPublicDemo(event) {
    event.preventDefault();
    try {
      setPublicDemoSubmitting(true);
      setPublicDemoError("");
      setPublicDemoSuccess("");
      const response = await apiFetch("/api/auth/demo-signup", {
        method: "POST",
        body: JSON.stringify(publicDemoForm)
      });
      setPublicDemoSuccess(response.message || "Demo account created successfully.");
      saveAuth({ token: response.token, user: response.user, sessionExpiresAt: response.expiresAt || null });
      setPublicDemoForm({
        name: "",
        mobile: "",
        password: "",
        email: "",
        businessName: "",
        businessCategory: "",
        businessSegment: "",
        wantsSampleData: true
      });
      window.history.replaceState({}, "", "/");
    } catch (err) {
      setPublicDemoError(err.message || "Failed to create demo account");
    } finally {
      setPublicDemoSubmitting(false);
    }
  }

  async function refreshApprovals(nextSelectedApprovalId = selectedApprovalId) {
    if (!auth?.token || isPlatformAdmin || !canAccessApprovals) {
      setApprovals([]);
      setSelectedApprovalDetail(null);
      setSelectedApprovalId("");
      return [];
    }

    const approvalRows = await apiFetch("/api/quotations/approvals").catch(() => []);
    const normalizedRows = Array.isArray(approvalRows) ? approvalRows : [];
    setApprovals(normalizedRows);

    const preferredId = Number(nextSelectedApprovalId || 0);
    const resolvedId = preferredId && normalizedRows.some((approval) => Number(approval.id) === preferredId)
      ? preferredId
      : normalizedRows[0]?.id || "";

    setSelectedApprovalId(String(resolvedId || ""));

    if (resolvedId) {
      const detail = await apiFetch(`/api/quotations/approvals/${resolvedId}`).catch(() => null);
      setSelectedApprovalDetail(detail);
    } else {
      setSelectedApprovalDetail(null);
    }

    return normalizedRows;
  }

  async function openApprovalDetail(approvalId) {
    try {
      setSelectedApprovalId(String(approvalId));
      setApprovalDecisionNote("");
      const detail = await apiFetch(`/api/quotations/approvals/${approvalId}`);
      setSelectedApprovalDetail(detail);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function openApprovalRequest(approvalId) {
    setActiveModule("Approvals");
    await openApprovalDetail(approvalId);
    closeOrderDetailsModal();
  }

  async function handleApprovalDecision(approvalId, decision, decisionNote) {
    try {
      setApprovalDecisionLoading(true);
      await apiFetch(`/api/quotations/approvals/${approvalId}/decision`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          decisionNote
        })
      });
      setApprovalDecisionNote("");
      await Promise.all([
        refreshApprovals(approvalId),
        apiFetch("/api/quotations").then((quotationRows) => setQuotations(quotationRows)).catch(() => [])
      ]);
    } catch (err) {
      handleApiError(err);
    } finally {
      setApprovalDecisionLoading(false);
    }
  }

  async function loadDashboardData(range = dashboardRange) {
    if (!auth?.token) return;

    setLoading(true);
    setError("");
    try {
      const shouldLoadSellerScopedData = !isPlatformAdmin;
      const shouldLoadApprovals = shouldLoadSellerScopedData && canAccessApprovals;
      const shouldLoadTemplateData = shouldLoadSellerScopedData && (canViewSettings || canViewConfiguration || canEditSettings || canEditConfiguration || canSaveConfigurationDraft || canPublishConfiguration);
      const [summary, quotationRows, productRows, customerRows, rolesData, usersData, approvalsData, templateData, decodeRulesData, planRows, notificationRows, subscriptionRows] = await Promise.all([
        canViewDashboard ? apiFetch(`/api/dashboard/summary?range=${range}`) : Promise.resolve({}),
        canViewQuotations ? apiFetch("/api/quotations").catch(() => []) : Promise.resolve([]),
        canViewProducts ? apiFetch("/api/products").catch(() => []) : Promise.resolve([]),
        canViewCustomers ? apiFetch("/api/customers").catch(() => []) : Promise.resolve([]),
        apiFetch("/api/roles"),
        canViewUsers ? apiFetch("/api/users").catch(() => []) : Promise.resolve([]),
        shouldLoadApprovals ? apiFetch("/api/quotations/approvals").catch(() => []) : Promise.resolve([]),
        shouldLoadTemplateData ? apiFetch("/api/quotations/templates/current").catch(() => null) : Promise.resolve(null),
        shouldLoadTemplateData ? apiFetch("/api/whatsapp/decode-rules").catch(() => null) : Promise.resolve(null),
        isPlatformAdmin ? apiFetch("/api/plans").catch(() => []) : Promise.resolve([]),
        canViewNotifications ? apiFetch("/api/notifications").catch(() => []) : Promise.resolve([]),
        canViewSubscriptions ? apiFetch("/api/subscriptions").catch(() => []) : Promise.resolve([])
      ]);

      setDashboardData(summary);
      setQuotations(quotationRows);
      setProducts(productRows);
      setCustomers(customerRows);
      setRoles(rolesData);
      setUsers(usersData);
      setApprovals(shouldLoadApprovals && Array.isArray(approvalsData) ? approvalsData : []);
      setPlans(Array.isArray(planRows) ? planRows : []);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      setSubscriptions(Array.isArray(subscriptionRows) ? subscriptionRows : []);
      if (shouldLoadSellerScopedData && templateData) {
        setQuotationTemplate((prev) => ({
          ...prev,
          template_preset: "default",
          template_theme_key: templateData.template_theme_key || prev.template_theme_key || "default",
          ...templateData
        }));
      }
      if (shouldLoadSellerScopedData && decodeRulesData) setDecodeRules(decodeRulesData);

      if (!userForm.roleId && rolesData[0]) {
        setUserForm((prev) => ({ ...prev, roleId: String(rolesData[0].id) }));
      }

      if (shouldLoadApprovals) {
        const nextSelectedApprovalId = selectedApprovalId && Array.isArray(approvalsData) && approvalsData.some((approval) => Number(approval.id) === Number(selectedApprovalId))
          ? selectedApprovalId
          : approvalsData?.[0]?.id || "";
        setSelectedApprovalId(String(nextSelectedApprovalId || ""));
        if (nextSelectedApprovalId) {
          const detail = await apiFetch(`/api/quotations/approvals/${nextSelectedApprovalId}`).catch(() => null);
          setSelectedApprovalDetail(detail);
        } else {
          setSelectedApprovalDetail(null);
        }
      } else {
        setSelectedApprovalId("");
        setSelectedApprovalDetail(null);
      }

      if (shouldLoadTemplateData) {
        await loadSellerSettings();
      } else {
        setSellerSetupStatus(null);
      }
      if (isPlatformAdmin) {
        await loadAdminData();
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    verifySession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (auth?.token && authReady) {
      loadDashboardData(dashboardRange);
    }
  }, [auth?.token, authReady, dashboardRange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isPlatformAdmin || activeModule !== "Leads") return;
    if (selectedLeadId) return;
    if (!leads.length) return;
    openLeadDetail(leads[0].id);
  }, [activeModule, isPlatformAdmin, leads, selectedLeadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!auth?.token || isPlatformAdmin) return;
    if (!["Products", "Dashboard", "Configuration Studio", "Subscriptions"].includes(activeModule)) return;
    refreshCurrentSellerConfiguration();
  }, [activeModule, auth?.token, isPlatformAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSellerPage(1);
  }, [sellerSearch]);

  useEffect(() => {
    setOrderPage(1);
  }, [search]);

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!currentModules.includes(activeModule)) {
      setActiveModule("Dashboard");
    }
  }, [activeModule, currentModules]);

  useEffect(() => {
    if (isPlatformAdmin || isSubUser || !setupAllowedModules) return;
    if (setupAllowedModules.has(activeModule)) return;
    if (sellerSetupStage === "settings") {
      setActiveModule("Settings");
      return;
    }
    if (sellerSetupStage === "configuration") {
      setActiveModule("Configuration Studio");
    }
  }, [activeModule, isPlatformAdmin, isSubUser, sellerSetupStage, setupAllowedModules]);

  useEffect(() => {
    if (!isSubUser) {
      setSubUserAction("");
      setSubUserSearchInput("");
    }
  }, [isSubUser]);

  const chartSeries = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const totals = Array(7).fill(0);

    quotations.forEach((quotation) => {
      const day = new Date(quotation.created_at).getDay();
      const idx = day === 0 ? 6 : day - 1;
      totals[idx] += Number(quotation.total_amount || 0);
    });

    const maxValue = Math.max(...totals, 1);
    return labels.map((label, index) => ({
      label,
      value: totals[index],
      height: Math.max(12, Math.round((totals[index] / maxValue) * 100))
    }));
  }, [quotations]);

  const lowStockItems = useMemo(() => {
    return products
      .map((product) => ({
        id: product.id,
        name: product.material_name,
        stock: (product.id * 7) % 28
      }))
      .filter((item) => item.stock < 12)
      .slice(0, 5);
  }, [products]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = quotations.filter((row) => {
      if (!term) return true;
      return (
        String(getVisibleQuotationNumber(row) || "").toLowerCase().includes(term) ||
        String(row.customer_name || "").toLowerCase().includes(term) ||
        String(row.firm_name || "").toLowerCase().includes(term) ||
        String(row.mobile || "").toLowerCase().includes(term)
      );
    });

    const { key, direction } = orderSort;
    return rows.sort((a, b) => {
      const va = a[key] ?? "";
      const vb = b[key] ?? "";

      if (key === "total_amount") {
        return direction === "asc" ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }

      if (key === "created_at") {
        return direction === "asc" ? new Date(va).getTime() - new Date(vb).getTime() : new Date(vb).getTime() - new Date(va).getTime();
      }

      return direction === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
  }, [quotations, search, orderSort]);

  const topSearchSuggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];

    return quotations
      .filter((row) =>
        [
          getVisibleQuotationNumber(row),
          row.customer_name,
          row.firm_name,
          row.mobile
        ].some((value) => String(value || "").toLowerCase().includes(term))
      )
      .slice(0, 6);
  }, [quotations, search]);

  const subUserQuotationResults = useMemo(() => {
    const term = subUserSearchInput.trim().toLowerCase();
    if (!term) return [];

    return quotations
      .filter((row) =>
        [
          getVisibleQuotationNumber(row),
          row.customer_name,
          row.firm_name,
          row.mobile
        ].some((value) => String(value || "").toLowerCase().includes(term))
      )
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [quotations, subUserSearchInput]);

  const filteredSellers = useMemo(() => {
    const term = sellerSearch.trim().toLowerCase();
    if (!term) return sellers;
    return sellers.filter((sellerRow) =>
      [
        sellerRow.name,
        sellerRow.business_name,
        sellerRow.mobile,
        sellerRow.email,
        sellerRow.seller_code,
        sellerRow.plan_name,
        sellerRow.subscription_plan,
        sellerRow.status
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [sellerSearch, sellers]);

  const filteredPlans = useMemo(() => {
    const term = planSearch.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((plan) =>
      [
        plan.plan_name,
        plan.plan_code,
        plan.billing_cycle,
        plan.is_demo_plan ? "demo" : "standard",
        plan.is_active ? "active" : "inactive"
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [planSearch, plans]);

  const filteredSubscriptions = useMemo(() => {
    const term = subscriptionSearch.trim().toLowerCase();
    if (!term) return subscriptions;
    return subscriptions.filter((subscription) =>
      [
        subscription.seller_name,
        subscription.seller_code,
        subscription.plan_name,
        subscription.plan_code,
        subscription.status
      ].some((value) => String(value || "").toLowerCase().includes(term))
    );
  }, [subscriptionSearch, subscriptions]);

  const currentSellerSubscription = useMemo(() => {
    return (subscriptions || []).find((subscription) => String(subscription.status || "").toLowerCase() === "active")
      || (subscriptions || []).find((subscription) => String(subscription.status || "").toLowerCase() === "trial")
      || null;
  }, [subscriptions]);

  const {
    selectedSellerConfigSeller,
    sellerConfigTab,
    setSellerConfigTab,
    sellerConfigPreviewTab,
    setSellerConfigPreviewTab,
    sellerConfigLoading,
    sellerConfigSaving,
    sellerConfigPublishing,
    configurationStudioSeller,
    activeSellerConfiguration,
    openSellerConfigurationStudio,
    closeSellerConfigurationStudio,
    saveSellerConfigurationDraft,
    publishSellerConfiguration,
    addCatalogueField,
    updateCatalogueField,
    commitCatalogueFieldOptions,
    removeCatalogueField,
    addQuotationColumn,
    updateQuotationColumn,
    commitQuotationColumnOptions,
    removeQuotationColumn,
    updateSellerConfigurationModule,
    updateItemDisplayConfig
  } = useSellerConfigurationStudio({
    isPlatformAdmin,
    seller,
    setActiveModule,
    createDefaultSellerConfiguration,
    mapSellerConfigurationResponse,
    apiFetch,
    handleApiError,
    setCurrentSellerConfiguration,
    setError,
    refreshSellerSetupStatus,
    parseOptionsInput
  });

  const runtimeSellerConfiguration = useMemo(
    () => mapSellerConfigurationResponse(currentSellerConfiguration, seller),
    [currentSellerConfiguration, seller]
  );
  useEffect(() => {
    if (activeModule !== "Configuration Studio" || isPlatformAdmin || !seller?.id) return;
    if (selectedSellerConfigSeller?.id === seller.id) return;
    openSellerConfigurationStudio(seller);
  }, [activeModule, isPlatformAdmin, seller?.id, selectedSellerConfigSeller?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const runtimeCatalogueFields = useMemo(
    () => sortConfigEntries(getSupportedCatalogueFields(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const unsupportedRuntimeCatalogueFields = useMemo(
    () => sortConfigEntries(getUnsupportedCatalogueFields(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const visibleCatalogueTableFields = useMemo(
    () => [...runtimeCatalogueFields, ...unsupportedRuntimeCatalogueFields].filter((field) => field.visibleInList),
    [runtimeCatalogueFields, unsupportedRuntimeCatalogueFields]
  );
  const runtimeQuotationColumns = useMemo(
    () => sortConfigEntries(getSupportedQuotationColumns(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const unsupportedRuntimeQuotationColumns = useMemo(
    () => sortConfigEntries(getUnsupportedQuotationColumns(runtimeSellerConfiguration)),
    [runtimeSellerConfiguration]
  );
  const orderDetailColumns = useMemo(() => {
    const merged = [...runtimeQuotationColumns, ...unsupportedRuntimeQuotationColumns]
      .map((column) => ({
        ...column,
        key: normalizeConfigKey(column?.key)
      }))
      .filter((column) => column.key);

    const columns = [];
    const seen = new Set();

    merged.forEach((column) => {
      if (seen.has(column.key)) return;
      const shouldInclude = Boolean(column.visibleInForm) || ["material_name", "quantity", "rate", "amount"].includes(column.key);
      if (!shouldInclude) return;
      seen.add(column.key);
      columns.push(column);
    });

    const ensureColumn = (key, label, type = "text") => {
      if (seen.has(key)) return;
      seen.add(key);
      columns.push({ key, label, type, visibleInForm: key !== "amount" });
    };

    ensureColumn("material_name", "Product");
    ensureColumn("quantity", "Qty", "number");
    ensureColumn("rate", "Rate", "number");
    ensureColumn("amount", "Amount", "formula");

    return columns;
  }, [runtimeQuotationColumns, unsupportedRuntimeQuotationColumns]);
  const aiSuggestions = useMemo(() => {
    const pending = Number(dashboardData?.pendingOverall || 0);
    const walkin = Number(dashboardData?.totals?.walk_in_sales || 0);

    return [
      pending > 100000
        ? "Pending receivables are high. Prioritize follow-up on top 5 outstanding accounts today."
        : "Receivables are under control. Keep a 2-day payment reminder cadence.",
      walkin > 10000
        ? "Walk-in traffic is strong. Bundle quick-cut SKUs near checkout for upsell."
        : "Run a same-day offer on laser cutting to improve walk-in conversion.",
      lowStockItems.length > 0
        ? `Restock ${lowStockItems[0]?.name} and ${lowStockItems[1]?.name || "priority SKUs"} before weekend demand.`
        : "Inventory looks healthy. Keep reorder thresholds unchanged this week."
    ];
  }, [dashboardData, lowStockItems]);

  const topSelling = useMemo(() => {
    return (dashboardData?.salesByCategory || []).slice(0, 4);
  }, [dashboardData]);

  const pagedOrders = useMemo(() => filteredOrders.slice((orderPage - 1) * PAGE_SIZE, orderPage * PAGE_SIZE), [filteredOrders, orderPage]);
  const pagedSellers = useMemo(() => filteredSellers.slice((sellerPage - 1) * PAGE_SIZE, sellerPage * PAGE_SIZE), [filteredSellers, sellerPage]);
  const pagedCustomers = useMemo(() => customers.slice((customerPage - 1) * PAGE_SIZE, customerPage * PAGE_SIZE), [customers, customerPage]);
  const filteredProducts = useMemo(() => {
    if (productSourceFilter === "all") return products;
    return products.filter((product) => String(product.catalogue_source || "primary").toLowerCase() === productSourceFilter);
  }, [products, productSourceFilter]);
  const pagedProducts = useMemo(() => filteredProducts.slice((productPage - 1) * PAGE_SIZE, productPage * PAGE_SIZE), [filteredProducts, productPage]);
  const pagedUsers = useMemo(() => users.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE), [users, userPage]);
  const unreadNotificationsCount = useMemo(() => {
    if (isPlatformAdmin) {
      return notifications.reduce((sum, notification) => sum + Number(notification.unread_count || 0), 0);
    }
    return notifications.reduce((sum, notification) => {
      return sum + (String(notification.delivery_status || "").toLowerCase() === "read" ? 0 : 1);
    }, 0);
  }, [isPlatformAdmin, notifications]);
  const pendingApprovalCount = useMemo(() => (
    approvals.filter((entry) => String(entry.status || "").toLowerCase() === "pending").length
  ), [approvals]);
  const requesterPendingApprovalCount = useMemo(() => (
    approvals.filter((entry) => String(entry.status || "").toLowerCase() === "pending" && Number(entry.requested_by_user_id || 0) === Number(auth?.user?.id || 0)).length
  ), [approvals, auth?.user?.id]);

  async function refreshQuotationList() {
    const quotationRows = await apiFetch("/api/quotations");
    setQuotations(quotationRows);
    return quotationRows;
  }

  useEffect(() => {
    setProductPage(1);
  }, [productSourceFilter]);

  const {
    showMessageSimulatorModal,
    quotationWizard,
    setQuotationWizard,
    quotationWizardSubmitting,
    quotationPreviewUrl,
    quotationPreviewError,
    quotationWizardNotice,
    quotationWizardCustomerGstValidation,
    quotationWizardShippingGstValidation,
    quotationWizardCustomerMatches,
    quotationWizardSelectedProduct,
    quotationWizardMaterialSuggestions,
    quotationWizardVisibleVariantFields,
    quotationWizardItemRules,
    quotationWizardItemReady,
    quotationWizardGrossTotal,
    quotationWizardGstAmount,
    quotationWizardTotalAmount,
    quotationWizardDiscountAmount,
    quotationWizardAdvanceAmount,
    quotationWizardBalanceAmount,
    quotationWizardGstMode,
    openQuotationWizard,
    closeQuotationWizard,
    updateQuotationWizardCustomerField,
    validateQuotationWizardCustomerGst,
    validateQuotationWizardShippingGst,
    updateQuotationWizardShippingAddress,
    addQuotationWizardShippingAddress,
    removeQuotationWizardShippingAddress,
    updateQuotationWizardItemForm,
    updateQuotationWizardCustomField,
    handleQuotationWizardMaterialInput,
    handleQuotationWizardMaterialSelect,
    handleQuotationWizardVariantSelection,
    handleSaveQuotationWizardSecondaryProduct,
    handleAddQuotationWizardItem,
    startEditQuotationWizardItem,
    cancelEditQuotationWizardItem,
    handleRemoveQuotationWizardItem,
    handleQuotationWizardNext,
    handleQuotationWizardBack,
    handleSubmitQuotationWizard,
    downloadQuotationWizardPdf,
    showQuotationWizardNotice
  } = useQuotationWizard({
    auth,
    products,
    customers,
    runtimeCatalogueFields,
    unsupportedRuntimeCatalogueFields,
    unsupportedRuntimeQuotationColumns,
    createInitialQuotationWizardState,
    createQuotationWizardItem,
    getCatalogueDrivenQuotationCustomFields,
    getCustomQuotationValidationError,
    getQuotationWizardRules,
    validateQuotationWizardItem,
    calculateQuotationWizardItemTotal,
    toQuotationWizardAmount,
    buildQuotationWizardPayloadItems,
    itemDisplayConfig: runtimeSellerConfiguration.itemDisplayConfig,
    getQuotationRateValidationMessage,
    apiFetch,
    setCustomers,
    setProducts,
    refreshQuotationList,
    loadDashboardData,
    dashboardRange,
    handleOpenOrderDetails,
    handleApiError,
    setError
  });

  function openQuotationWizardWithSetupGuard(initialState = null) {
    if (isPlatformAdmin || sellerSetupStatus?.quotationUnlocked !== false) {
      openQuotationWizard(initialState);
      return;
    }

    if (sellerSetupStage === "settings") {
      setError("Complete mandatory business settings before creating quotations.");
      setActiveModule("Settings");
      return;
    }

    if (sellerSetupStage === "configuration") {
      setError("Complete Configuration Studio setup before creating quotations.");
      setActiveModule("Configuration Studio");
      return;
    }

    openQuotationWizard(initialState);
  }

  const previewQuotationNumber = `${(quotationNumberPrefix || "QTN").trim() || "QTN"}-0001`;

  const quotationPreview = {
    quotation_number: previewQuotationNumber,
    customer_name: "Wanex Industries",
    customer_mobile: "9876543210",
    total_amount: "1,24,500",
    delivery_date: "2026-03-20",
    delivery_type: "DOORSTEP",
    delivery_address: "A903 The Orient",
    delivery_pincode: "410218"
  };

  const selectedVersionRecord = orderVersions.find((version) => String(version.id) === String(selectedVersionId)) || orderVersions[0] || null;
  const displayedQuotation = selectedVersionRecord?.quotation_snapshot || selectedOrderDetails?.quotation || null;
  const baseDisplayedItems = selectedVersionRecord?.items_snapshot || selectedOrderDetails?.items || [];
  const catalogueFields = activeSellerConfiguration?.catalogueFields || [];
  const displayedItems = baseDisplayedItems.map((item) => {
    const product = products.find((entry) => Number(entry.id) === Number(item.product_id));
    if (!product || !catalogueFields.length) return item;
    const mergedCustomFields = getCatalogueDrivenQuotationCustomFields(
      product,
      catalogueFields,
      item.custom_fields || item.customFields || {}
    );
    return {
      ...item,
      custom_fields: mergedCustomFields,
      customFields: mergedCustomFields
    };
  });
  const selectedVersionIndex = selectedVersionRecord ? orderVersions.findIndex((version) => version.id === selectedVersionRecord.id) : -1;
  const previousVersionRecord = selectedVersionIndex >= 0 ? orderVersions[selectedVersionIndex + 1] || null : null;
  const comparisonQuotation = previousVersionRecord?.quotation_snapshot || null;
  const comparisonItems = previousVersionRecord?.items_snapshot || [];
  const shouldShowVersionSelector = Number(selectedOrderDetails?.quotation?.version_no || 1) > 1 || (orderVersions || []).length > 1;
  const isAnyModalOpen = Boolean(
    showSellerCreateModal ||
    showPlanCreateModal ||
    showNotificationCreateModal ||
    showUserModal ||
    showUserEditModal ||
    showMessageSimulatorModal ||
    showCustomerModal ||
    showProductUploadModal ||
    showSingleProductModal ||
    showProductPreviewModal ||
    showSellerDetailModal ||
    showSubscriptionModal ||
    showPlanDetailModal ||
    showNotificationDetailModal ||
    showSellerNotificationsModal ||
    showLeadDetailModal ||
    showLeadConvertModal
  );

  function quotationFieldChanged(field) {
    if (!displayedQuotation || !comparisonQuotation) return false;
    return normalizeForCompare(displayedQuotation[field]) !== normalizeForCompare(comparisonQuotation[field]);
  }

  function quotationItemFieldChanged(item, index, field) {
    const previousItem = comparisonItems[index];
    if (!item || !previousItem) return false;
    return normalizeForCompare(item[field]) !== normalizeForCompare(previousItem[field]);
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setAuthNotice("");
    try {
      const result = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ ...loginForm, rememberMe })
      });
      saveAuth({ token: result.token, user: result.user, sessionExpiresAt: result.expiresAt || null }, rememberMe);
      setLoginForm({ mobile: "", password: "", otp: "" });
      setBootstrapRequired(false);
      setAuthReady(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleBootstrapAdmin(event) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/auth/bootstrap-admin", {
        method: "POST",
        body: JSON.stringify(setupForm)
      });
      setSetupForm({ name: "", mobile: "", password: "" });
      setBootstrapRequired(false);
      setError("Platform admin created. Please login.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore logout failures and clear local auth state.
    }
    clearAuth();
    setAuthReady(true);
  }

  function handleSubUserQuotationSearch() {
    setSubUserAction("search");
  }

  function handleHeaderSearchSelect(quotationId) {
    setActiveModule("Orders");
    setSearch("");
    handleOpenOrderDetails(quotationId);
  }

  async function handleSeedRoles() {
    try {
      await apiFetch("/api/roles/seed", { method: "POST" });
      const roleRows = await apiFetch("/api/roles");
      setRoles(roleRows);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    setError("");
    setUserFormErrors({});

    if (!canCreateUser) {
      setError("You do not have permission to create users.");
      return;
    }

    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: userForm.name,
          mobile: userForm.mobile,
          password: userForm.password,
          roleId: Number(userForm.roleId),
          createdBy: userForm.createdBy ? Number(userForm.createdBy) : null,
          status: Boolean(userForm.status),
          approvalMode: userForm.approvalMode,
          approvalLimitAmount: userForm.approvalLimitAmount === "" ? 0 : Number(userForm.approvalLimitAmount),
          canApproveQuotations: Boolean(userForm.canApproveQuotations),
          canApprovePriceException: Boolean(userForm.canApprovePriceException),
          approverUserId: userForm.approverUserId ? Number(userForm.approverUserId) : null,
          requesterUserIds: userForm.requesterUserIds
        })
      });

      const usersData = await apiFetch("/api/users");
      setUsers(usersData);
      setUserForm(createInitialUserForm());
      setUserFormErrors({});
      setShowUserModal(false);
    } catch (err) {
      if (err?.field === "mobile") {
        setUserFormErrors({ mobile: err.message || "Invalid mobile number" });
        return;
      }
      handleApiError(err);
    }
  }

  function handleOpenEditUser(user) {
    if (!user || !canEditUser) return;

    setError("");
    setShowUserModal(false);
    setUserFormErrors({});
    setEditingUser(user);
    setUserForm({
      name: user.name || "",
      mobile: user.mobile || "",
      password: "",
      roleId: user.role_id ? String(user.role_id) : "",
      createdBy: user.created_by ? String(user.created_by) : "",
      status: Boolean(user.status),
      approvalMode: String(user.approval_mode || "requester"),
      approvalLimitAmount: Number(user.approval_limit_amount || 0),
      canApproveQuotations: Boolean(user.can_approve_quotations),
      canApprovePriceException: Boolean(user.can_approve_price_exception),
      approverUserId: user.assigned_approver?.id ? String(user.assigned_approver.id) : "",
      requesterUserIds: Array.isArray(user.assigned_requesters)
        ? user.assigned_requesters.map((entry) => Number(entry.id)).filter((entry) => Number.isInteger(entry) && entry > 0)
        : []
    });
    setShowUserEditModal(true);
  }

  function handleCloseEditUser() {
    setShowUserEditModal(false);
    setEditingUser(null);
    setUserFormErrors({});
    setUserForm(createInitialUserForm());
  }

  async function handleUpdateUser(event) {
    event.preventDefault();
    setError("");

    if (!canEditUser) {
      setError("You do not have permission to edit users.");
      return;
    }
    if (!editingUser?.id) {
      setError("Select a user to edit.");
      return;
    }

    try {
      await apiFetch(`/api/users/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: userForm.name,
          roleId: Number(userForm.roleId),
          status: Boolean(userForm.status),
          approvalMode: userForm.approvalMode,
          approvalLimitAmount: userForm.approvalLimitAmount === "" ? 0 : Number(userForm.approvalLimitAmount),
          canApproveQuotations: Boolean(userForm.canApproveQuotations),
          canApprovePriceException: Boolean(userForm.canApprovePriceException),
          approverUserId: userForm.approverUserId ? Number(userForm.approverUserId) : null,
          requesterUserIds: userForm.requesterUserIds
        })
      });

      const usersData = await apiFetch("/api/users");
      setUsers(usersData);
      handleCloseEditUser();
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleLockToggle(user) {
    try {
      await apiFetch(`/api/users/${user.id}/lock`, {
        method: "PATCH",
        body: JSON.stringify({ locked: !user.locked })
      });
      const usersData = await apiFetch("/api/users");
      setUsers(usersData);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleResetUserPassword(user) {
    const newPassword = window.prompt(`Set a new password for ${user.name}. It must include uppercase, lowercase, number, and special character.`);
    if (!newPassword) return;

    const confirmPassword = window.prompt(`Confirm the new password for ${user.name}.`);
    if (confirmPassword !== newPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    try {
      const response = await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword })
      });

      window.alert(`Password updated for ${response.user.name}. Existing sessions were signed out.`);
      setError(response.message || `Password updated for ${response.user.name}.`);
    } catch (err) {
      handleApiError(err);
    }
  }

  function openCreateCustomerModal() {
    setEditingCustomerId(null);
    setCustomerForm(createInitialCustomerForm());
    setCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
    setCustomerShippingGstValidation({});
    setShowCustomerModal(true);
  }

  function handleEditCustomer(customer) {
    if (!customer || !canEditCustomer) return;
    const shippingAddresses = Array.isArray(customer.shipping_addresses) && customer.shipping_addresses.length
      ? customer.shipping_addresses.map((entry) => ({
          label: String(entry?.label || ""),
          address: String(entry?.address || ""),
          state: String(entry?.state || ""),
          pincode: String(entry?.pincode || ""),
          gstNumber: String(entry?.gstNumber || "").toUpperCase()
        }))
      : [createEmptyShippingAddress()];

    setEditingCustomerId(customer.id);
    setCustomerForm({
      name: customer.name || "",
      firmName: customer.firm_name || "",
      mobile: customer.mobile || "",
      email: customer.email || "",
      address: customer.address || "",
      gstNumber: customer.gst_number || "",
      monthlyBilling: Boolean(customer.monthly_billing),
      shippingAddresses
    });
    setCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
    setCustomerShippingGstValidation({});
    setShowCustomerModal(true);
  }

  async function handleCreateCustomer(event) {
    event.preventDefault();
    setError("");

    if (editingCustomerId ? !canEditCustomer : !canCreateCustomer) {
      setError(editingCustomerId ? "You do not have permission to edit customers." : "You do not have permission to create customers.");
      return;
    }

    try {
      await apiFetch(editingCustomerId ? `/api/customers/${editingCustomerId}` : "/api/customers", {
        method: editingCustomerId ? "PATCH" : "POST",
        body: JSON.stringify(customerForm)
      });

      const customerRows = await apiFetch("/api/customers");
      setCustomers(customerRows);
      setCustomerForm(createInitialCustomerForm());
      setEditingCustomerId(null);
      setCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
      setCustomerShippingGstValidation({});
      setShowCustomerModal(false);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function validateCustomerGstForForm(rawGstNumber) {
    const gstNumber = String(rawGstNumber || "").trim().toUpperCase();
    if (!gstNumber) {
      setCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
      return null;
    }

    setCustomerGstValidation({ status: "verifying", gstNumber, profile: null, message: "" });
    try {
      const response = await apiFetch("/api/customers/gst/validate", {
        method: "POST",
        body: JSON.stringify({ gstNumber })
      });
      const profile = response.profile || null;
      if (profile) {
        setCustomerForm((prev) => ({
          ...prev,
          name: profile.legalName || prev.name,
          firmName: profile.tradeName || profile.legalName || prev.firmName,
          address: profile.address || prev.address,
          gstNumber
        }));
      }
      setCustomerGstValidation({
        status: "verified",
        gstNumber,
        profile,
        message: "GST verified. Legal name and address auto-filled."
      });
      return profile;
    } catch (err) {
      const errorMessage = err?.message || "Unable to validate GST number.";
      setCustomerGstValidation({ status: "error", gstNumber, profile: null, message: errorMessage });
      throw err;
    }
  }

  async function handleBulkProductUpload(event) {
    event.preventDefault();
    setError("");
    setProductUploadModalMessage("");

    try {
      const rows = validateProductRows(parseProductTextRows(productUploadText));

      if (rows.length === 0) {
        throw new Error("Please add at least one product row.");
      }
      setProductPreviewRows(rows);
      setShowProductPreviewModal(true);
    } catch (err) {
      setProductUploadModalMessage(err.message || "Something went wrong");
    }
  }

  function handleCustomerShippingAddressChange(index, field, value) {
    setCustomerForm((prev) => ({
      ...prev,
      shippingAddresses: updateShippingAddressValue(prev.shippingAddresses, index, field, value)
    }));
    if (field === "gstNumber") {
      setCustomerShippingGstValidation((prev) => ({
        ...prev,
        [index]: { status: "idle", message: "" }
      }));
    }
  }

  function handleAddCustomerShippingAddress() {
    setCustomerForm((prev) => ({
      ...prev,
      shippingAddresses: [...applyShippingAddressGstReuse(prev.shippingAddresses), createEmptyShippingAddress()]
    }));
  }

  function handleRemoveCustomerShippingAddress(index) {
    setCustomerForm((prev) => {
      const nextAddresses = (prev.shippingAddresses || []).filter((_, entryIndex) => entryIndex !== index);
      return {
        ...prev,
        shippingAddresses: nextAddresses.length ? applyShippingAddressGstReuse(nextAddresses) : [createEmptyShippingAddress()]
      };
    });
  }

  function closeCustomerModal() {
    setShowCustomerModal(false);
    setEditingCustomerId(null);
    setCustomerForm(createInitialCustomerForm());
    setCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
    setCustomerShippingGstValidation({});
  }

  async function validateCustomerShippingGst(index, rawGstNumber) {
    const gstNumber = String(rawGstNumber || "").trim().toUpperCase();
    if (!gstNumber) {
      setCustomerShippingGstValidation((prev) => ({ ...prev, [index]: { status: "idle", message: "" } }));
      return;
    }
    setCustomerShippingGstValidation((prev) => ({ ...prev, [index]: { status: "verifying", message: "" } }));
    try {
      await apiFetch("/api/customers/gst/validate", {
        method: "POST",
        body: JSON.stringify({ gstNumber })
      });
      setCustomerShippingGstValidation((prev) => ({ ...prev, [index]: { status: "verified", message: "GST verified." } }));
    } catch (err) {
      setCustomerShippingGstValidation((prev) => ({
        ...prev,
        [index]: { status: "error", message: err?.message || "Invalid GST number." }
      }));
      throw err;
    }
  }

  async function handleCreateSingleProduct(event) {
    event.preventDefault();
    setError("");

    if (editingProductId ? !canEditProduct : !canCreateProduct) {
      setError(editingProductId ? "You do not have permission to edit products." : "You do not have permission to create products.");
      return;
    }

    try {
      const missingRuntimeField = runtimeCatalogueFields.find((field) => {
        if (!field.meta?.required) return false;
        const value = singleProductForm[field.meta.formKey];
        return value === undefined || value === null || String(value).trim() === "";
      });
      if (missingRuntimeField) {
        throw new Error(`${missingRuntimeField.label} is required.`);
      }

      const customFieldError = getCustomProductValidationError(
        unsupportedRuntimeCatalogueFields,
        singleProductForm.customFields
      );

      if (customFieldError) {
        throw new Error(customFieldError);
      }

      const parsedDiscountLimit = parseMaxDiscountLimit(singleProductForm.maxDiscountPercent);
      if (String(singleProductForm.maxDiscountPercent || "").trim() && !parsedDiscountLimit.isValid) {
        throw new Error("Max Discount Limit must be a number or percentage like 10%.");
      }

      const payload = {
        materialName: singleProductForm.materialName,
        category: singleProductForm.category,
        thickness: singleProductForm.thickness || null,
        unitType: singleProductForm.unitType,
        basePrice: Number(singleProductForm.basePrice || 0),
        limitRateEdit: Boolean(singleProductForm.limitRateEdit),
        maxDiscountPercent: parsedDiscountLimit.value,
        maxDiscountType: parsedDiscountLimit.type,
        sku: singleProductForm.sku || null,
        alwaysAvailable: Boolean(singleProductForm.alwaysAvailable),
        materialGroup: singleProductForm.materialGroup || null,
        colorName: singleProductForm.colorName || null,
        psSupported: Boolean(singleProductForm.psSupported),
        pricingType: singleProductForm.pricingType || "SFT",
        customFields: singleProductForm.customFields || {}
      };

      await apiFetch(editingProductId ? `/api/products/${editingProductId}` : "/api/products", {
        method: editingProductId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...payload
        })
      });

      const productRows = await apiFetch("/api/products");
      setProducts(productRows);
      setSingleProductForm(createInitialSingleProductForm());
      setEditingProductId(null);
      setShowSingleProductModal(false);
      setError(editingProductId ? "Product updated successfully." : "Single product created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function handleEditProduct(product) {
    if (!canEditProduct) {
      setError("You do not have permission to edit products.");
      return;
    }
    const nextForm = createInitialSingleProductForm();
    runtimeCatalogueFields.forEach((field) => {
      if (field?.meta?.formKey) {
        nextForm[field.meta.formKey] = getProductConfigurationFieldValue(product, field.key);
      }
    });
    const nextCustomFields = { ...(product.custom_fields || {}) };
    unsupportedRuntimeCatalogueFields.forEach((field) => {
      nextCustomFields[field.key] = getProductConfigurationFieldValue(product, field.key);
    });
    setEditingProductId(product.id);
    setSingleProductForm({
      ...nextForm,
      customFields: nextCustomFields
    });
    setShowSingleProductModal(true);
  }

  function updateSingleProductField(field, value) {
    setSingleProductForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function updateSingleProductCustomField(fieldKey, value) {
    setSingleProductForm((prev) => ({
      ...prev,
      customFields: {
        ...(prev.customFields || {}),
        [fieldKey]: value
      }
    }));
  }

  async function handleMoveProductToPrimary(product) {
    try {
      if (!canEditProduct) {
        throw new Error("You do not have permission to move products.");
      }
      if (!product?.id) {
        throw new Error("Product not found.");
      }
      if (String(product.catalogue_source || "primary").toLowerCase() === "primary") {
        setError("This product is already in main catalogue.");
        return;
      }

      await apiFetch(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          catalogueSource: "primary"
        })
      });

      const productRows = await apiFetch("/api/products");
      setProducts(productRows);
      setError("Product moved from secondary to main catalogue.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleExcelProductUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProductUploadModalMessage("");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" }).filter(rowHasExcelContent);
      const rows = validateProductRowsWithConfiguration(
        rawRows
          .map((row) => mapProductRowWithConfiguration(row, runtimeCatalogueFields, unsupportedRuntimeCatalogueFields))
          .filter((row) => rowHasExcelContent(row) || Object.keys(row.customFields || {}).length > 0),
        unsupportedRuntimeCatalogueFields,
        runtimeCatalogueFields
      );

      if (rows.length === 0) {
        throw new Error("No product rows were detected in the Excel file. Please fill at least one row under the template headers.");
      }
      setProductPreviewRows(rows);
      setShowProductPreviewModal(true);
    } catch (err) {
      setProductUploadModalMessage(err.message || "Something went wrong");
    } finally {
      event.target.value = "";
    }
  }

  async function handleConfirmProductUpload() {
    try {
      setProductUploadModalMessage("");
      const validRows = productPreviewRows.filter((row) => row.materialName && row.issues.length === 0);
      if (validRows.length === 0) {
        throw new Error("No valid product rows available for upload.");
      }

      await apiFetch("/api/products/bulk", {
        method: "POST",
        body: JSON.stringify({
          products: validRows.map((row) => ({
            materialName: row.materialName,
            category: row.category,
            thickness: row.thickness,
            unitType: row.unitType,
            basePrice: row.basePrice,
            sku: row.sku,
            alwaysAvailable: row.alwaysAvailable,
            materialGroup: row.materialGroup,
            colorName: row.colorName,
            psSupported: row.psSupported,
            pricingType: row.pricingType,
            customFields: row.customFields || {}
          }))
        })
      });

      const productRows = await apiFetch("/api/products");
      setProducts(productRows);
      setProductUploadText("");
      setProductPreviewRows([]);
      setShowProductPreviewModal(false);
      setProductUploadModalMessage("");
      setError(`Uploaded ${validRows.length} products successfully.`);
    } catch (err) {
      setProductUploadModalMessage(err.message || "Something went wrong");
    }
  }

  function handleDownloadProductTemplate() {
    const templateColumns = [
      ...runtimeCatalogueFields.filter((field) => field.uploadEnabled),
      ...unsupportedRuntimeCatalogueFields.filter((field) => field.uploadEnabled)
    ];
    const sampleRow = {};

    templateColumns.forEach((field) => {
      const headerLabel = field.label || field.normalizedKey || field.key;
      sampleRow[headerLabel] = getProductTemplateSampleValue(field.normalizedKey || field.key, field.label);
    });

    const validationRows = templateColumns.map((field) => ({
      field_label: field.label || field.normalizedKey || field.key,
      field_key: field.key || field.normalizedKey,
      required: field.required ? "Yes" : "No",
      data_type: field.type || "text",
      allowed_options: getConfiguredOptions(field).join(", ")
    }));

    const worksheet = XLSX.utils.json_to_sheet([sampleRow], { header: Object.keys(sampleRow) });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(validationRows), "Validation Rules");
    XLSX.writeFile(workbook, "billbuddy-product-template.xlsx");
  }

  async function handleSaveThemeSettings(event) {
    event.preventDefault();
    if (!canEditSettings) {
      setError("You do not have permission to edit business settings.");
      return;
    }
    try {
      const sellerSettingsRequest = apiFetch("/api/sellers/me/settings", {
        method: "PUT",
        body: JSON.stringify({
          themeKey: theme,
          brandPrimaryColor: brandColor,
          businessName,
          quotationNumberPrefix,
          sellerGstNumber,
          companyAddress: quotationTemplate.company_address,
          bankName,
          bankBranch,
          bankAccountNo,
          bankIfsc
        })
      });

      const templateSettingsRequest = apiFetch("/api/quotations/templates/current", {
        method: "PUT",
        body: JSON.stringify({
          templatePreset: quotationTemplate.template_preset,
          templateThemeKey: quotationTemplate.template_theme_key || "default",
          headerText: quotationTemplate.header_text,
          bodyTemplate: quotationTemplate.body_template,
          footerText: quotationTemplate.footer_text,
          companyPhone: quotationTemplate.company_phone,
          companyEmail: quotationTemplate.company_email,
          headerImageData: quotationTemplate.header_image_data,
          showHeaderImage: quotationTemplate.show_header_image,
          logoImageData: quotationTemplate.logo_image_data,
          showLogoOnly: quotationTemplate.show_logo_only,
          footerImageData: quotationTemplate.footer_image_data,
          showFooterImage: quotationTemplate.show_footer_image,
          accentColor: quotationTemplate.accent_color,
          notesText: quotationTemplate.notes_text,
          termsText: quotationTemplate.terms_text,
          showBankDetails: quotationTemplate.show_bank_details,
          showNotes: quotationTemplate.show_notes,
          showTerms: quotationTemplate.show_terms,
          emailEnabled: quotationTemplate.email_enabled,
          whatsappEnabled: quotationTemplate.whatsapp_enabled
        })
      });

      const [response, savedTemplate] = await Promise.all([sellerSettingsRequest, templateSettingsRequest]);
      setSeller(response.seller);
      if (savedTemplate) {
        setQuotationTemplate((prev) => ({
          ...prev,
          ...savedTemplate
        }));
      }
      await refreshSellerSetupStatus();
      setError("Settings updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreateSeller(event) {
    event.preventDefault();

    try {
      await apiFetch("/api/sellers", {
        method: "POST",
        body: JSON.stringify({
          name: sellerForm.name,
          sellerCode: sellerForm.sellerCode,
          mobile: sellerForm.mobile,
          email: sellerForm.email,
          status: sellerForm.status,
          trialEndsAt: sellerForm.trialEndsAt || null,
          subscriptionPlan: sellerForm.subscriptionPlan || "DEMO",
          maxUsers: sellerForm.maxUsers || null,
          maxOrdersPerMonth: sellerForm.maxOrdersPerMonth || null,
          isLocked: Boolean(sellerForm.isLocked),
          themeKey: sellerForm.themeKey,
          brandPrimaryColor: sellerForm.brandPrimaryColor,
          masterUser: sellerForm.masterName && sellerForm.masterMobile ? {
            name: sellerForm.masterName,
            mobile: sellerForm.masterMobile,
            password: sellerForm.masterPassword
          } : null
        })
      });

      setSellerForm({
        name: "",
        sellerCode: "",
        mobile: "",
        email: "",
        status: "pending",
        trialEndsAt: "",
        subscriptionPlan: "DEMO",
        maxUsers: "",
        maxOrdersPerMonth: "",
        isLocked: false,
        themeKey: "matte-blue",
        brandPrimaryColor: "#2563eb",
        masterName: "",
        masterMobile: "",
        masterPassword: ""
      });

      await loadAdminData();
      setShowSellerCreateModal(false);
      setError("Seller created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function getSellerLifecycleDraft(sellerRow) {
    return sellerLifecycleDrafts[sellerRow.id] || {
      status: sellerRow.status || "pending",
      trialEndsAt: sellerRow.trial_ends_at ? String(sellerRow.trial_ends_at).slice(0, 10) : "",
      subscriptionPlan: sellerRow.plan_code || sellerRow.subscription_plan || "DEMO",
      subscriptionStatus: sellerRow.subscription_status || "trial",
      subscriptionId: sellerRow.subscription_id || null,
      maxUsers: sellerRow.max_users ?? "",
      maxOrdersPerMonth: sellerRow.max_orders_per_month ?? "",
      isLocked: Boolean(sellerRow.is_locked),
      onboardingStatus: sellerRow.onboarding_status || "active",
      sellerType: String(sellerRow.seller_type || sellerRow.sellerType || "BASIC").trim().toUpperCase() === "ADVANCED" ? "ADVANCED" : "BASIC"
    };
  }

  function updateSellerLifecycleDraft(sellerId, field, value) {
    setSellerLifecycleDrafts((prev) => {
      const current = prev[sellerId] || {};
      return {
        ...prev,
        [sellerId]: {
          ...current,
          [field]: value
        }
      };
    });
  }

  function getPlanDraft(plan) {
    return planDrafts[plan.id] || {
      planCode: plan.plan_code || "",
      planName: plan.plan_name || "",
      price: String(plan.price ?? 0),
      billingCycle: plan.billing_cycle || "monthly",
      isActive: Boolean(plan.is_active),
      isDemoPlan: Boolean(plan.is_demo_plan),
      planAccessType: plan.plan_access_type || (plan.is_demo_plan ? "FREE" : "PAID"),
      templateAccessTier: plan.template_access_tier || (plan.is_demo_plan ? "FREE" : "PAID"),
      trialEnabled: Boolean(plan.trial_enabled),
      trialDurationDays: plan.trial_duration_days ? String(plan.trial_duration_days) : "",
      watermarkText: plan.watermark_text || "",
      maxUsers: plan.max_users ?? "",
      maxQuotations: plan.max_quotations ?? "",
      maxCustomers: plan.max_customers ?? "",
      inventoryEnabled: Boolean(plan.inventory_enabled),
      reportsEnabled: Boolean(plan.reports_enabled),
      gstEnabled: Boolean(plan.gst_enabled),
      exportsEnabled: Boolean(plan.exports_enabled),
      quotationWatermarkEnabled: Boolean(plan.quotation_watermark_enabled),
      quotationCreationLockedAfterExpiry: Boolean(plan.quotation_creation_locked_after_expiry)
    };
  }

  function updatePlanDraft(planId, field, value) {
    setPlanDrafts((prev) => ({
      ...prev,
      [planId]: {
        ...getPlanDraft(plans.find((plan) => plan.id === planId) || {}),
        ...(prev[planId] || {}),
        [field]: value
      }
    }));
  }

  async function handleSellerLifecycleSave(sellerId) {
    const draft = sellerLifecycleDrafts[sellerId];
    if (!draft) return;

    try {
      await apiFetch(`/api/sellers/${sellerId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({
          status: draft.status,
          trialEndsAt: draft.trialEndsAt || null,
          subscriptionPlan: draft.subscriptionPlan || null,
          maxUsers: draft.maxUsers,
          maxOrdersPerMonth: draft.maxOrdersPerMonth,
          isLocked: Boolean(draft.isLocked),
          onboardingStatus: draft.onboardingStatus || null,
          sellerType: String(draft.sellerType || "BASIC").trim().toUpperCase()
        })
      });

      if (draft.subscriptionId) {
        await apiFetch(`/api/subscriptions/${draft.subscriptionId}`, {
          method: "PATCH",
          body: JSON.stringify({
            planCode: draft.subscriptionPlan || null,
            status: draft.subscriptionStatus || null,
            trialEndAt: draft.trialEndsAt || null
          })
        });
      }

      await loadAdminData();
      setSellerLifecycleDrafts((prev) => {
        const next = { ...prev };
        delete next[sellerId];
        return next;
      });
      setError("Seller lifecycle updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleCreatePlan(event) {
    event.preventDefault();

    try {
      const response = await apiFetch("/api/plans", {
        method: "POST",
        body: JSON.stringify(planForm)
      });

      setPlans((prev) => [response.plan, ...prev]);
      setPlanForm({
        planCode: "",
        planName: "",
        price: "",
        billingCycle: "monthly",
        isActive: true,
        isDemoPlan: false,
        planAccessType: "FREE",
        templateAccessTier: "FREE",
        trialEnabled: false,
        trialDurationDays: "14",
        watermarkText: "Quotsy - Trial Version",
        maxUsers: "",
        maxQuotations: "",
        maxCustomers: "",
        inventoryEnabled: true,
        reportsEnabled: true,
        gstEnabled: true,
        exportsEnabled: true,
        quotationWatermarkEnabled: true,
        quotationCreationLockedAfterExpiry: true
      });
      setShowPlanCreateModal(false);
      setError("Plan created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handlePlanSave(planId) {
    const draft = planDrafts[planId];
    if (!draft) return;

    try {
      const response = await apiFetch(`/api/plans/${planId}`, {
        method: "PATCH",
        body: JSON.stringify(draft)
      });
      setPlans((prev) => prev.map((plan) => (plan.id === planId ? response.plan : plan)));
      setPlanDrafts((prev) => {
        const next = { ...prev };
        delete next[planId];
        return next;
      });
      setSelectedPlanDetail((prev) => (prev && prev.id === planId ? response.plan : prev));
      setError("Plan updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function openSellerDetail(sellerRow) {
    try {
      setSellerDetailLoading(true);
      const detail = await apiFetch(`/api/sellers/${sellerRow.id}/detail`);
      setSelectedSellerDetail(detail);
      setShowSellerDetailModal(true);
    } catch (err) {
      handleApiError(err);
    } finally {
      setSellerDetailLoading(false);
    }
  }

  function closeSellerDetailModal() {
    setShowSellerDetailModal(false);
    setSelectedSellerDetail(null);
  }

  function openPlanDetail(plan) {
    setSelectedPlanDetail(plan);
    setShowPlanDetailModal(true);
  }

  function closePlanDetailModal() {
    setShowPlanDetailModal(false);
    setSelectedPlanDetail(null);
  }

  async function handleSellerDetailSave() {
    if (!selectedSellerDetail?.seller?.id) return;
    await handleSellerLifecycleSave(selectedSellerDetail.seller.id);
    await openSellerDetail(selectedSellerDetail.seller);
  }

  async function handlePlanDetailSave() {
    if (!selectedPlanDetail?.id) return;
    await handlePlanSave(selectedPlanDetail.id);
  }

  async function openSubscriptionDetail(sellerRow) {
    try {
      setShowSellerDetailModal(false);
      const [rows, detail] = await Promise.all([
        apiFetch(`/api/subscriptions?sellerId=${sellerRow.id}`),
        apiFetch(`/api/sellers/${sellerRow.id}/detail`).catch(() => null)
      ]);
      const current = Array.isArray(rows) && rows.length ? rows[0] : null;
      setSelectedSellerSubscription({
        seller: detail?.seller || sellerRow,
        subscriptions: rows || [],
        current,
        auditLogs: detail?.auditLogs || [],
        usage: detail?.usage || null
      });
      setSubscriptionModalDraft({
        subscriptionId: current?.id || null,
        sellerId: sellerRow.id,
        planCode: current?.plan_code || sellerRow.plan_code || sellerRow.subscription_plan || "DEMO",
        status: current?.status || sellerRow.subscription_status || "trial",
        trialEndAt: current?.trial_end_at ? String(current.trial_end_at).slice(0, 10) : (sellerRow.trial_end_at ? String(sellerRow.trial_end_at).slice(0, 10) : ""),
        convertedFromTrial: Boolean(current?.converted_from_trial)
      });
      setShowSubscriptionModal(true);
    } catch (err) {
      handleApiError(err);
    }
  }

  function closeSubscriptionModal() {
    setShowSubscriptionModal(false);
    setSelectedSellerSubscription(null);
    setSubscriptionModalDraft({
      subscriptionId: null,
      sellerId: null,
      planCode: "",
      status: "trial",
      trialEndAt: "",
      convertedFromTrial: false
    });
  }

  async function handleSaveSubscriptionModal() {
    if (!subscriptionModalDraft.subscriptionId || !subscriptionModalDraft.sellerId) return;

    try {
      await apiFetch(`/api/subscriptions/${subscriptionModalDraft.subscriptionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: subscriptionModalDraft.planCode,
          status: subscriptionModalDraft.status,
          trialEndAt: subscriptionModalDraft.trialEndAt || null,
          convertedFromTrial: Boolean(subscriptionModalDraft.convertedFromTrial)
        })
      });

      await apiFetch(`/api/sellers/${subscriptionModalDraft.sellerId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({
          subscriptionPlan: subscriptionModalDraft.planCode || null,
          trialEndsAt: subscriptionModalDraft.trialEndAt || null
        })
      });

      await loadAdminData();
      setError("Subscription updated successfully.");
      closeSubscriptionModal();
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleConvertToPaid() {
    if (!selectedSellerSubscription?.seller || !subscriptionModalDraft.subscriptionId) return;
    try {
      await apiFetch(`/api/subscriptions/${subscriptionModalDraft.subscriptionId}`, {
        method: "PATCH",
        body: JSON.stringify({
          planCode: subscriptionModalDraft.planCode,
          status: "active",
          convertedFromTrial: true
        })
      });

      await apiFetch(`/api/sellers/${selectedSellerSubscription.seller.id}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "active",
          subscriptionPlan: subscriptionModalDraft.planCode || null
        })
      });

      await loadAdminData();
      setError("Seller converted to paid plan successfully.");
      closeSubscriptionModal();
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleSellerUpgradeRequest(planCode) {
    if (!planCode) return;

    try {
      setUpgradeRequestLoading(true);
      const response = await apiFetch("/api/sellers/me/upgrade-request", {
        method: "POST",
        body: JSON.stringify({
          requestedPlanCode: planCode
        })
      });
      setError(response.message || "Upgrade request sent.");
    } catch (err) {
      handleApiError(err);
    } finally {
      setUpgradeRequestLoading(false);
    }
  }

  async function openLeadDetail(leadId) {
    try {
      setLeadDetailLoading(true);
      setSelectedLeadId(String(leadId));
      setShowLeadDetailModal(true);
      const detail = await apiFetch(`/api/leads/${leadId}`);
      setSelectedLeadDetail(detail);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLeadDetailLoading(false);
    }
  }

  function closeLeadDetailModal() {
    setShowLeadDetailModal(false);
  }

  async function handleLeadUpdate(leadId, updates) {
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify(updates)
      });
      await loadAdminData();
      await openLeadDetail(leadId);
      setError("Lead updated successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleAddLeadActivity(event) {
    event.preventDefault();
    if (!selectedLeadId || !leadActivityNote.trim()) return;

    try {
      await apiFetch(`/api/leads/${selectedLeadId}/activity`, {
        method: "POST",
        body: JSON.stringify({
          note: leadActivityNote,
          activityType: "note_added"
        })
      });
      setLeadActivityNote("");
      await openLeadDetail(selectedLeadId);
      await loadAdminData();
      setError("Lead note added.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function buildLeadSellerCode(lead) {
    return String(lead?.business_name || lead?.name || `LEAD-${lead?.id || ""}`)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32);
  }

  function openLeadConvertModal() {
    if (!selectedLeadDetail?.lead) return;
    const lead = selectedLeadDetail.lead;
    setLeadConvertForm({
      sellerName: lead.name || "",
      businessName: lead.business_name || lead.name || "",
      sellerCode: buildLeadSellerCode(lead),
      city: lead.city || "",
      state: "",
      businessCategory: lead.business_type || "",
      businessSegment: lead.business_segment || getBusinessSegments(lead.business_type || "")[0] || "",
      wantsSampleData: Boolean(lead.wants_sample_data ?? true),
      brandingMode: "header",
      headerImageData: null,
      logoImageData: null,
      masterUserName: lead.name || "",
      masterUserMobile: lead.mobile || "",
      masterUserPassword: ""
    });
    setShowLeadConvertModal(true);
  }

  function closeLeadConvertModal() {
    setShowLeadConvertModal(false);
    setLeadConvertSubmitting(false);
  }

  async function handleConvertLeadToDemo(event) {
    event.preventDefault();
    if (!selectedLeadId) return;

    try {
      setLeadConvertSubmitting(true);
      const response = await apiFetch(`/api/leads/${selectedLeadId}/convert-demo`, {
        method: "POST",
        body: JSON.stringify(leadConvertForm)
      });
      await loadAdminData();
      await openLeadDetail(selectedLeadId);
      setError(response.message || "Lead converted to demo successfully.");
      closeLeadConvertModal();
    } catch (err) {
      handleApiError(err);
      setLeadConvertSubmitting(false);
    }
  }

  async function handleCreateNotification(event) {
    event.preventDefault();

    try {
      const response = await apiFetch("/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: notificationForm.title,
          message: notificationForm.message,
          audienceType: notificationForm.audienceType,
          channel: notificationForm.channel,
          sendNow: Boolean(notificationForm.sendNow),
          scheduledAt: notificationForm.sendNow ? null : (notificationForm.scheduledAt || null),
          sellerId: notificationForm.audienceType === "specific_seller" ? (notificationForm.sellerId || null) : null
        })
      });

      setNotifications((prev) => [response.notification, ...prev]);
      setNotificationForm({
        title: "",
        message: "",
        audienceType: "all_sellers",
        channel: "in_app",
        sendNow: true,
        scheduledAt: "",
        sellerId: ""
      });
      setShowNotificationCreateModal(false);
      setError(response.message || "Notification created successfully.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function openNotificationDetail(notificationId) {
    try {
      setNotificationDetailLoading(true);
      const detail = await apiFetch(`/api/notifications/${notificationId}`);
      setSelectedNotificationDetail(detail);
      setShowNotificationDetailModal(true);
    } catch (err) {
      handleApiError(err);
    } finally {
      setNotificationDetailLoading(false);
    }
  }

  function closeNotificationDetailModal() {
    setShowNotificationDetailModal(false);
    setSelectedNotificationDetail(null);
  }

  async function handleOpenSellerNotification(notificationRow) {
    try {
      if (String(notificationRow.delivery_status || "").toLowerCase() !== "read") {
        const response = await apiFetch(`/api/notifications/logs/${notificationRow.id}/read`, {
          method: "PATCH"
        });
        setNotifications((prev) =>
          prev.map((row) => (row.id === notificationRow.id ? { ...row, ...response.notificationLog } : row))
        );
      }
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleOrderStatusUpdate(orderId, orderStatus) {
    try {
      await apiFetch(`/api/quotations/${orderId}/order-status`, {
        method: "PATCH",
        body: JSON.stringify({ orderStatus })
      });
      const quotationRows = await apiFetch("/api/quotations");
      setQuotations(quotationRows);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleMarkQuotationSent(orderId) {
    try {
      await apiFetch(`/api/quotations/${orderId}/mark-sent`, {
        method: "PATCH"
      });
      const quotationRows = await apiFetch("/api/quotations");
      setQuotations(quotationRows);
      setError("Quotation marked as sent.");
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleMarkPaid(orderId) {
    try {
      await apiFetch(`/api/quotations/${orderId}/payment-status`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "paid" })
      });
      const quotationRows = await apiFetch("/api/quotations");
      setQuotations(quotationRows);
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleSaveDecodeRules(event) {
    event.preventDefault();
    if (!canEditSettings) {
      setError("You do not have permission to edit business settings.");
      return;
    }
    try {
      const updated = await apiFetch("/api/whatsapp/decode-rules", {
        method: "PUT",
        body: JSON.stringify({
          customerLine: Number(decodeRules.customer_line || 1),
          mobileLine: Number(decodeRules.mobile_line || 2),
          itemLine: Number(decodeRules.item_line || 3),
          deliveryDateLine: Number(decodeRules.delivery_date_line || 4),
          deliveryTypeLine: Number(decodeRules.delivery_type_line || 5),
          enabled: Boolean(decodeRules.enabled)
        })
      });
      setDecodeRules(updated);
      setError("Decode formula updated.");
    } catch (err) {
      handleApiError(err);
    }
  }
  async function handleSaveQuotationTemplate(event) {
    event.preventDefault();
    if (!canEditSettings) {
      setError("You do not have permission to edit quotation settings.");
      return;
    }
    try {
      const savedTemplate = await apiFetch("/api/quotations/templates/current", {
        method: "PUT",
        body: JSON.stringify({
          templatePreset: quotationTemplate.template_preset,
          templateThemeKey: quotationTemplate.template_theme_key || "default",
          headerText: quotationTemplate.header_text,
          bodyTemplate: quotationTemplate.body_template,
          footerText: quotationTemplate.footer_text,
          companyPhone: quotationTemplate.company_phone,
          companyEmail: quotationTemplate.company_email,
          headerImageData: quotationTemplate.header_image_data,
          showHeaderImage: quotationTemplate.show_header_image,
          logoImageData: quotationTemplate.logo_image_data,
          showLogoOnly: quotationTemplate.show_logo_only,
          footerImageData: quotationTemplate.footer_image_data,
          showFooterImage: quotationTemplate.show_footer_image,
          accentColor: quotationTemplate.accent_color,
          notesText: quotationTemplate.notes_text,
          termsText: quotationTemplate.terms_text,
          showBankDetails: quotationTemplate.show_bank_details,
          showNotes: quotationTemplate.show_notes,
          showTerms: quotationTemplate.show_terms,
          emailEnabled: quotationTemplate.email_enabled,
          whatsappEnabled: quotationTemplate.whatsapp_enabled
        })
      });
      if (savedTemplate) {
        setQuotationTemplate((prev) => ({
          ...prev,
          ...savedTemplate
        }));
      }
      await refreshSellerSetupStatus();
      setError("Quotation format updated.");
    } catch (err) {
      handleApiError(err);
    }
  }

  function applyQuotationTemplatePreset(presetKey) {
    const defaults = getQuotationTemplatePresetDefaults(presetKey);
    setQuotationTemplate((prev) => ({
      ...prev,
      template_preset: presetKey,
      ...defaults
    }));
  }

  function applyQuotationThemeSelection(themeKey) {
    const themeConfig = getQuotationThemeConfig(themeKey);
    setQuotationTemplate((prev) => ({
      ...prev,
      template_preset: "default",
      template_theme_key: themeKey,
      accent_color: themeConfig.accent
    }));
  }

  async function handleQuotationTemplateImageChange(event, targetField, defaultToggleField = null) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setQuotationTemplate((prev) => ({
        ...prev,
        [targetField]: dataUrl,
        ...(defaultToggleField ? { [defaultToggleField]: true } : {})
      }));
    } catch (err) {
      handleApiError(err);
    } finally {
      event.target.value = "";
    }
  }

  async function handleQuotationHeaderImageChange(event) {
    return handleQuotationTemplateImageChange(event, "header_image_data", "show_header_image");
  }

  async function handleQuotationLogoImageChange(event) {
    return handleQuotationTemplateImageChange(event, "logo_image_data", "show_logo_only");
  }

  async function handleQuotationFooterImageChange(event) {
    return handleQuotationTemplateImageChange(event, "footer_image_data", "show_footer_image");
  }

  async function handleSendQuotationEmail(orderId) {
    try {
      setError("");
      const response = await apiFetch(`/api/quotations/${orderId}/send-email`, {
        method: "POST",
        body: JSON.stringify({
          ccEmail: String(auth?.user?.email || "").trim() || null
        })
      });
      setSuccessNotice(response.message || "Quotation email sent successfully.");
      const notificationRows = await apiFetch("/api/notifications").catch(() => []);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
      if (showOrderDetailsModal && selectedOrderDetails?.quotation?.id === Number(orderId)) {
        await handleOpenOrderDetails(orderId);
      }
    } catch (err) {
      handleApiError(err);
    }
  }

  async function handleDownloadQuotation(orderId) {
    try {
      const token = auth?.token || getStoredAuth()?.token || null;
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${baseUrl}/api/quotations/${orderId}/download`, {
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) throw new Error("Failed to download quotation");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const nameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename = nameMatch?.[1] || `${getQuotationFileStem(selectedOrderDetails?.quotation || { id: orderId })}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err?.name === "AbortError") {
        setError("PDF download timed out, even after fallback. Please try again.");
        return;
      }
      handleApiError(err);
    }
  }

  async function handleDownloadQuotationSheet(orderId) {
    try {
      const details = await apiFetch(`/api/quotations/${orderId}`);
      const quotation = details?.quotation || {};
      const items = Array.isArray(details?.items) ? details.items : [];
      const rows = items.map((item) => ({
        "Customer name": quotation.firm_name || quotation.customer_name || "",
        "Customer Mobile Number": quotation.mobile || "",
        Material: item.material_name || item.design_name || item.sku || "",
        Thickness: item.thickness || "",
        Size: item.size || "",
        rate: Number(item.unit_price || 0)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Quotation");
      XLSX.writeFile(workbook, `quotation-${getVisibleQuotationNumber(quotation) || orderId}.xlsx`);
    } catch (err) {
      handleApiError(err);
    }
  }

  function buildQuotationExportRows(details) {
    const quotation = details?.quotation || {};
    const items = Array.isArray(details?.items) && details.items.length > 0 ? details.items : [{}];
    return items.map((item, index) => ({
      quotation_id: quotation.id || "",
      quotation_number: getVisibleQuotationNumber(quotation) || "",
      version_no: quotation.version_no || 1,
      quotation_date: quotation.created_at || "",
      customer_name: quotation.customer_name || "",
      customer_firm_name: quotation.firm_name || "",
      customer_mobile: quotation.mobile || "",
      customer_email: quotation.email || "",
      customer_gst_number: quotation.customer_gst_number || "",
      customer_shipping_addresses: Array.isArray(quotation.customer_shipping_addresses)
        ? quotation.customer_shipping_addresses.map((entry) => entry?.address || entry?.label || "").filter(Boolean).join(" | ")
        : "",
      seller_id: quotation.seller_id || "",
      subtotal: Number(quotation.subtotal || 0),
      gst_amount: Number(quotation.gst_amount || 0),
      transport_charges: Number(quotation.transport_charges || 0),
      design_charges: Number(quotation.design_charges || 0),
      discount_amount: Number(quotation.discount_amount || 0),
      advance_amount: Number(quotation.advance_amount ?? quotation.advanceAmount ?? 0),
      total_amount: Number(quotation.total_amount || 0),
      balance_amount: Number(quotation.balance_amount || 0),
      payment_status: quotation.payment_status || "",
      order_status: quotation.order_status || "",
      delivery_type: quotation.delivery_type || "",
      delivery_date: quotation.delivery_date || "",
      delivery_address: quotation.delivery_address || "",
      delivery_pincode: quotation.delivery_pincode || "",
      item_row_no: index + 1,
      item_material_name: item.material_name || item.design_name || item.sku || "",
      item_sku: item.sku || "",
      item_category: item.item_category || "",
      item_thickness: item.thickness || "",
      item_color_name: item.color_name || "",
      item_size: item.size || "",
      item_dimension_width: item.dimension_width || "",
      item_dimension_height: item.dimension_height || "",
      item_dimension_unit: item.dimension_unit || "",
      item_quantity: Number(item.quantity || 0),
      item_unit_price: Number(item.unit_price || 0),
      item_total_price: Number(item.total_price || 0),
      item_pricing_type: item.pricing_type || "",
      item_note: item.item_note || "",
      ...Object.fromEntries(
        Object.entries(item.custom_fields || {}).map(([key, value]) => [
          `item_custom_${normalizeConfigKey(key)}`,
          value ?? ""
        ])
      )
    }));
  }

  const BASE_EXPORT_FIELD_ORDER = [
    "quotation_id",
    "quotation_number",
    "version_no",
    "quotation_date",
    "customer_name",
    "customer_firm_name",
    "customer_mobile",
    "customer_email",
    "customer_gst_number",
    "customer_shipping_addresses",
    "subtotal",
    "gst_amount",
    "transport_charges",
    "design_charges",
    "discount_amount",
    "advance_amount",
    "total_amount",
    "balance_amount",
    "payment_status",
    "order_status",
    "delivery_type",
    "delivery_date",
    "delivery_address",
    "delivery_pincode",
    "item_row_no"
  ];

  function mapConfiguredFieldToExportKey(configKey) {
    const normalized = normalizeConfigKey(configKey);
    switch (normalized) {
      case "material_name":
        return "item_material_name";
      case "sku":
        return "item_sku";
      case "category":
        return "item_category";
      case "thickness":
        return "item_thickness";
      case "color_name":
        return "item_color_name";
      case "size":
        return "item_size";
      case "width":
        return "item_dimension_width";
      case "height":
        return "item_dimension_height";
      case "unit":
      case "uom":
      case "unit_type":
        return "item_dimension_unit";
      case "quantity":
        return "item_quantity";
      case "rate":
      case "unit_price":
        return "item_unit_price";
      case "amount":
      case "total":
      case "total_rate":
      case "total_price":
        return "item_total_price";
      case "pricing_type":
        return "item_pricing_type";
      case "note":
      case "item_note":
        return "item_note";
      default:
        return `item_custom_${normalized}`;
    }
  }

  function buildSellerExportWhitelist(config) {
    const allowed = new Set(BASE_EXPORT_FIELD_ORDER);
    const configuredCatalogueFields = Array.isArray(config?.catalogueFields) ? config.catalogueFields : [];
    configuredCatalogueFields.forEach((field) => {
      if (!field?.key) return;
      allowed.add(mapConfiguredFieldToExportKey(field.key));
    });
    const configuredQuotationColumns = Array.isArray(config?.quotationColumns) ? config.quotationColumns : [];
    configuredQuotationColumns.forEach((column) => {
      if (!column?.key) return;
      if (column.visibleInForm || column.visibleInPdf || column.required || column.type === "formula") {
        allowed.add(mapConfiguredFieldToExportKey(column.key));
      }
    });
    return allowed;
  }

  function formatExportColumnLabel(key) {
    return String(key || "")
      .replace(/^item_custom_/, "Item Custom ")
      .replace(/^item_/, "Item ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  async function loadQuotationExportDraft(quotationIds = [], options = {}) {
    const ids = Array.from(new Set((quotationIds || []).map((value) => Number(value)).filter(Number.isFinite)));
    if (!ids.length) return { fieldOptions: [], rows: [] };
    const scopedSellerId = options?.sellerId ? Number(options.sellerId) : null;

    const detailsRows = await Promise.all(ids.map((id) => apiFetch(`/api/quotations/${id}`)));
    const rows = detailsRows
      .filter((details) => {
        if (!scopedSellerId) return true;
        return Number(details?.quotation?.seller_id || 0) === scopedSellerId;
      })
      .flatMap((details) => buildQuotationExportRows(details));
    const fieldOrder = [];
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!seen.has(key)) {
          seen.add(key);
          fieldOrder.push(key);
        }
      });
    });

    const visibleFieldOrder = fieldOrder.filter((key) =>
      rows.some((row) => {
        const value = row[key];
        return value !== "" && value !== null && value !== undefined;
      })
    );
    const sellerWhitelist = buildSellerExportWhitelist(currentSellerConfiguration);
    const preferredOrder = [
      ...BASE_EXPORT_FIELD_ORDER,
      ...Array.from(sellerWhitelist).filter((key) => !BASE_EXPORT_FIELD_ORDER.includes(key))
    ];
    const orderedVisibleScopedFields = preferredOrder.filter((key) =>
      visibleFieldOrder.includes(key) && sellerWhitelist.has(key)
    );

    return {
      rows,
      fieldOptions: orderedVisibleScopedFields.map((key) => ({ key, label: formatExportColumnLabel(key) }))
    };
  }

  function downloadQuotationExportSheet(rows = [], orderedFieldKeys = []) {
    if (!rows.length || !orderedFieldKeys.length) return;
    const exportRows = rows.map((row) =>
      orderedFieldKeys.reduce((accumulator, key) => {
        accumulator[formatExportColumnLabel(key)] = row[key] ?? "";
        return accumulator;
      }, {})
    );

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Quotations");
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    XLSX.writeFile(workbook, `quotations-export-${timestamp}.xlsx`);
  }

  async function handleOpenOrderDetails(orderId) {
    try {
      const [details, versions] = await Promise.all([
        apiFetch(`/api/quotations/${orderId}`),
        apiFetch(`/api/quotations/${orderId}/versions`).catch(() => [])
      ]);
      setSelectedOrderDetails(details);
      const versionRows = Array.isArray(versions) ? versions : [];
      setOrderVersions(versionRows);
      setSelectedVersionId(versionRows[0] ? String(versionRows[0].id) : "");
      setShowOrderDetailsModal(true);
    } catch (err) {
      handleApiError(err);
    }
  }

  function openRevisionQuotationWizard() {
    if (!selectedOrderDetails?.quotation?.id) return;
    const revisionState = buildQuotationWizardRevisionState(selectedOrderDetails, {
      products,
      customers,
      quotationColumns: unsupportedRuntimeQuotationColumns,
      createInitialQuotationWizardState,
      createQuotationWizardItem,
      getCatalogueDrivenQuotationCustomFields
    });
    openQuotationWizardWithSetupGuard(revisionState);
    setError("");
  }

  function closeOrderDetailsModal() {
    setShowOrderDetailsModal(false);
    setSelectedOrderDetails(null);
    setOrderVersions([]);
    setSelectedVersionId("");
  }

  function changeSort(key) {
    setOrderSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  }

  function handleCookieConsentDecision(decision) {
    if (decision !== "accepted" && decision !== "rejected") return;
    setCookieConsent(decision);
    try {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, decision);
    } catch {
      // Ignore storage errors and keep app usable.
    }
  }

  function renderPagination(page, setPage, total) {
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return (
      <div className="pagination-bar">
        <button type="button" className="ghost-btn" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>Prev</button>
        <span>Page {page} / {pageCount}</span>
        <button type="button" className="ghost-btn" onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))} disabled={page === pageCount}>Next</button>
      </div>
    );
  }

  if (!authReady) {
    return <div className="auth-wrap"><div className="glass-card">Preparing dashboard...</div></div>;
  }

  if (!auth?.token && bootstrapRequired) {
    return (
      <>
        <PublicLoginPage
          bootstrapRequired
          bootstrapHint={false}
          loginForm={loginForm}
          setupForm={setupForm}
          rememberMe={rememberMe}
          infoMessage={authNotice}
          errorMessage={error}
          onLoginFormChange={setLoginForm}
          onSetupFormChange={setSetupForm}
          onRememberMeChange={setRememberMe}
          onLogin={handleLogin}
          onBootstrapAdmin={handleBootstrapAdmin}
        />
        {!cookieConsent ? (
          <div className="cookie-consent-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
            <p>We use cookies to improve performance and user experience. Please accept or reject cookies to continue.</p>
            <div className="cookie-consent-actions">
              <button type="button" className="ghost-btn" onClick={() => handleCookieConsentDecision("rejected")}>Reject</button>
              <button type="button" onClick={() => handleCookieConsentDecision("accepted")}>Accept</button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  if (isPublicLeadPage) {
    return (
      <PublicLeadCapturePage
        form={publicLeadForm}
        submitting={publicLeadSubmitting}
        successMessage={publicLeadSuccess}
        errorMessage={publicLeadError}
        onChange={updatePublicLeadField}
        onSubmit={handleSubmitPublicLead}
        businessCategoryOptions={BUSINESS_CATEGORY_OPTIONS}
        getBusinessSegments={getBusinessSegments}
      />
    );
  }

  if (isPublicDemoPage) {
    return (
      <PublicDemoSignupPage
        form={publicDemoForm}
        submitting={publicDemoSubmitting}
        successMessage={publicDemoSuccess}
        errorMessage={publicDemoError}
        onChange={updatePublicDemoField}
        onSubmit={handleSubmitPublicDemo}
        businessCategoryOptions={BUSINESS_CATEGORY_OPTIONS}
        getBusinessSegments={getBusinessSegments}
      />
    );
  }

  if (isPublicVisitorHelpPage) {
    return <PublicVisitorFaqPage />;
  }

  if (isPublicFeaturesPage) {
    return <PublicQuotsyFeaturesPage />;
  }

  if (!auth?.token) {
    if (isPublicLandingPage) {
      return <PublicLandingPage />;
    }
    return (
      <>
        <PublicLoginPage
          bootstrapRequired={Boolean(bootstrapRequired)}
          bootstrapHint={false}
          loginForm={loginForm}
          setupForm={setupForm}
          rememberMe={rememberMe}
          infoMessage={authNotice}
          errorMessage={error}
          onLoginFormChange={setLoginForm}
          onSetupFormChange={setSetupForm}
          onRememberMeChange={setRememberMe}
          onLogin={handleLogin}
          onBootstrapAdmin={handleBootstrapAdmin}
        />
        {!cookieConsent ? (
          <div className="cookie-consent-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
            <p>We use cookies to improve performance and user experience. Please accept or reject cookies to continue.</p>
            <div className="cookie-consent-actions">
              <button type="button" className="ghost-btn" onClick={() => handleCookieConsentDecision("rejected")}>Reject</button>
              <button type="button" onClick={() => handleCookieConsentDecision("accepted")}>Accept</button>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="app-ambience" aria-hidden="true">
        <span className="shape shape-cube" />
        <span className="shape shape-ring" />
        <span className="shape shape-panel" />
      </div>
      <aside className="sidebar glass-panel">
        <div className="brand-block">
          <div className="brand-dot" />
          <div>
            <h2>{isPlatformAdmin ? "Quotsy Platform" : "Quotsy"}</h2>
            <p>{isPlatformAdmin ? "Control Plane" : (seller?.name || "Seller Workspace")}</p>
          </div>
        </div>

        <nav className="nav-list">
          {currentModules.map((module) => (
            <button
              key={module}
              type="button"
              className={`${activeModule === module ? "nav-item active" : "nav-item"}${isModuleSetupLocked(module) ? " locked" : ""}`}
              onClick={() => {
                const setupLockMessage = getModuleSetupLockMessage(module);
                if (setupLockMessage) {
                  setError(setupLockMessage);
                  return;
                }
                if (module === "Configuration Studio" && !isPlatformAdmin && seller) {
                  openSellerConfigurationStudio(seller);
                  return;
                }
                setActiveModule(module);
              }}
            >
              <span className="nav-mark" aria-hidden="true" />
              <span className="nav-label">{module === "Orders" ? "Quotation" : module}</span>
              {isModuleSetupLocked(module) && <span className="badge pending">Setup</span>}
              {module === "Approvals" && pendingApprovalCount > 0 && (
                <span className="notification-count-pill">{pendingApprovalCount}</span>
              )}
            </button>
          ))}
        </nav>

        {!isPlatformAdmin && sellerSubscriptionBanner && (
          <div className={`sidebar-subscription-card glass-panel ${sellerSubscriptionBanner.tone === "error" ? "is-error" : sellerSubscriptionBanner.tone === "info" ? "is-info" : ""}`}>
            <div className="sidebar-subscription-head">
              <span className="eyebrow">Subscription</span>
              <strong>{sellerSubscriptionBanner.title}</strong>
            </div>
            <p>{sellerSubscriptionBanner.message}</p>
            {sellerSubscriptionBanner.showUpgradeCta && (
              <div className="sidebar-subscription-actions">
                {(sellerSubscriptionBanner.suggestedPlans || []).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="ghost-btn compact-btn"
                    disabled={upgradeRequestLoading}
                    onClick={() => handleSellerUpgradeRequest(plan.plan_code)}
                  >
                    {upgradeRequestLoading ? "Sending..." : `Upgrade to ${plan.plan_name}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="workspace">
      <header className="topbar glass-panel">
          <div className={`topbar-main ${!isPlatformAdmin ? "topbar-main-seller" : ""}`}>
            {!isPlatformAdmin && (
              <div className="topbar-intro">
                <p className="eyebrow">Seller Workspace</p>
                <h1>{seller?.name || "Seller Workspace"}</h1>
              </div>
            )}
            {!isSubUser && canSearchQuotation && (
              <div className="search-wrap">
                <input placeholder="Search quotations by number, customer, or mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
                {topSearchSuggestions.length > 0 && (
                  <div className="search-suggestion-popover glass-panel">
                    {topSearchSuggestions.map((quotation) => (
                      <div key={quotation.id} className="search-suggestion-item">
                        <button
                          type="button"
                          className="search-suggestion-open"
                          onClick={() => handleHeaderSearchSelect(quotation.id)}
                        >
                          <strong>{formatQuotationLabel(quotation)}</strong>
                          <span>{quotation.firm_name || quotation.customer_name || "-"}</span>
                          <small>{quotation.mobile || "-"}</small>
                        </button>
                        {canDownloadQuotationPdf && (
                          <button
                            type="button"
                            className="ghost-btn compact-btn search-suggestion-download"
                            onClick={() => handleDownloadQuotation(quotation.id)}
                          >
                            PDF
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="top-actions">
            <button
              className="glass-btn notifications-btn"
              type="button"
              onClick={() => {
                if (isPlatformAdmin) {
                  setActiveModule("Notifications");
                  return;
                }
                setShowSellerNotificationsModal(true);
              }}
            >
              Notifications
              {unreadNotificationsCount > 0 && (
                <span className="notification-count-pill">{unreadNotificationsCount}</span>
              )}
            </button>
            <div className="profile-menu-wrap">
              <button className="profile-chip profile-trigger" type="button" onClick={() => setShowProfileMenu((prev) => !prev)}>
                <span>{auth.user?.name}</span>
              </button>
              {showProfileMenu && (
                <div className="profile-dropdown glass-panel">
                  <strong>{auth.user?.name}</strong>
                  <span>{isPlatformAdmin ? "Platform Admin" : auth.user?.role}</span>
                  <button className="ghost-btn" type="button" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {loading && <div className="notice">Syncing latest data...</div>}
        {!isPlatformAdmin && !isSubUser && sellerSetupStage === "settings" && pendingSetupLabels.length > 0 && !isAnyModalOpen && (
          <div className="notice">
            <strong>Complete these settings to unlock modules:</strong> {pendingSetupLabels.join(", ")}
          </div>
        )}
        {!isPlatformAdmin && !isSubUser && sellerSetupStage === "configuration" && !isAnyModalOpen && (
          <div className="notice">
            <strong>Configuration pending:</strong> Publish configuration with catalogue + quotation fields to unlock quotation flow.
          </div>
        )}
        {successNotice && !isAnyModalOpen && <div className="notice success">{successNotice}</div>}
        {error && !isAnyModalOpen && <div className="notice error">{error}</div>}

        {activeModule === "Leads" ? (
          <LeadsPage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            leads={leads}
            openLeadDetail={openLeadDetail}
            showLeadConvertModal={showLeadConvertModal}
            selectedLeadDetail={selectedLeadDetail}
            closeLeadConvertModal={closeLeadConvertModal}
            handleConvertLeadToDemo={handleConvertLeadToDemo}
            leadConvertForm={leadConvertForm}
            setLeadConvertForm={setLeadConvertForm}
            leadConvertSubmitting={leadConvertSubmitting}
            showLeadDetailModal={showLeadDetailModal}
            closeLeadDetailModal={closeLeadDetailModal}
            leadDetailLoading={leadDetailLoading}
            formatDateTime={formatDateTime}
            handleAddLeadActivity={handleAddLeadActivity}
            leadActivityNote={leadActivityNote}
            setLeadActivityNote={setLeadActivityNote}
            formatAuditActionLabel={formatAuditActionLabel}
            handleLeadUpdate={handleLeadUpdate}
            LEAD_STATUS_OPTIONS={LEAD_STATUS_OPTIONS}
            users={users}
            openLeadConvertModal={openLeadConvertModal}
            businessCategoryOptions={BUSINESS_CATEGORY_OPTIONS}
            getBusinessSegments={getBusinessSegments}
            handleLeadConvertBrandingImageChange={handleLeadConvertBrandingImageChange}
          />
        ) : activeModule === "Sellers" ? (
          <section className="module-placeholder glass-panel">
            <div className="page-banner">
              <div>
                <p className="eyebrow">{currentModuleMeta.Sellers.eyebrow}</p>
                <h2>{currentModuleMeta.Sellers.title}</h2>
                <p>{currentModuleMeta.Sellers.subtitle}</p>
              </div>
              <div className="banner-stat">
                <span>Total Sellers</span>
                <strong>{sellers.length}</strong>
              </div>
            </div>

            <div className="section-head">
              <h3>Seller List</h3>
              <div className="toolbar-controls">
                <input
                  type="search"
                  className="toolbar-search"
                  placeholder="Search seller, plan, code..."
                  value={sellerSearch}
                  onChange={(e) => setSellerSearch(e.target.value)}
                />
                <span>{filteredSellers.length} seller(s)</span>
                <button type="button" className="action-btn" onClick={() => setShowSellerCreateModal(true)}>Create New Seller</button>
              </div>
            </div>

            <table className="data-table">
              <thead>
                <tr><th>Seller</th><th>Business</th><th>Mobile</th><th>Plan</th><th>Status</th><th>Trial End</th><th>Users</th><th>Orders</th></tr>
              </thead>
              <tbody>
                {pagedSellers.length === 0 ? (
                  <tr><td colSpan="8">No sellers created yet.</td></tr>
                ) : (
                  pagedSellers.map((sellerRow, index) => (
                    <tr key={sellerRow.id} className="lead-row" onClick={() => openSellerDetail(sellerRow)}>
                      <td>
                        <strong>{sellerRow.name}</strong>
                        <div className="seller-meta-stack">
                          <span>#{(sellerPage - 1) * PAGE_SIZE + index + 1}</span>
                          <span>{sellerRow.seller_code}</span>
                          <span>{sellerRow.email || "-"}</span>
                        </div>
                      </td>
                      <td>{sellerRow.business_name || "-"}</td>
                      <td>{sellerRow.mobile || "-"}</td>
                      <td>{sellerRow.plan_name || sellerRow.subscription_plan || "-"}</td>
                      <td><span className={`badge ${sellerRow.is_locked ? "pending" : "success"}`}>{sellerRow.is_locked ? "Locked" : (sellerRow.status || "active")}</span></td>
                      <td>{formatDateIST(sellerRow.trial_end_at)}</td>
                      <td>{sellerRow.user_count || 0}</td>
                      <td>{sellerRow.order_count || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {renderPagination(sellerPage, setSellerPage, filteredSellers.length)}

            {showSellerCreateModal && (
              <div className="modal-overlay" onClick={() => setShowSellerCreateModal(false)}>
                <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
                  <div className="section-head">
                    <h3>Create Seller</h3>
                    <button type="button" className="ghost-btn" onClick={() => setShowSellerCreateModal(false)}>Close</button>
                  </div>
                  <form className="auth-card compact-form" onSubmit={handleCreateSeller}>
                    <input placeholder="Seller Name" value={sellerForm.name} onChange={(e) => setSellerForm((prev) => ({ ...prev, name: e.target.value }))} required />
                    <input placeholder="Seller Code" value={sellerForm.sellerCode} onChange={(e) => setSellerForm((prev) => ({ ...prev, sellerCode: e.target.value }))} required />
                    <input placeholder="Business Name" value={sellerForm.businessName || ""} onChange={(e) => setSellerForm((prev) => ({ ...prev, businessName: e.target.value }))} />
                    <input placeholder="Mobile" value={sellerForm.mobile} onChange={(e) => setSellerForm((prev) => ({ ...prev, mobile: e.target.value }))} />
                    <input placeholder="Email" value={sellerForm.email} onChange={(e) => setSellerForm((prev) => ({ ...prev, email: e.target.value }))} />
                    <select value={sellerForm.status} onChange={(e) => setSellerForm((prev) => ({ ...prev, status: e.target.value }))}>
                      {SELLER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input type="date" value={sellerForm.trialEndsAt} onChange={(e) => setSellerForm((prev) => ({ ...prev, trialEndsAt: e.target.value }))} />
                    <select value={sellerForm.subscriptionPlan} onChange={(e) => setSellerForm((prev) => ({ ...prev, subscriptionPlan: e.target.value }))}>
                      {plans.map((plan) => <option key={plan.id} value={plan.plan_code}>{plan.plan_name} ({plan.plan_code})</option>)}
                    </select>
                    <input placeholder="Max Users" type="number" min="0" value={sellerForm.maxUsers} onChange={(e) => setSellerForm((prev) => ({ ...prev, maxUsers: e.target.value }))} />
                    <input placeholder="Max Orders / Month" type="number" min="0" value={sellerForm.maxOrdersPerMonth} onChange={(e) => setSellerForm((prev) => ({ ...prev, maxOrdersPerMonth: e.target.value }))} />
                    <select value={sellerForm.themeKey} onChange={(e) => setSellerForm((prev) => ({ ...prev, themeKey: e.target.value }))}>
                      {THEME_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <input type="color" value={sellerForm.brandPrimaryColor} onChange={(e) => setSellerForm((prev) => ({ ...prev, brandPrimaryColor: e.target.value }))} />
                    <label className="seller-toggle">
                      <input type="checkbox" checked={sellerForm.isLocked} onChange={(e) => setSellerForm((prev) => ({ ...prev, isLocked: e.target.checked }))} style={{ width: "auto" }} />
                      Locked
                    </label>
                    <input placeholder="Master User Name" value={sellerForm.masterName} onChange={(e) => setSellerForm((prev) => ({ ...prev, masterName: e.target.value }))} />
                    <input placeholder="Master User Mobile" value={sellerForm.masterMobile} onChange={(e) => setSellerForm((prev) => ({ ...prev, masterMobile: e.target.value }))} />
                    <input placeholder="Master User Password" type="password" value={sellerForm.masterPassword} onChange={(e) => setSellerForm((prev) => ({ ...prev, masterPassword: e.target.value }))} />
                    {error && <div className="notice error">{error}</div>}
                    <button type="submit">Create Seller</button>
                  </form>
                </div>
              </div>
            )}
          </section>
        ) : activeModule === "Subscriptions" ? (
          <SubscriptionsPage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            subscriptions={subscriptions}
            isPlatformAdmin={isPlatformAdmin}
            subscriptionSearch={subscriptionSearch}
            setSubscriptionSearch={setSubscriptionSearch}
            filteredSubscriptions={filteredSubscriptions}
            currentSellerSubscription={currentSellerSubscription}
            formatDateIST={formatDateIST}
            openSubscriptionDetail={openSubscriptionDetail}
          />
        ) : activeModule === "Plans" ? (
          <PlansPage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            plans={plans}
            planSearch={planSearch}
            setPlanSearch={setPlanSearch}
            filteredPlans={filteredPlans}
            setShowPlanCreateModal={setShowPlanCreateModal}
            openPlanDetail={openPlanDetail}
            formatCurrency={formatCurrency}
            showPlanCreateModal={showPlanCreateModal}
            handleCreatePlan={handleCreatePlan}
            error={error}
            planForm={planForm}
            setPlanForm={setPlanForm}
            BILLING_CYCLE_OPTIONS={BILLING_CYCLE_OPTIONS}
          />
        ) : activeModule === "Notifications" ? (
          <NotificationsPage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            notifications={notifications}
            setShowNotificationCreateModal={setShowNotificationCreateModal}
            openNotificationDetail={openNotificationDetail}
            formatDateTime={formatDateTime}
            showNotificationCreateModal={showNotificationCreateModal}
            handleCreateNotification={handleCreateNotification}
            error={error}
            notificationForm={notificationForm}
            setNotificationForm={setNotificationForm}
            sellers={sellers}
          />
        ) : activeModule === "Go-Live Gate" ? (
          <GoLiveGatePage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            gates={goLiveGates}
            loading={goLiveGatesLoading}
            savingGateId={goLiveGateSavingId}
            onRefresh={refreshGoLiveGates}
            onUpdateGate={handleUpdateGoLiveGate}
          />
        ) : activeModule === "Users" ? (
          <UsersPage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            isPlatformAdmin={isPlatformAdmin}
            handleSeedRoles={handleSeedRoles}
            setShowUserModal={setShowUserModal}
            canCreateUser={canCreateUser}
            canEditUser={canEditUser}
            pagedUsers={pagedUsers}
            userPage={userPage}
            PAGE_SIZE={PAGE_SIZE}
            auth={auth}
            handleLockToggle={handleLockToggle}
            handleResetUserPassword={handleResetUserPassword}
            renderPagination={renderPagination}
            setUserPage={setUserPage}
            users={users}
            showUserModal={showUserModal}
            showUserEditModal={showUserEditModal}
            editingUser={editingUser}
            handleCreateUser={handleCreateUser}
            handleOpenEditUser={handleOpenEditUser}
            handleCloseEditUser={handleCloseEditUser}
            handleUpdateUser={handleUpdateUser}
            error={error}
            userForm={userForm}
            userFormErrors={userFormErrors}
            setUserForm={setUserForm}
            setUserFormErrors={setUserFormErrors}
            roles={roles}
          />
        ) : activeModule === "Approvals" ? (
          <ApprovalsPage
            activeModule={activeModule}
            currentModuleMeta={currentModuleMeta}
            approvals={approvals}
            selectedApprovalId={selectedApprovalId}
            selectedApprovalDetail={selectedApprovalDetail}
            approvalFilter={approvalFilter}
            setApprovalFilter={setApprovalFilter}
            openApprovalDetail={openApprovalDetail}
            handleApprovalDecision={handleApprovalDecision}
            approvalDecisionNote={approvalDecisionNote}
            setApprovalDecisionNote={setApprovalDecisionNote}
            approvalDecisionLoading={approvalDecisionLoading}
            canAccessApprovals={canAccessApprovals}
            canDecideApprovals={canDecideApprovals}
            formatCurrency={formatCurrency}
            formatDateTime={formatDateTime}
            handleDownloadQuotation={handleDownloadQuotation}
          />
        ) : activeModule === "Orders" ? (
          showOrderDetailsModal ? (
            <OrderDetailPage
              showOrderDetailsPage={showOrderDetailsModal}
              selectedOrderDetails={selectedOrderDetails}
              closeOrderDetailsPage={closeOrderDetailsModal}
              handleDownloadQuotationSheet={handleDownloadQuotationSheet}
              handleSendQuotationEmail={handleSendQuotationEmail}
              selectedVersionRecord={selectedVersionRecord}
              selectedVersionIndex={selectedVersionIndex}
              openRevisionQuotationWizard={openRevisionQuotationWizard}
              shouldShowVersionSelector={shouldShowVersionSelector}
              selectedVersionId={selectedVersionId}
              setSelectedVersionId={setSelectedVersionId}
              orderVersions={orderVersions}
              getVersionLabel={getVersionLabel}
              formatDateIST={formatDateIST}
              displayedQuotation={displayedQuotation}
              previousVersionRecord={previousVersionRecord}
              quotationFieldChanged={quotationFieldChanged}
              formatQuotationLabel={formatQuotationLabel}
              formatCurrency={formatCurrency}
              statusLabel={statusLabel}
              approvalStatusLabel={approvalStatusLabel}
              openApprovalRequest={openApprovalRequest}
              error={error}
              orderDetailColumns={orderDetailColumns}
              displayedItems={displayedItems}
              quotationItemFieldChanged={quotationItemFieldChanged}
              getQuotationItemTitle={getQuotationItemTitle}
              getQuotationCustomFieldEntries={getQuotationCustomFieldEntries}
              getQuotationItemDimensionText={getQuotationItemDimensionText}
              getQuotationItemQuantityValue={getQuotationItemQuantityValue}
              getQuotationItemRateValue={getQuotationItemRateValue}
              getQuotationItemTotalValue={getQuotationItemTotalValue}
              canReviseQuotation={canReviseQuotation}
            />
          ) : (
            <OrdersPage
              activeModule={activeModule}
              quotations={quotations}
              sellers={sellers}
              seller={seller}
              isPlatformAdmin={isPlatformAdmin}
              filteredOrders={filteredOrders}
              pagedOrders={pagedOrders}
              orderPage={orderPage}
              PAGE_SIZE={PAGE_SIZE}
              setOrderPage={setOrderPage}
              handleOpenOrderDetails={handleOpenOrderDetails}
              formatQuotationLabel={formatQuotationLabel}
              formatCurrency={formatCurrency}
              statusLabel={statusLabel}
              handleOrderStatusUpdate={handleOrderStatusUpdate}
              ORDER_STATUS_OPTIONS={ORDER_STATUS_OPTIONS}
              handleMarkQuotationSent={handleMarkQuotationSent}
              handleMarkPaid={handleMarkPaid}
              handleDownloadQuotationSheet={handleDownloadQuotationSheet}
              handleDownloadQuotation={handleDownloadQuotation}
              handleSendQuotationEmail={handleSendQuotationEmail}
              renderPagination={renderPagination}
              canEditQuotation={canEditQuotation}
              canSendQuotation={canSendQuotation}
              canMarkPaid={canMarkPaid}
              canDownloadQuotationPdf={canDownloadQuotationPdf}
              loadQuotationExportDraft={loadQuotationExportDraft}
              downloadQuotationExportSheet={downloadQuotationExportSheet}
            />
          )
        ) : activeModule === "Customers" ? (
          <CustomersPage
            activeModule={activeModule}
            customers={customers}
            openCreateCustomerModal={openCreateCustomerModal}
            handleEditCustomer={handleEditCustomer}
            canCreateCustomer={canCreateCustomer}
            canEditCustomer={canEditCustomer}
            isSubUser={isSubUser}
            currentUserId={auth?.user?.id}
            pagedCustomers={pagedCustomers}
            customerPage={customerPage}
            setCustomerPage={setCustomerPage}
            PAGE_SIZE={PAGE_SIZE}
            renderPagination={renderPagination}
          />
        ) : activeModule === "Products" ? (
          <ProductsPage
            activeModule={activeModule}
            products={products}
            filteredProducts={filteredProducts}
            productSourceFilter={productSourceFilter}
            setProductSourceFilter={setProductSourceFilter}
            handleDownloadProductTemplate={handleDownloadProductTemplate}
            handleExcelProductUpload={handleExcelProductUpload}
            setShowSingleProductModal={setShowSingleProductModal}
            setShowProductUploadModal={setShowProductUploadModal}
            canCreateProduct={canCreateProduct}
            canEditProduct={canEditProduct}
            isPlatformAdmin={isPlatformAdmin}
            visibleCatalogueTableFields={visibleCatalogueTableFields}
            pagedProducts={pagedProducts}
            productPage={productPage}
            PAGE_SIZE={PAGE_SIZE}
            getProductFieldDisplayValue={getProductFieldDisplayValue}
            handleEditProduct={handleEditProduct}
            handleMoveProductToPrimary={handleMoveProductToPrimary}
            renderPagination={renderPagination}
            setProductPage={setProductPage}
            showProductUploadModal={showProductUploadModal}
            setProductUploadModalMessage={setProductUploadModalMessage}
            productUploadModalMessage={productUploadModalMessage}
            handleBulkProductUpload={handleBulkProductUpload}
            productUploadText={productUploadText}
            setProductUploadText={setProductUploadText}
            error={error}
            showSingleProductModal={showSingleProductModal}
            editingProductId={editingProductId}
            setEditingProductId={setEditingProductId}
            setSingleProductForm={setSingleProductForm}
            createInitialSingleProductForm={createInitialSingleProductForm}
            handleCreateSingleProduct={handleCreateSingleProduct}
            runtimeCatalogueFields={runtimeCatalogueFields}
            singleProductForm={singleProductForm}
            updateSingleProductField={updateSingleProductField}
            getConfiguredOptions={getConfiguredOptions}
            unsupportedRuntimeCatalogueFields={unsupportedRuntimeCatalogueFields}
            updateSingleProductCustomField={updateSingleProductCustomField}
            showProductPreviewModal={showProductPreviewModal}
            setShowProductPreviewModal={setShowProductPreviewModal}
            productPreviewRows={productPreviewRows}
            getProductPreviewFieldValue={getProductPreviewFieldValue}
            handleConfirmProductUpload={handleConfirmProductUpload}
          />
        ) : activeModule === "Help Center" ? (
          <HelpCenterPage
            activeModule={activeModule}
            isPlatformAdmin={isPlatformAdmin}
            isSubUser={isSubUser}
          />
        ) : activeModule === "Roles & Permissions" ? (
          <RbacMatrixPage isPlatformAdmin={isPlatformAdmin} />
        ) : activeModule === "Settings" ? (
          <SettingsPage
            currentModuleMeta={currentModuleMeta}
            isPlatformAdmin={isPlatformAdmin}
            seller={seller}
            sellers={sellers}
            platformFormulaRules={platformFormulaRules}
            platformUnitConversions={platformUnitConversions}
            platformFormulaLoading={platformFormulaLoading}
            handleCreatePlatformFormula={handleCreatePlatformFormula}
            handleUpdatePlatformFormula={handleUpdatePlatformFormula}
            handleDeletePlatformFormula={handleDeletePlatformFormula}
            handleCreatePlatformUnitConversion={handleCreatePlatformUnitConversion}
            handleUpdatePlatformUnitConversion={handleUpdatePlatformUnitConversion}
            handleDeletePlatformUnitConversion={handleDeletePlatformUnitConversion}
            THEME_OPTIONS={THEME_OPTIONS}
            theme={theme}
            setTheme={setTheme}
            businessName={businessName}
            setBusinessName={setBusinessName}
            brandColor={brandColor}
            setBrandColor={setBrandColor}
            quotationNumberPrefix={quotationNumberPrefix}
            setQuotationNumberPrefix={setQuotationNumberPrefix}
            sellerGstNumber={sellerGstNumber}
            setSellerGstNumber={setSellerGstNumber}
            bankName={bankName}
            setBankName={setBankName}
            bankBranch={bankBranch}
            setBankBranch={setBankBranch}
            bankAccountNo={bankAccountNo}
            setBankAccountNo={setBankAccountNo}
            bankIfsc={bankIfsc}
            setBankIfsc={setBankIfsc}
            handleSaveThemeSettings={handleSaveThemeSettings}
            decodeRules={decodeRules}
            setDecodeRules={setDecodeRules}
            handleSaveDecodeRules={handleSaveDecodeRules}
            quotationTemplate={quotationTemplate}
            setQuotationTemplate={setQuotationTemplate}
            QUOTATION_TEMPLATE_PRESETS={QUOTATION_TEMPLATE_PRESETS}
            QUOTATION_THEME_OPTIONS={QUOTATION_THEME_OPTIONS}
            applyQuotationTemplatePreset={applyQuotationTemplatePreset}
            applyQuotationThemeSelection={applyQuotationThemeSelection}
            handleQuotationHeaderImageChange={handleQuotationHeaderImageChange}
            handleQuotationLogoImageChange={handleQuotationLogoImageChange}
            handleQuotationFooterImageChange={handleQuotationFooterImageChange}
            quotationPreview={quotationPreview}
            renderTemplateText={renderTemplateText}
            handleSaveQuotationTemplate={handleSaveQuotationTemplate}
            usageOverview={usageOverview}
            setActiveModule={setActiveModule}
            canEditSettings={canEditSettings}
            currentSellerSubscription={currentSellerSubscription}
            getPlanTemplateAccessTier={getPlanTemplateAccessTier}
            isThemeAccessibleForTier={isThemeAccessibleForTier}
            fixedFreeFooterBanner={FIXED_FREE_FOOTER_BANNER}
          />
        ) : activeModule !== "Dashboard" ? (
          <section className="module-placeholder glass-panel">
            <h3>{activeModule}</h3>
            <p>This module keeps the same design system and is ready for functional workflows.</p>
          </section>
        ) : (
          <DashboardPage
            activeModule={activeModule}
            isPlatformAdmin={isPlatformAdmin}
            isSubUser={isSubUser}
            usageOverview={usageOverview}
            setActiveModule={setActiveModule}
            sellers={sellers}
            openSellerDetail={openSellerDetail}
            formatCurrency={formatCurrency}
            formatDateIST={formatDateIST}
            quotations={quotations}
            dashboardData={dashboardData}
            QUICK_ACTIONS={QUICK_ACTIONS}
            openQuotationWizard={openQuotationWizardWithSetupGuard}
            openCreateCustomerModal={openCreateCustomerModal}
            dashboardRange={dashboardRange}
            setDashboardRange={setDashboardRange}
            chartSeries={chartSeries}
            filteredOrders={filteredOrders}
            changeSort={changeSort}
            seller={seller}
            handleOpenOrderDetails={handleOpenOrderDetails}
            handleDownloadQuotation={handleDownloadQuotation}
            formatQuotationLabel={formatQuotationLabel}
            statusLabel={statusLabel}
            orderStatusLabel={orderStatusLabel}
            lowStockItems={lowStockItems}
            topSelling={topSelling}
            aiSuggestions={aiSuggestions}
            subUserAction={subUserAction}
            setSubUserAction={setSubUserAction}
            subUserSearchInput={subUserSearchInput}
            setSubUserSearchInput={setSubUserSearchInput}
            handleSubUserQuotationSearch={handleSubUserQuotationSearch}
            subUserQuotationResults={subUserQuotationResults}
            canCreateQuotation={canCreateQuotation}
            canSearchQuotation={canSearchQuotation}
            canDownloadQuotationPdf={canDownloadQuotationPdf}
            canCreateCustomer={canCreateCustomer}
            pendingApprovalCount={pendingApprovalCount}
            requesterPendingApprovalCount={requesterPendingApprovalCount}
          />
        )}

        <QuotationWizardModal
          showMessageSimulatorModal={showMessageSimulatorModal}
          closeQuotationWizard={closeQuotationWizard}
          quotationWizard={quotationWizard}
          setQuotationWizard={setQuotationWizard}
          quotationWizardCustomerMatches={quotationWizardCustomerMatches}
          updateQuotationWizardCustomerField={updateQuotationWizardCustomerField}
          updateQuotationWizardShippingAddress={updateQuotationWizardShippingAddress}
          addQuotationWizardShippingAddress={addQuotationWizardShippingAddress}
          removeQuotationWizardShippingAddress={removeQuotationWizardShippingAddress}
          runtimeSellerConfiguration={runtimeSellerConfiguration}
          runtimeQuotationColumns={runtimeQuotationColumns}
          quotationWizardItemRules={quotationWizardItemRules}
          updateQuotationWizardItemForm={updateQuotationWizardItemForm}
          unsupportedRuntimeQuotationColumns={unsupportedRuntimeQuotationColumns}
          getProductConfigurationFieldValue={getProductConfigurationFieldValue}
          quotationWizardSelectedProduct={quotationWizardSelectedProduct}
          updateQuotationWizardCustomField={updateQuotationWizardCustomField}
          handleAddQuotationWizardItem={handleAddQuotationWizardItem}
          startEditQuotationWizardItem={startEditQuotationWizardItem}
          cancelEditQuotationWizardItem={cancelEditQuotationWizardItem}
          quotationWizardItemReady={quotationWizardItemReady}
          formatCurrency={formatCurrency}
          calculateQuotationWizardItemTotal={calculateQuotationWizardItemTotal}
          handleRemoveQuotationWizardItem={handleRemoveQuotationWizardItem}
          getQuotationItemTitle={getQuotationItemTitle}
          getQuotationItemQuantityValue={getQuotationItemQuantityValue}
          getQuotationItemRateValue={getQuotationItemRateValue}
          getQuotationItemTotalValue={getQuotationItemTotalValue}
          quotationWizardGrossTotal={quotationWizardGrossTotal}
          quotationWizardGstAmount={quotationWizardGstAmount}
          quotationWizardTotalAmount={quotationWizardTotalAmount}
          quotationWizardDiscountAmount={quotationWizardDiscountAmount}
          quotationWizardAdvanceAmount={quotationWizardAdvanceAmount}
          quotationWizardBalanceAmount={quotationWizardBalanceAmount}
          quotationWizardGstMode={quotationWizardGstMode}
          showQuotationWizardNotice={showQuotationWizardNotice}
          formatDateIST={formatDateIST}
          quotationWizardSubmitting={quotationWizardSubmitting}
          error={error}
          quotationWizardNotice={quotationWizardNotice}
          quotationWizardCustomerGstValidation={quotationWizardCustomerGstValidation}
          quotationWizardShippingGstValidation={quotationWizardShippingGstValidation}
          quotationWizardMaterialSuggestions={quotationWizardMaterialSuggestions}
          quotationWizardVisibleVariantFields={quotationWizardVisibleVariantFields}
          validateQuotationWizardCustomerGst={validateQuotationWizardCustomerGst}
          validateQuotationWizardShippingGst={validateQuotationWizardShippingGst}
          handleQuotationWizardMaterialInput={handleQuotationWizardMaterialInput}
          handleQuotationWizardMaterialSelect={handleQuotationWizardMaterialSelect}
          handleQuotationWizardVariantSelection={handleQuotationWizardVariantSelection}
          handleSaveQuotationWizardSecondaryProduct={handleSaveQuotationWizardSecondaryProduct}
          handleSubmitQuotationWizard={handleSubmitQuotationWizard}
          handleQuotationWizardNext={handleQuotationWizardNext}
          handleQuotationWizardBack={handleQuotationWizardBack}
          quotationPreviewUrl={quotationPreviewUrl}
          quotationPreviewError={quotationPreviewError}
          downloadQuotationWizardPdf={downloadQuotationWizardPdf}
          formatQuotationLabel={formatQuotationLabel}
          handleOpenOrderDetails={handleOpenOrderDetails}
        />

        {showCustomerModal && (
          <div className="modal-overlay" onClick={closeCustomerModal}>
            <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>{editingCustomerId ? "Edit Customer" : "Create Customer"}</h3>
                <button type="button" className="ghost-btn" onClick={closeCustomerModal}>Close</button>
              </div>
              {error && <div className="notice error">{error}</div>}
              <form className="auth-card customer-form-card" onSubmit={handleCreateCustomer}>
                <div className="customer-form-grid">
                  <input placeholder="Customer name" value={customerForm.name} onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))} required disabled={customerGstValidation.status === "verified" && customerGstValidation.gstNumber === String(customerForm.gstNumber || "").trim().toUpperCase()} />
                  <input placeholder="Firm name" value={customerForm.firmName} onChange={(e) => setCustomerForm((prev) => ({ ...prev, firmName: e.target.value }))} disabled={customerGstValidation.status === "verified" && customerGstValidation.gstNumber === String(customerForm.gstNumber || "").trim().toUpperCase()} />
                  <input placeholder="Mobile" value={customerForm.mobile} onChange={(e) => setCustomerForm((prev) => ({ ...prev, mobile: e.target.value }))} />
                  <input placeholder="Email" type="email" value={customerForm.email} onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))} />
                  <textarea className="customer-form-wide" rows={3} placeholder="Billing / primary address" value={customerForm.address} onChange={(e) => setCustomerForm((prev) => ({ ...prev, address: e.target.value }))} disabled={customerGstValidation.status === "verified" && customerGstValidation.gstNumber === String(customerForm.gstNumber || "").trim().toUpperCase()} />
                  <div className="customer-form-wide" style={{ display: "grid", gap: "8px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input
                        placeholder="Customer GST Number (optional)"
                        value={customerForm.gstNumber}
                        onChange={(e) => {
                          const nextGstNumber = e.target.value.toUpperCase();
                          setCustomerForm((prev) => ({ ...prev, gstNumber: nextGstNumber }));
                          if (String(customerGstValidation.gstNumber || "") !== String(nextGstNumber || "").trim()) {
                            setCustomerGstValidation({ status: "idle", gstNumber: "", profile: null, message: "" });
                          }
                        }}
                        onBlur={async () => {
                          const gstNumber = String(customerForm.gstNumber || "").trim();
                          if (!gstNumber) return;
                          try {
                            await validateCustomerGstForForm(gstNumber);
                          } catch {
                            // Error is already set via handler.
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={async () => {
                          try {
                            await validateCustomerGstForForm(customerForm.gstNumber);
                            setError("");
                          } catch (err) {
                            handleApiError(err);
                          }
                        }}
                        disabled={customerGstValidation.status === "verifying" || !String(customerForm.gstNumber || "").trim()}
                      >
                        {customerGstValidation.status === "verifying" ? "Verifying..." : "Verify GST"}
                      </button>
                    </div>
                    {customerGstValidation.message ? (
                      <small style={{ color: customerGstValidation.status === "error" ? "#b42318" : "var(--muted)" }}>
                        {customerGstValidation.message}
                      </small>
                    ) : null}
                  </div>
                </div>
                <div className="customer-shipping-section">
                  <div className="customer-shipping-head">
                    <div>
                      <h4>Shipping Addresses</h4>
                      <p>Capture multiple warehouses. GST is optional, and same-state GST is reused automatically.</p>
                    </div>
                    <button type="button" className="secondary-button" onClick={handleAddCustomerShippingAddress}>Add Shipping Address</button>
                  </div>
                  <div className="customer-shipping-list">
                    {(customerForm.shippingAddresses || []).map((entry, index) => (
                      <div key={`shipping-${index}`} className="customer-shipping-card">
                        <div className="customer-shipping-card-head">
                          <strong>Address {index + 1}</strong>
                          {(customerForm.shippingAddresses || []).length > 1 ? (
                            <button type="button" className="text-button" onClick={() => handleRemoveCustomerShippingAddress(index)}>Remove</button>
                          ) : null}
                        </div>
                        <div className="customer-form-grid">
                          <input placeholder="Warehouse / label" value={entry.label || ""} onChange={(e) => handleCustomerShippingAddressChange(index, "label", e.target.value)} />
                          <input placeholder="State" value={entry.state || ""} onChange={(e) => handleCustomerShippingAddressChange(index, "state", e.target.value)} />
                          <input placeholder="Pincode" value={entry.pincode || ""} onChange={(e) => handleCustomerShippingAddressChange(index, "pincode", e.target.value)} />
                          <div style={{ display: "grid", gap: "6px" }}>
                            <input
                              placeholder="Warehouse GST Number (optional)"
                              value={entry.gstNumber || ""}
                              onChange={(e) => handleCustomerShippingAddressChange(index, "gstNumber", e.target.value.toUpperCase())}
                              onBlur={async () => {
                                const gstNumber = String(entry.gstNumber || "").trim();
                                if (!gstNumber) return;
                                try {
                                  await validateCustomerShippingGst(index, gstNumber);
                                } catch {
                                  // Message shown inline.
                                }
                              }}
                            />
                            {customerShippingGstValidation[index]?.message ? (
                              <small style={{ color: customerShippingGstValidation[index]?.status === "error" ? "#b42318" : "var(--muted)" }}>
                                {customerShippingGstValidation[index].message}
                              </small>
                            ) : null}
                          </div>
                          <textarea className="customer-form-wide" rows={2} placeholder="Shipping address" value={entry.address || ""} onChange={(e) => handleCustomerShippingAddressChange(index, "address", e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--muted)" }}>
                  <input type="checkbox" checked={customerForm.monthlyBilling} onChange={(e) => setCustomerForm((prev) => ({ ...prev, monthlyBilling: e.target.checked }))} style={{ width: "auto" }} />
                  Monthly Billing
                </label>
                <button type="submit">{editingCustomerId ? "Update Customer" : "Save Customer"}</button>
              </form>
            </div>
          </div>
        )}

        <SellerDetailModal
          showSellerDetailModal={showSellerDetailModal}
          closeSellerDetailModal={closeSellerDetailModal}
          sellerDetailLoading={sellerDetailLoading}
          selectedSellerDetail={selectedSellerDetail}
          getSellerLifecycleDraft={getSellerLifecycleDraft}
          updateSellerLifecycleDraft={updateSellerLifecycleDraft}
          SELLER_STATUS_OPTIONS={SELLER_STATUS_OPTIONS}
          plans={plans}
          SUBSCRIPTION_STATUS_OPTIONS={SUBSCRIPTION_STATUS_OPTIONS}
          formatCurrency={formatCurrency}
          formatDateTime={formatDateTime}
          formatAuditActionLabel={formatAuditActionLabel}
          openSellerConfigurationStudio={openSellerConfigurationStudio}
          openSubscriptionDetail={openSubscriptionDetail}
          handleSellerDetailSave={handleSellerDetailSave}
        />

        <ConfigurationStudio
          activeModule={activeModule}
          isPlatformAdmin={isPlatformAdmin}
          configurationStudioSeller={configurationStudioSeller}
          activeSellerConfiguration={activeSellerConfiguration}
          products={products}
          sellerConfigLoading={sellerConfigLoading}
          currentModuleMeta={currentModuleMeta}
          sellers={sellers}
          openSellerConfigurationStudio={openSellerConfigurationStudio}
          closeSellerConfigurationStudio={closeSellerConfigurationStudio}
          sellerConfigTab={sellerConfigTab}
          setSellerConfigTab={setSellerConfigTab}
          updateSellerConfigurationModule={updateSellerConfigurationModule}
          formatDateTime={formatDateTime}
          addCatalogueField={addCatalogueField}
          sortConfigEntries={sortConfigEntries}
          updateCatalogueField={updateCatalogueField}
          getOptionsInputValue={getOptionsInputValue}
          commitCatalogueFieldOptions={commitCatalogueFieldOptions}
          removeCatalogueField={removeCatalogueField}
          MANDATORY_SYSTEM_CATALOGUE_KEYS={MANDATORY_SYSTEM_CATALOGUE_KEYS}
          normalizeConfigKey={normalizeConfigKey}
          addQuotationColumn={addQuotationColumn}
          updateQuotationColumn={updateQuotationColumn}
          commitQuotationColumnOptions={commitQuotationColumnOptions}
          removeQuotationColumn={removeQuotationColumn}
          updateItemDisplayConfig={updateItemDisplayConfig}
          sellerConfigPreviewTab={sellerConfigPreviewTab}
          setSellerConfigPreviewTab={setSellerConfigPreviewTab}
          renderConfigurationPreviewControl={renderConfigurationPreviewControl}
          publishSellerConfiguration={publishSellerConfiguration}
          saveSellerConfigurationDraft={saveSellerConfigurationDraft}
          canEditConfiguration={canEditConfiguration}
          canSaveConfigurationDraft={canSaveConfigurationDraft}
          canPublishConfiguration={canPublishConfiguration}
          sellerConfigSaving={sellerConfigSaving}
          sellerConfigPublishing={sellerConfigPublishing}
        />

        <PlanDetailModal
          showPlanDetailModal={showPlanDetailModal}
          selectedPlanDetail={selectedPlanDetail}
          closePlanDetailModal={closePlanDetailModal}
          getPlanDraft={getPlanDraft}
          updatePlanDraft={updatePlanDraft}
          BILLING_CYCLE_OPTIONS={BILLING_CYCLE_OPTIONS}
          handlePlanDetailSave={handlePlanDetailSave}
        />

        {showNotificationCreateModal && (
          <div className="modal-overlay" onClick={() => setShowNotificationCreateModal(false)}>
            <div className="modal-card glass-panel" onClick={(event) => event.stopPropagation()}>
              <div className="section-head">
                <h3>Create Notification</h3>
                <button type="button" className="ghost-btn" onClick={() => setShowNotificationCreateModal(false)}>Close</button>
              </div>
              <form className="compact-form" onSubmit={handleCreateNotification}>
                <div className="seller-lifecycle-grid">
                  <label>
                    <span>Title</span>
                    <input value={notificationForm.title} onChange={(e) => setNotificationForm((prev) => ({ ...prev, title: e.target.value }))} required />
                  </label>
                  <label>
                    <span>Audience</span>
                    <select value={notificationForm.audienceType} onChange={(e) => setNotificationForm((prev) => ({ ...prev, audienceType: e.target.value }))}>
                      <option value="all_sellers">All Sellers</option>
                      <option value="active_sellers">Active Sellers</option>
                      <option value="trial_users">Trial Users</option>
                      <option value="expiring_trials">Expiring Trials</option>
                      <option value="specific_seller">Specific Seller</option>
                    </select>
                  </label>
                  <label>
                    <span>Channel</span>
                    <select value={notificationForm.channel} onChange={(e) => setNotificationForm((prev) => ({ ...prev, channel: e.target.value }))}>
                      <option value="in_app">In-App</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                    </select>
                  </label>
                  {!notificationForm.sendNow && (
                    <label>
                      <span>Schedule</span>
                      <input type="datetime-local" value={notificationForm.scheduledAt} onChange={(e) => setNotificationForm((prev) => ({ ...prev, scheduledAt: e.target.value }))} />
                    </label>
                  )}
                  {notificationForm.audienceType === "specific_seller" && (
                    <label>
                      <span>Seller</span>
                      <select value={notificationForm.sellerId} onChange={(e) => setNotificationForm((prev) => ({ ...prev, sellerId: e.target.value }))} required>
                        <option value="">Select Seller</option>
                        {sellers.map((sellerRow) => <option key={sellerRow.id} value={sellerRow.id}>{sellerRow.name} ({sellerRow.seller_code})</option>)}
                      </select>
                    </label>
                  )}
                  <label className="seller-toggle seller-toggle-inline">
                    <input type="checkbox" checked={notificationForm.sendNow} onChange={(e) => setNotificationForm((prev) => ({ ...prev, sendNow: e.target.checked }))} style={{ width: "auto" }} />
                    Send now
                  </label>
                </div>
                <label style={{ display: "grid", gap: "6px", color: "var(--muted)" }}>
                  <span>Message</span>
                  <textarea rows={5} value={notificationForm.message} onChange={(e) => setNotificationForm((prev) => ({ ...prev, message: e.target.value }))} required />
                </label>
                <div className="modal-fixed-actions">
                  <button type="button" className="ghost-btn" onClick={() => setShowNotificationCreateModal(false)}>Close</button>
                  <button type="submit">Create Notification</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <NotificationDetailModal
          showNotificationDetailModal={showNotificationDetailModal}
          closeNotificationDetailModal={closeNotificationDetailModal}
          notificationDetailLoading={notificationDetailLoading}
          selectedNotificationDetail={selectedNotificationDetail}
          formatDateTime={formatDateTime}
        />

        <SellerNotificationsModal
          showSellerNotificationsModal={showSellerNotificationsModal}
          setShowSellerNotificationsModal={setShowSellerNotificationsModal}
          isPlatformAdmin={isPlatformAdmin}
          notifications={notifications}
          handleOpenSellerNotification={handleOpenSellerNotification}
          formatDateTime={formatDateTime}
        />

        <SubscriptionDetailModal
          showSubscriptionModal={showSubscriptionModal}
          selectedSellerSubscription={selectedSellerSubscription}
          closeSubscriptionModal={closeSubscriptionModal}
          subscriptionModalDraft={subscriptionModalDraft}
          setSubscriptionModalDraft={setSubscriptionModalDraft}
          plans={plans}
          SUBSCRIPTION_STATUS_OPTIONS={SUBSCRIPTION_STATUS_OPTIONS}
          handleSaveSubscriptionModal={handleSaveSubscriptionModal}
          canConvertToPaid={canConvertToPaid}
          handleConvertToPaid={handleConvertToPaid}
          formatDateIST={formatDateIST}
          formatDateTime={formatDateTime}
          formatAuditActionLabel={formatAuditActionLabel}
        />

        {!cookieConsent ? (
          <div className="cookie-consent-banner" role="dialog" aria-live="polite" aria-label="Cookie consent">
            <p>We use cookies to improve performance and user experience. Please accept or reject cookies to continue.</p>
            <div className="cookie-consent-actions">
              <button type="button" className="ghost-btn" onClick={() => handleCookieConsentDecision("rejected")}>Reject</button>
              <button type="button" onClick={() => handleCookieConsentDecision("accepted")}>Accept</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default App;

































































