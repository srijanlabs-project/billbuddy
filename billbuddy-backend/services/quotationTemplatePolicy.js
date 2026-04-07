function normalizeTemplatePreset(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "default") return "default";
  if (normalized === "commercial_offer") return "commercial_offer";
  if (normalized === "invoice_classic") return "invoice_classic";
  if (normalized === "executive_boardroom") return "executive_boardroom";
  if (normalized === "industrial_invoice") return "industrial_invoice";
  if (normalized === "html_puppeteer") return "html_puppeteer";
  return "commercial_offer";
}

const QUOTATION_THEME_OPTIONS = {
  default: {
    key: "default",
    accessTier: "FREE",
    accent: "#737373",
    header: "#4B5563",
    surface: "#F3F4F6",
    border: "#D1D5DB",
    text: "#111827",
    muted: "#6B7280"
  },
  royal_blue: {
    key: "royal_blue",
    accessTier: "PAID",
    accent: "#1D4ED8",
    header: "#1D4ED8",
    surface: "#DBEAFE",
    border: "#93C5FD",
    text: "#1E3A8A",
    muted: "#475569"
  },
  slate_professional: {
    key: "slate_professional",
    accessTier: "PAID",
    accent: "#374151",
    header: "#1F2937",
    surface: "#F3F4F6",
    border: "#CBD5E1",
    text: "#111827",
    muted: "#6B7280"
  },
  warm_ivory: {
    key: "warm_ivory",
    accessTier: "PAID",
    accent: "#0F3D56",
    header: "#0F3D56",
    surface: "#F8F3EC",
    border: "#E0D4C5",
    text: "#4B3B2F",
    muted: "#7A6A58"
  },
  forest_ledger: {
    key: "forest_ledger",
    accessTier: "PAID",
    accent: "#166534",
    header: "#166534",
    surface: "#DCFCE7",
    border: "#86EFAC",
    text: "#14532D",
    muted: "#4D6B57"
  },
  steel_grid: {
    key: "steel_grid",
    accessTier: "PAID",
    accent: "#334155",
    header: "#334155",
    surface: "#E2E8F0",
    border: "#94A3B8",
    text: "#1F2937",
    muted: "#475569"
  },
  frosted_aura: {
    key: "frosted_aura",
    accessTier: "PAID",
    accent: "#5C7E8F",
    header: "#5C7E8F",
    surface: "#D4DDE2",
    border: "#A2A2A2",
    text: "#374151",
    muted: "#6B7280"
  },
  sorbet: {
    key: "sorbet",
    accessTier: "PREMIUM",
    accent: "#BA9A91",
    header: "#B7C396",
    surface: "#EDECEC",
    border: "#CCCCCC",
    text: "#4B5563",
    muted: "#7A6E68"
  },
  calcite: {
    key: "calcite",
    accessTier: "PREMIUM",
    accent: "#FD7B41",
    header: "#3C4044",
    surface: "#EDBF9B",
    border: "#DDDCDB",
    text: "#3C4044",
    muted: "#7C5E4E"
  },
  lapis_velvet_evening: {
    key: "lapis_velvet_evening",
    accessTier: "PREMIUM",
    accent: "#893172",
    header: "#213885",
    surface: "#ECDFD2",
    border: "#CCCACC",
    text: "#213885",
    muted: "#5B6475"
  },
  opaline: {
    key: "opaline",
    accessTier: "PREMIUM",
    accent: "#FF634A",
    header: "#FF634A",
    surface: "#E7E7E7",
    border: "#D2D2D4",
    text: "#374151",
    muted: "#6B7280"
  },
  tropical_heat: {
    key: "tropical_heat",
    accessTier: "NICHE",
    accent: "#EB4203",
    header: "#00CEC8",
    surface: "#FCEFC3",
    border: "#FF9C5F",
    text: "#8A3600",
    muted: "#0C6663"
  },
  honey_opal_sunset: {
    key: "honey_opal_sunset",
    accessTier: "NICHE",
    accent: "#ECB914",
    header: "#4F3D35",
    surface: "#F6D579",
    border: "#CBB8A0",
    text: "#4F3D35",
    muted: "#7C5D26"
  },
  seashell_garnet_afternoon: {
    key: "seashell_garnet_afternoon",
    accessTier: "NICHE",
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
      <text x="1455" y="46" font-family="Arial, sans-serif" font-size="20" fill="#d4a938">&#10022;</text>
      <text x="1490" y="60" font-family="Arial, sans-serif" font-size="14" fill="#e5c56a">&#10022;</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const FIXED_FREE_FOOTER_BANNER = createFixedFreeFooterBannerDataUrl();

function normalizeTemplateThemeKey(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return QUOTATION_THEME_OPTIONS[normalized] ? normalized : "default";
}

function getQuotationThemeConfig(themeKey, accentOverride = null) {
  const config = QUOTATION_THEME_OPTIONS[normalizeTemplateThemeKey(themeKey)] || QUOTATION_THEME_OPTIONS.default;
  return {
    ...config,
    accent: accentOverride || config.accent
  };
}

function getSubscriptionTemplateAccessTier(subscription) {
  if (!subscription) return "FREE";
  if (Boolean(subscription.is_demo_plan)) return "FREE";
  const tier = String(subscription.template_access_tier || "").trim().toUpperCase();
  return ["FREE", "PAID", "PREMIUM", "NICHE"].includes(tier) ? tier : "FREE";
}

function isThemeAccessibleForTier(themeTier, planTier) {
  const order = { FREE: 0, PAID: 1, PREMIUM: 2, NICHE: 3 };
  const normalizedThemeTier = order[themeTier] !== undefined ? themeTier : "FREE";
  const normalizedPlanTier = order[planTier] !== undefined ? planTier : "FREE";
  return order[normalizedPlanTier] >= order[normalizedThemeTier];
}

function applyTemplateAccessPolicy(template, subscription) {
  const currentPlanTier = getSubscriptionTemplateAccessTier(subscription);
  const requestedThemeKey = normalizeTemplateThemeKey(template?.template_theme_key);
  const themeConfig = getQuotationThemeConfig(requestedThemeKey, template?.accent_color || null);
  const accessible = isThemeAccessibleForTier(themeConfig.accessTier, currentPlanTier);

  if (!accessible || currentPlanTier === "FREE") {
    const freeTheme = getQuotationThemeConfig("default");
    return {
      ...template,
      template_preset: "default",
      template_theme_key: "default",
      accent_color: freeTheme.accent,
      footer_image_data: FIXED_FREE_FOOTER_BANNER,
      show_footer_image: true
    };
  }

  return {
    ...template,
    template_preset: normalizeTemplatePreset(template?.template_preset || "default"),
    template_theme_key: requestedThemeKey,
    accent_color: themeConfig.accent
  };
}

module.exports = {
  FIXED_FREE_FOOTER_BANNER,
  QUOTATION_THEME_OPTIONS,
  applyTemplateAccessPolicy,
  getQuotationThemeConfig,
  getSubscriptionTemplateAccessTier,
  isThemeAccessibleForTier,
  normalizeTemplatePreset,
  normalizeTemplateThemeKey
};
