import { useMemo, useState } from "react";

const GUIDE_SECTIONS = [
  {
    id: "getting-started",
    title: "Getting Started",
    roles: ["all"],
    body:
      "Quotsy is a quotation-first workspace. Start by setting up your business profile, quotation branding, and catalogue. Once that foundation is ready, your team can create quotations, manage customers, and download PDFs without repeated manual setup.",
    bullets: [
      "Complete Business Settings with company identity, GST, bank details, and quotation format.",
      "Use Configuration Studio to define catalogue fields and quotation columns for your business.",
      "Add products to the main catalogue or let teams create secondary catalogue items during quotation creation.",
      "Create customers, then generate quotations with preview and PDF download."
    ]
  },
  {
    id: "roles",
    title: "Roles and Access",
    roles: ["all"],
    body:
      "Quotsy supports role-based access. Platform users manage tenants and plans, seller admins manage operations, and sub-users work inside a focused quotation workflow.",
    bullets: [
      "Platform Admin: manages leads, sellers, subscriptions, plans, notifications, and platform settings.",
      "Seller Admin / Master User: manages users, products, customers, settings, configurations, and quotations for one seller account.",
      "Sub User: gets a focused workspace with Create Quotation and Search Quotation actions."
    ]
  },
  {
    id: "create-quotation",
    title: "Create Quotation",
    roles: ["seller", "sub-user"],
    body:
      "Use the quotation wizard to capture customer details, add items, review totals, preview the PDF, and submit. The same wizard supports new customer creation, product matching, and secondary catalogue creation.",
    bullets: [
      "Select a customer or create a new customer inside the wizard.",
      "Choose a material or service using autosuggestion and variant selection.",
      "Add a secondary catalogue product if the exact item does not exist in the main catalogue.",
      "Preview the quotation before final submit and PDF download."
    ]
  },
  {
    id: "catalogue-and-secondary",
    title: "Catalogue and Secondary Catalogue",
    roles: ["seller", "sub-user"],
    body:
      "Primary catalogue contains the seller's structured master items. Secondary catalogue is created from live quotation entry and remains available only within that seller account for master and sub-users.",
    bullets: [
      "Use primary catalogue for stable products and standard pricing.",
      "Use secondary catalogue when the team needs to save a new item while creating a quotation.",
      "Variant-based selection can resolve item combinations like material, colour, size, or thickness."
    ]
  },
  {
    id: "configuration-studio",
    title: "Configuration Studio",
    roles: ["seller", "platform"],
    body:
      "Configuration Studio controls the structure of the catalogue and quotation system. This is where sellers define which fields exist, which columns appear in quotations, and how publishing works.",
    bullets: [
      "Catalogue Fields define item master structure.",
      "Quotation Columns define quotation line-item structure, PDF columns, and helping text.",
      "Draft and Publish help you test safely before making config live."
    ]
  },
  {
    id: "pdf-branding",
    title: "Quotation PDF and Branding",
    roles: ["seller", "sub-user"],
    body:
      "Quotation PDFs can use presets, seller branding, header image, logo-only mode, and business details. If a full header image is enabled, the system suppresses overlapping header text.",
    bullets: [
      "Use Settings to upload header image or logo.",
      "Choose a quotation template preset based on the business use case.",
      "Seller GST, customer GST, and warehouse GST appear where relevant in supported templates."
    ]
  },
  {
    id: "demo-onboarding",
    title: "Demo Onboarding and Sample Data",
    roles: ["platform", "seller"],
    body:
      "Demo onboarding can seed sample products, customers, quotation settings, and default configurations based on business category and segment. This gives demo users a relevant starting workspace.",
    bullets: [
      "Business category and segment drive template seeding.",
      "Sample data is tenant-specific and does not affect other sellers.",
      "Branding collected during onboarding is applied to quotation settings."
    ]
  }
];

const FAQS = [
  { topic: "Getting Started", question: "What is Quotsy used for?", answer: "Quotsy is a quotation-first system used to manage customers, products, quotation creation, PDF output, configuration, and seller-specific workflows.", roles: ["all"], tags: ["overview", "getting started"] },
  { topic: "Getting Started", question: "What should I set up first after login?", answer: "Start with Business Settings, then Configuration Studio, then Product Catalogue, then Customers. After that the quotation flow becomes much smoother.", roles: ["seller"], tags: ["setup", "first steps"] },
  { topic: "Getting Started", question: "Why does the system feel different for platform, seller, and sub-user roles?", answer: "Each role sees only the modules relevant to its work. Platform users manage tenants, seller users manage operations, and sub-users get a simplified quotation workflow.", roles: ["all"], tags: ["roles", "navigation"] },
  { topic: "Login and Access", question: "How do password login and OTP login differ?", answer: "Password login uses the standard auth route. OTP login sends a mobile OTP and verifies it before creating the same authenticated session.", roles: ["all"], tags: ["otp", "password", "login"] },
  { topic: "Login and Access", question: "Why do I see a platform setup screen on login?", answer: "The platform setup screen should appear only on the first deployment when there is no platform admin user yet. Normal login is used after the first admin is created.", roles: ["all"], tags: ["bootstrap", "platform setup"] },
  { topic: "Login and Access", question: "How do I know whether I am logged in as platform admin or seller user?", answer: "The navigation and visible modules change by role. Platform admin sees modules like Leads, Sellers, Plans, and Notifications, while seller users see quotation operations and business settings.", roles: ["all"], tags: ["platform admin", "seller"] },
  { topic: "Roles and Permissions", question: "What can a Sub User do?", answer: "Sub Users are designed for focused operations. They can create quotations, create customers inside the wizard, save secondary catalogue items, search quotations, and download PDFs.", roles: ["sub-user", "seller"], tags: ["sub user", "permissions"] },
  { topic: "Roles and Permissions", question: "Can a Sub User access Settings or Configuration Studio?", answer: "No. Sub Users are intentionally restricted to a simpler quotation workflow and do not get configuration or settings access.", roles: ["sub-user", "seller"], tags: ["sub user", "settings", "configuration"] },
  { topic: "Roles and Permissions", question: "What should platform admins manage from the control plane?", answer: "Platform admins should manage leads, sellers, subscriptions, plans, notifications, onboarding, and tenant-level governance, not day-to-day seller quotation work.", roles: ["platform"], tags: ["platform", "admin"] },
  { topic: "Customers", question: "How do I add a new customer?", answer: "You can add a customer from the Customers module or directly inside Create Quotation when the customer does not already exist.", roles: ["seller", "sub-user"], tags: ["customers", "create"] },
  { topic: "Customers", question: "Is customer GST mandatory?", answer: "No. Customer GST is optional. You can still create the customer and quotation without it.", roles: ["seller", "sub-user"], tags: ["customer gst", "optional"] },
  { topic: "Customers", question: "Can a customer have multiple shipping addresses?", answer: "Yes. Each customer can have multiple shipping addresses, and each shipping location can also store its own warehouse GST number.", roles: ["seller", "sub-user"], tags: ["shipping address", "warehouse"] },
  { topic: "Customers", question: "How does same-state GST reuse work for shipping addresses?", answer: "If one shipping address in a state already has a GST number, Quotsy can reuse that GST for another address in the same state when the new entry is blank.", roles: ["seller", "sub-user"], tags: ["gst reuse", "same state"] },
  { topic: "Products and Catalogue", question: "What is the difference between primary catalogue and secondary catalogue?", answer: "Primary catalogue is the structured main master. Secondary catalogue stores new items created during quotation entry and remains available only inside that seller account.", roles: ["seller", "sub-user"], tags: ["primary catalogue", "secondary catalogue"] },
  { topic: "Products and Catalogue", question: "Why do I see the same material name only once during selection?", answer: "The item selector is designed to guide users through variants. You usually select the material first, then choose variant attributes like colour, size, or thickness.", roles: ["seller", "sub-user"], tags: ["variants", "material selector"] },
  { topic: "Products and Catalogue", question: "How do dependent selectors like colour and size work?", answer: "Once you select a material, Quotsy shows only the valid variant options available for that material. After you choose one variant like colour, the next selector shows only matching values such as size.", roles: ["seller", "sub-user"], tags: ["colour", "size", "variants"] },
  { topic: "Products and Catalogue", question: "Can I upload products using Excel?", answer: "Yes. Download the catalogue template, fill the supported fields, and upload it back. The upload follows the seller's published catalogue configuration.", roles: ["seller"], tags: ["excel", "upload", "products"] },
  { topic: "Products and Catalogue", question: "What are system fields in catalogue configuration?", answer: "System fields are protected fields such as Product or Service Name, SKU ID, and Category. They are mandatory and cannot be removed from the live catalogue structure.", roles: ["seller", "platform"], tags: ["system fields", "catalogue config"] },
  { topic: "Secondary Catalogue", question: "When should I use Save To Secondary Catalogue?", answer: "Use it when you are creating a quotation and the exact product or service is not already available in the main catalogue, but you want to save it for reuse.", roles: ["seller", "sub-user"], tags: ["secondary catalogue", "save from quotation"] },
  { topic: "Secondary Catalogue", question: "Who can access secondary catalogue items?", answer: "Secondary catalogue items are seller-scoped. They are available to that seller's master users and sub-users, not to other sellers or the platform globally.", roles: ["seller", "sub-user"], tags: ["tenant scope", "secondary catalogue"] },
  { topic: "Secondary Catalogue", question: "Do secondary catalogue items become part of the main catalogue automatically?", answer: "No. They are stored as secondary catalogue entries so the seller can use them, but they stay distinct from the primary structured catalogue.", roles: ["seller", "sub-user"], tags: ["secondary catalogue", "primary catalogue"] },
  { topic: "Create Quotation", question: "How do I create a quotation?", answer: "Open Create Quotation, select or create a customer, add items, review totals, preview the PDF, and submit.", roles: ["seller", "sub-user"], tags: ["quotation", "wizard", "create"] },
  { topic: "Create Quotation", question: "Can I create a new customer during quotation creation?", answer: "Yes. In the customer step, switch to New Customer and fill the customer details directly without leaving the wizard.", roles: ["seller", "sub-user"], tags: ["new customer", "quotation wizard"] },
  { topic: "Create Quotation", question: "Why is the product selector search-based instead of a simple dropdown?", answer: "Search-based selection is faster for large catalogues and supports variant flows like material, colour, thickness, or size without cluttering the UI with duplicate entries.", roles: ["seller", "sub-user"], tags: ["autosuggest", "dropdown"] },
  { topic: "Create Quotation", question: "Why can I not add an item when I reduce the rate?", answer: "If the linked product has Limit Rate Edit enabled, Quotsy checks the Max Discount Limit and blocks the item if the rate falls below the allowed minimum. The limit can be defined as a percentage like 10% or a fixed amount like 100.", roles: ["seller", "sub-user"], tags: ["rate validation", "max discount"] },
  { topic: "Create Quotation", question: "Do rate-edit rules block higher prices too?", answer: "No. The current control checks only decreases. Higher edited rates are allowed.", roles: ["seller", "sub-user"], tags: ["pricing", "rate edit"] },
  { topic: "Create Quotation", question: "Why does the system show an error only when the rate is invalid?", answer: "This is intentional. Quotsy keeps the form cleaner by showing the allowed minimum only when the entered rate violates the configured discount rule.", roles: ["seller", "sub-user"], tags: ["errors", "rate validation"] },
  { topic: "Create Quotation", question: "What happens in the preview step?", answer: "The preview step generates a lightweight preview PDF so the user can quickly review the quotation before final submit and full template download.", roles: ["seller", "sub-user"], tags: ["preview", "quotation"] },
  { topic: "Quotation Search and Download", question: "How does Search Quotation work for sub-users?", answer: "Type a customer name or mobile number. Matching quotations appear as suggestions, and the user can directly download the PDF.", roles: ["sub-user"], tags: ["search", "quotation", "pdf"] },
  { topic: "Quotation Search and Download", question: "What does the top header search do?", answer: "Header search looks for quotations by quotation number, customer name, firm name, and mobile number. It also shows direct PDF download in the suggestion list.", roles: ["seller"], tags: ["header search", "quotation search"] },
  { topic: "Quotation Search and Download", question: "Can I download a quotation PDF without opening quotation details?", answer: "Yes. In quotation search suggestions and in sub-user search results, Quotsy provides a direct PDF download action.", roles: ["seller", "sub-user"], tags: ["download", "pdf"] },
  { topic: "Quotation Search and Download", question: "Why is quotation search based on customer data?", answer: "Many operational teams remember customer name or mobile faster than quotation number, so search is optimized around those real usage patterns.", roles: ["seller", "sub-user"], tags: ["search", "customer name", "mobile"] },
  { topic: "Quotation PDF and Branding", question: "Can I upload only a logo instead of a full header image?", answer: "Yes. Business Settings supports logo-only mode and full header image mode. If a full header image is enabled, header text is suppressed to avoid overlap.", roles: ["seller"], tags: ["branding", "logo", "header image"] },
  { topic: "Quotation PDF and Branding", question: "What happens when header image is enabled?", answer: "When header image is enabled, Quotsy treats it as the owner of the header area and suppresses header text and logo overlays to avoid visual conflicts.", roles: ["seller"], tags: ["header image", "branding"] },
  { topic: "Quotation PDF and Branding", question: "Why does quotation preview load faster than final PDF download?", answer: "Preview uses a lightweight simple PDF path, while final PDF download can use the seller's full selected template renderer such as HTML Puppeteer or a richer invoice layout.", roles: ["seller", "sub-user"], tags: ["preview", "performance", "pdf"] },
  { topic: "Quotation PDF and Branding", question: "Where do seller GST and customer GST come from in PDF?", answer: "Seller GST comes from Business Settings. Customer GST comes from the customer master, and warehouse GST is used where shipping address matching applies.", roles: ["seller", "sub-user"], tags: ["gst", "pdf", "customer"] },
  { topic: "Quotation PDF and Branding", question: "Can different sellers use different PDF templates?", answer: "Yes. Quotation template presets are seller-specific, and the selected template is applied when that seller downloads a quotation PDF.", roles: ["seller", "platform"], tags: ["template preset", "seller-specific"] },
  { topic: "GST and Shipping", question: "Is seller GST mandatory?", answer: "No. Seller GST can be captured in Business Settings, but the field is not mandatory.", roles: ["seller"], tags: ["seller gst", "optional"] },
  { topic: "GST and Shipping", question: "Is customer GST mandatory?", answer: "No. Customer GST is optional and can be filled only when available.", roles: ["seller", "sub-user"], tags: ["customer gst", "optional"] },
  { topic: "GST and Shipping", question: "Can each warehouse have a separate GST number?", answer: "Yes. Each shipping address entry can store its own GST number so warehouse-specific billing and dispatch logic can be represented correctly.", roles: ["seller", "sub-user"], tags: ["warehouse gst", "shipping address"] },
  { topic: "GST and Shipping", question: "How does Quotsy choose warehouse GST for PDF?", answer: "Quotsy first tries to match warehouse or shipping GST using the quotation delivery address or pincode. If no warehouse GST applies, it falls back to the customer GST.", roles: ["seller", "sub-user"], tags: ["warehouse gst", "pdf"] },
  { topic: "Configuration Studio", question: "What is Configuration Studio used for?", answer: "It defines catalogue fields, quotation columns, helping text, preview behavior, and published configuration for a seller.", roles: ["seller", "platform"], tags: ["configuration", "studio", "fields"] },
  { topic: "Configuration Studio", question: "What is the difference between Save Draft and Publish?", answer: "Save Draft stores your current changes without making them live. Publish makes the latest configuration active for runtime usage.", roles: ["seller", "platform"], tags: ["draft", "publish"] },
  { topic: "Configuration Studio", question: "What is helping text in quotation columns?", answer: "Helping text is supporting item detail that appears below the item name in the PDF, instead of becoming a full table column.", roles: ["seller", "platform"], tags: ["helping text", "quotation columns"] },
  { topic: "Configuration Studio", question: "What is a formula column?", answer: "A formula column is a calculated quotation field. Instead of manual user entry, the system computes it during quotation save using supported variables and the configured expression.", roles: ["seller", "platform"], tags: ["formula", "quotation columns"] },
  { topic: "Configuration Studio", question: "What happens if I change the sequence of fields?", answer: "Sequence controls how fields are ordered in configuration-driven views such as catalogue forms, quotation fields, and PDF-oriented display order where supported.", roles: ["seller", "platform"], tags: ["sequence", "display order"] },
  { topic: "Business Settings", question: "What belongs in Business Settings?", answer: "Business Settings stores seller identity, GST, bank details, quotation numbering, theme, decode rules, and quotation template branding and content.", roles: ["seller"], tags: ["business settings", "branding"] },
  { topic: "Business Settings", question: "Why are bank details stored once in seller settings?", answer: "Bank details are seller-level details reused across customers and quotations, so they are managed once in Business Settings instead of inside each quotation.", roles: ["seller"], tags: ["bank details", "seller settings"] },
  { topic: "Business Settings", question: "What is quotation number prefix?", answer: "Quotation number prefix is the seller-specific prefix used to build visible quotation numbers like QTN-0001 or SL-0001.", roles: ["seller"], tags: ["quotation prefix", "numbering"] },
  { topic: "Business Settings", question: "What is Message Decode Formula?", answer: "Message Decode Formula is a line-based message parsing setup meant for structured WhatsApp-like inputs. It is currently not used in most live flows and stays collapsed by default.", roles: ["seller"], tags: ["decode formula", "whatsapp"] },
  { topic: "Demo Onboarding and Sample Data", question: "How do sample demo accounts get their products and settings?", answer: "Sample data is seeded from category-based onboarding templates in the backend. That includes fields, quotation config, template defaults, products, and customers.", roles: ["platform", "seller"], tags: ["demo", "sample data", "onboarding"] },
  { topic: "Demo Onboarding and Sample Data", question: "Where does the sample data actually come from?", answer: "The current sample data comes from backend onboarding seed templates defined in the onboarding template service, not from a platform-managed UI yet.", roles: ["platform", "seller"], tags: ["sample data source", "onboarding templates"] },
  { topic: "Demo Onboarding and Sample Data", question: "What does business category and segment affect during demo creation?", answer: "Business category and segment determine the seeded catalogue fields, quotation columns, template defaults, and optional sample products and customers.", roles: ["platform", "seller"], tags: ["business category", "segment", "demo"] },
  { topic: "Demo Onboarding and Sample Data", question: "What happens if the user says no to sample data?", answer: "Quotsy still applies the category-driven configuration template, but it does not insert sample products or sample customers into that tenant.", roles: ["platform", "seller"], tags: ["sample data", "demo onboarding"] },
  { topic: "Subscriptions and Limits", question: "Where do I see subscription status?", answer: "Seller users can see subscription information in the seller workspace. Platform admins can review subscriptions in the platform Subscriptions module.", roles: ["seller", "platform"], tags: ["subscriptions", "plan"] },
  { topic: "Subscriptions and Limits", question: "Why do I see an upgrade card in the seller workspace?", answer: "The seller workspace can show subscription messaging when the tenant is near a limit, in trial, or eligible for a plan upgrade suggestion.", roles: ["seller"], tags: ["upgrade", "subscription card"] },
  { topic: "Subscriptions and Limits", question: "Can sub-users manage subscriptions?", answer: "No. Subscription and plan management are not part of the sub-user workflow.", roles: ["sub-user", "seller"], tags: ["sub user", "subscriptions"] },
  { topic: "Troubleshooting", question: "Why is a product not appearing in quotation item selection?", answer: "Usually this happens because the catalogue item does not match the current variant path, the seller configuration hides the selector, or the exact product is not in the catalogue yet.", roles: ["seller", "sub-user"], tags: ["product selection", "quotation"] },
  { topic: "Troubleshooting", question: "Why is header text overlapping on a PDF?", answer: "If a full header image is enabled but the template path is not respecting suppression correctly, the image and text can conflict. The intended behavior is for header image mode to suppress text and logo overlays.", roles: ["seller"], tags: ["header image", "pdf issue"] },
  { topic: "Troubleshooting", question: "Why is a field not showing in PDF even though it exists in configuration?", answer: "Check whether the field is marked for PDF visibility, whether it is being treated as helping text, and whether the selected template respects that field in the current layout.", roles: ["seller", "platform"], tags: ["pdf field", "configuration"] },
  { topic: "Troubleshooting", question: "Why does the system show old data in quotation quantity or rate?", answer: "This usually means the saved quotation row contains the older persisted value. New logic can fix future saves, but previously saved quotation records may still reflect older stored data until recreated or revised.", roles: ["seller"], tags: ["saved data", "quotation issue"] },
  { topic: "Troubleshooting", question: "What should I do if a modal error appears in the wrong place?", answer: "The intended behavior is for modal errors to appear inside the active modal. If the message still appears on the base page, that flow needs modal-level error wiring.", roles: ["seller", "platform", "sub-user"], tags: ["modal", "errors"] }
];

function roleMatches(itemRoles, viewerRole) {
  return itemRoles.includes("all") || itemRoles.includes(viewerRole);
}

export default function HelpCenterPage(props) {
  const { activeModule, isPlatformAdmin, isSubUser } = props;
  const [searchTerm, setSearchTerm] = useState("");
  const [openTopics, setOpenTopics] = useState({});
  const viewerRole = isPlatformAdmin ? "platform" : isSubUser ? "sub-user" : "seller";
  const normalized = searchTerm.trim().toLowerCase();

  const filteredGuide = useMemo(() => {
    return GUIDE_SECTIONS.filter((section) => {
      if (!roleMatches(section.roles, viewerRole)) return false;
      if (!normalized) return true;
      return [section.title, section.body, ...(section.bullets || [])].some((value) => String(value || "").toLowerCase().includes(normalized));
    });
  }, [normalized, viewerRole]);

  const filteredFaqGroups = useMemo(() => {
    const grouped = new Map();

    FAQS.forEach((faq) => {
      if (!roleMatches(faq.roles, viewerRole)) return;
      if (normalized && ![faq.topic, faq.question, faq.answer, ...(faq.tags || [])].some((value) => String(value || "").toLowerCase().includes(normalized))) {
        return;
      }
      if (!grouped.has(faq.topic)) grouped.set(faq.topic, []);
      grouped.get(faq.topic).push(faq);
    });

    return Array.from(grouped.entries()).map(([topic, items]) => ({ topic, items }));
  }, [normalized, viewerRole]);

  const totalFaqCount = filteredFaqGroups.reduce((sum, group) => sum + group.items.length, 0);
  const isSearching = Boolean(normalized);

  if (activeModule !== "Help Center") return null;

  function toggleTopic(topic) {
    setOpenTopics((prev) => ({
      ...prev,
      [topic]: !prev[topic]
    }));
  }

  return (
    <section className="module-placeholder help-center-shell">
      <div className="page-banner glass-panel">
        <div>
          <p className="eyebrow">Help Center</p>
          <h2>System Guide and FAQs</h2>
          <p>Understand how Quotsy works, search common questions, and get role-specific guidance without leaving the workspace.</p>
        </div>
        <div className="banner-stat help-banner-stat">
          <span>Visible topics</span>
          <strong>{filteredGuide.length + totalFaqCount}</strong>
        </div>
      </div>

      <div className="glass-panel help-search-panel">
        <div className="section-head">
          <div>
            <h3>Search Help</h3>
            <span>Search guide steps, FAQ answers, and operational tips</span>
          </div>
        </div>
        <input
          type="search"
          className="toolbar-search help-toolbar-search"
          placeholder="Search GST, quotation, sub user, PDF, sample data, catalogue..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
      </div>

      <div className="help-overview-grid">
        <article className="glass-panel help-context-card">
          <div className="section-head"><h3>Your Help Scope</h3><span>{viewerRole}</span></div>
          <p>
            {isPlatformAdmin
              ? "Platform help focuses on leads, sellers, subscriptions, plans, notifications, and onboarding control."
              : isSubUser
                ? "Sub-user help focuses on quotation creation, quotation search, PDF download, and customer or product entry inside the wizard."
                : "Seller help focuses on quotations, catalogue, customers, configuration, branding, GST, and subscription-visible features."}
          </p>
          <p className="muted">Contextual help inside each screen can be layered on top of this Help Center, so the system guide remains the source of truth.</p>
        </article>

        <article className="glass-panel help-context-card">
          <div className="section-head"><h3>How To Use This</h3><span>Quick method</span></div>
          <ul className="help-list">
            <li>Use the search box first when you have a specific question.</li>
            <li>Read the guide section if you want to understand the workflow end to end.</li>
            <li>Use FAQs when you want a direct operational answer fast.</li>
          </ul>
        </article>
      </div>

      <div className="help-content-grid">
        <section className="glass-panel help-section-card">
          <div className="section-head"><h3>System Guide</h3><span>{filteredGuide.length} sections</span></div>
          <div className="help-stack">
            {filteredGuide.length === 0 ? (
              <p className="muted">No guide sections matched your search.</p>
            ) : (
              filteredGuide.map((section) => (
                <article key={section.id} className="help-article">
                  <h4>{section.title}</h4>
                  <p>{section.body}</p>
                  <ul className="help-list">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="glass-panel help-section-card">
          <div className="section-head"><h3>Detailed FAQs</h3><span>{totalFaqCount} answers</span></div>
          <div className="help-stack">
            {filteredFaqGroups.length === 0 ? (
              <p className="muted">No FAQs matched your search.</p>
            ) : (
              filteredFaqGroups.map((group) => {
                const isOpen = isSearching || Boolean(openTopics[group.topic]);
                return (
                  <section key={group.topic} className="faq-topic-group">
                    <button
                      type="button"
                      className={`faq-topic-toggle${isOpen ? " open" : ""}`}
                      onClick={() => toggleTopic(group.topic)}
                      aria-expanded={isOpen}
                    >
                      <span className="faq-topic-toggle-copy">
                        <strong>{group.topic}</strong>
                        <small>{group.items.length} question{group.items.length === 1 ? "" : "s"}</small>
                      </span>
                      <span className="faq-topic-toggle-meta">
                        {isSearching && <span className="faq-topic-search-badge">Matched by search</span>}
                        <span className="faq-topic-chevron" aria-hidden="true">{isOpen ? "-" : "+"}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="help-stack faq-topic-content">
                        {group.items.map((faq) => (
                          <article key={`${group.topic}-${faq.question}`} className="help-article faq-article">
                            <h4>{faq.question}</h4>
                            <p>{faq.answer}</p>
                            <div className="help-tag-row">
                              {faq.tags.map((tag) => <span key={tag} className="help-tag">{tag}</span>)}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </section>
      </div>
    </section>
  );
}

