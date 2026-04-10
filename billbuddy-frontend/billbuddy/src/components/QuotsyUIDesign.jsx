import "./QuotsyUIDesign.css";
import { useState } from "react";
import { apiFetch } from "../api";

export default function QuotsyUIDesign({ platformPlans = [] }) {
  const features = [
    {
      title: "Dynamic Quotation Engine",
      desc: "Seller-specific quotation forms with configurable fields, display rules, and branded output.",
      tag: "Core",
      icon: "DOC"
    },
    {
      title: "Configuration Studio",
      desc: "No-code control over fields, formulas, layouts, PDF behavior, and number formatting.",
      tag: "Differentiator",
      icon: "CFG"
    },
    {
      title: "Smart Pricing Engine",
      desc: "Category-based calculations, configurable formulas, and GST-ready pricing workflows.",
      tag: "Automation",
      icon: "CALC"
    },
    {
      title: "Versioning and Freeze",
      desc: "Every quotation revision is captured as a full immutable snapshot for audit and recovery.",
      tag: "Control",
      icon: "VER"
    },
    {
      title: "Catalogue plus Units",
      desc: "Products, services, categories, and platform-level unit conversion mapping.",
      tag: "Accuracy",
      icon: "CAT"
    },
    {
      title: "Multi-Tenant SaaS",
      desc: "Manage multiple sellers centrally with role-based access and plan-level controls.",
      tag: "Scale",
      icon: "MT"
    }
  ];

  const metrics = [
    { label: "Today's Quotations", value: "128" },
    { label: "Quotation Value", value: "INR 18.4L" },
    { label: "Top Category", value: "Laser Sheets" },
    { label: "Stale Products", value: "16" }
  ];

  const normalizedPlatformPlans = (Array.isArray(platformPlans) ? platformPlans : [])
    .filter((plan) => plan && plan.is_active !== false && (plan.website_visible === undefined || plan.website_visible === true))
    .map((plan) => {
      const formattedPrice = Number(plan.price || 0) > 0 ? `INR ${Number(plan.price).toLocaleString("en-IN")}` : "Custom";
      const configuredPointers = Array.isArray(plan.website_pointers)
        ? plan.website_pointers.map((row) => String(row || "").trim()).filter(Boolean)
        : [];
      const featureRows = configuredPointers.length ? configuredPointers : [];
      if (!configuredPointers.length) {
        if (Number(plan.max_users || 0) > 0) featureRows.push(`Up to ${plan.max_users} users`);
        if (Number(plan.max_quotations || 0) > 0) featureRows.push(`${plan.max_quotations} quotations limit`);
        if (Number(plan.max_customers || 0) > 0) featureRows.push(`${plan.max_customers} customers limit`);
        if (String(plan.template_access_tier || "").trim()) featureRows.push(`${plan.template_access_tier} template tier`);
        if (plan.gst_enabled) featureRows.push("GST support");
        if (plan.exports_enabled) featureRows.push("Export support");
        if (plan.reports_enabled) featureRows.push("Reports enabled");
      }
      return {
        name: plan.plan_name || plan.plan_code || "Plan",
        price: formattedPrice,
        ctaLabel: String(plan.landing_cta_label || "").trim() || "Get Started",
        ctaLink: String(plan.landing_cta_link || "").trim() || "/try-demo",
        featured: Boolean(plan.landing_featured),
        features: featureRows.length ? featureRows : ["Quotation workflow", "Seller setup", "PDF output", "Team support"]
      };
    });

  const plans = normalizedPlatformPlans;

  const [contactForm, setContactForm] = useState({
    name: "",
    mobile: "",
    email: "",
    businessName: "",
    requirement: ""
  });
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState("");
  const [contactError, setContactError] = useState("");

  async function handleSubmitContactForm(event) {
    event.preventDefault();
    try {
      setContactSubmitting(true);
      setContactSuccess("");
      setContactError("");
      await apiFetch("/api/lead-capture", {
        method: "POST",
        body: JSON.stringify({
          name: contactForm.name,
          mobile: contactForm.mobile,
          email: contactForm.email,
          businessName: contactForm.businessName,
          city: "",
          businessType: "Quotation Operations",
          businessSegment: "Quotsy",
          wantsSampleData: false,
          requirement: contactForm.requirement,
          interestedInDemo: true
        })
      });
      setContactSuccess("Thanks! We have received your details.");
      setContactForm({
        name: "",
        mobile: "",
        email: "",
        businessName: "",
        requirement: ""
      });
    } catch (err) {
      setContactError(err?.message || "Failed to submit. Please try again.");
    } finally {
      setContactSubmitting(false);
    }
  }

  return (
    <div className="quotsy-ui-root">
      <div className="quotsy-ui-container">
        <section className="quotsy-hero-grid">
          <div className="quotsy-panel quotsy-hero-panel">
            <div className="quotsy-chip">Multi-tenant Quotation Platform</div>
            <h1 className="quotsy-hero-title">Full-stack quotation workflows with enterprise control.</h1>
            <p className="quotsy-hero-text">
              Build quotations faster, control structure without rigid templates, automate pricing, manage branding, and run multiple sellers from one SaaS platform.
            </p>
            <div className="quotsy-actions">
              <a className="quotsy-btn quotsy-btn-primary quotsy-btn-link" href="/features">Explore Platform</a>
              <a className="quotsy-btn quotsy-btn-outline quotsy-btn-link" href="/try-demo">Start Demo</a>
            </div>
            <div className="quotsy-metrics-grid">
              {metrics.map((metric) => (
                <div key={metric.label} className="quotsy-metric-card">
                  <div className="quotsy-metric-label">{metric.label}</div>
                  <div className="quotsy-metric-value">{metric.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div id="dashboard" className="quotsy-panel quotsy-dark-panel">
            <div className="quotsy-dark-inner">
              <div className="quotsy-dark-head">
                <div>
                  <div className="quotsy-dark-kicker">Live Dashboard</div>
                  <div className="quotsy-dark-title">Quotation Overview</div>
                </div>
                <div className="quotsy-dark-badge">Active</div>
              </div>
              <div className="quotsy-dark-grid">
                <DarkCard title="Daily Value" value="INR 6.8L" sub="7-day trend +14%" />
                <DarkCard title="Pending Reviews" value="23" sub="Needs pricing approval" />
                <DarkCard title="Top Article" value="MS Sheet 2mm" sub="Highest quoted item" />
                <DarkCard title="Inactive SKUs" value="12" sub="No quote in 30 days" />
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="quotsy-features-grid">
          {features.map((feature) => (
            <div key={feature.title} className="quotsy-feature-card">
              <div className="quotsy-feature-head">
                <div className="quotsy-feature-icon">{feature.icon}</div>
                <div className="quotsy-feature-tag">{feature.tag}</div>
              </div>
              <h3 className="quotsy-feature-title">{feature.title}</h3>
              <p className="quotsy-feature-desc">{feature.desc}</p>
            </div>
          ))}
        </section>

        <section id="industries" className="segments-section">
          <div className="seg-header">
            <div className="sec-label">Industries</div>
            <h2>We are building for MSMEs across multiple business segments, not just one fashionable niche.</h2>
            <p>Our platforms are shaped by real business owners, operators, and teams who actually work on the ground.</p>
          </div>
          <div className="seg-grid">
            <div className="seg-item"><span className="seg-item-icon">Retail</span>Retail & Quick Commerce</div>
            <div className="seg-item"><span className="seg-item-icon">MFG</span>Manufacturing</div>
            <div className="seg-item"><span className="seg-item-icon">DIST</span>Distribution</div>
            <div className="seg-item"><span className="seg-item-icon">B2B</span>B2B Trade</div>
            <div className="seg-item"><span className="seg-item-icon">SRV</span>Service Businesses</div>
            <div className="seg-item"><span className="seg-item-icon">DIG</span>Digital-First Startups</div>
          </div>
        </section>

        <section className="cta-section">
          <div className="cta-inner">
            <div className="cta-banner">
              <div className="cta-text">
                <div className="cta-title">
                  Ready to digitize business operations with
                  <br />
                  software that actually <em>helps MSMEs?</em>
                </div>
                <p className="cta-desc">
                  Explore Quicksy and Quotsy, or connect with Srijan Labs to build the next digitizer your business actually needs.
                  Built for founders, operators, commerce users, and businesses tired of fragmented systems.
                </p>
              </div>
              <div className="cta-btns">
                <a href="/try-demo" className="btn-cta-ghost">Start Demo</a>
              </div>
            </div>
          </div>
        </section>

        {plans.length > 0 ? (
          <section id="pricing" className="quotsy-panel quotsy-pricing-panel">
            <div className="quotsy-pricing-head">
              <div>
                <h2 className="quotsy-pricing-title">Plans designed for growing teams.</h2>
                <p className="quotsy-pricing-text">
                  Start fast with ready onboarding and scale with advanced controls as your quoting process grows.
                </p>
              </div>
              <a className="quotsy-btn quotsy-btn-dark quotsy-btn-link" href="/features#comparison">Compare Plans</a>
            </div>

            <div className={`quotsy-pricing-grid ${plans.length >= 4 ? "quotsy-pricing-grid-four" : ""}`}>
              {plans.map((plan) => (
                <div key={plan.name} className={`quotsy-plan-card ${plan.featured ? "quotsy-plan-featured" : ""}`}>
                  <div className="quotsy-plan-head">
                    <div className="quotsy-plan-name">{plan.name}</div>
                    {plan.featured ? <div className="quotsy-plan-badge">Most Popular</div> : null}
                  </div>
                  <div className="quotsy-plan-price">{plan.price}</div>
                  <div className="quotsy-plan-sub">per workspace / month</div>
                  <div className="quotsy-plan-features">
                    {plan.features.map((feature) => (
                      <div key={feature} className="quotsy-plan-feature-row">
                        <div className="quotsy-dot" />
                        {feature}
                      </div>
                    ))}
                  </div>
                  <a href={plan.ctaLink || "/try-demo"} className={`quotsy-btn quotsy-plan-btn quotsy-btn-link ${plan.featured ? "quotsy-btn-light" : "quotsy-btn-dark"}`}>
                    {plan.ctaLabel || (plan.featured ? "Start Pro Trial" : "Get Started")}
                  </a>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="contact-section" id="contact">
          <div className="contact-inner">
            <div className="contact-left">
              <div className="sec-label">Contact Us</div>
              <h2>Let's build the right platform for your business.</h2>
              <p>
                Whether you're exploring Quicksy, Quotsy, Stocksy, or need a custom platform - we'd love to hear from you.
                Reach out and let's talk about what your MSME actually needs.
              </p>
              <div className="contact-details">
                <div className="contact-row">
                  <div className="contact-info-label">Email</div>
                  <div className="contact-info-val">Rahul@srijanlabs.in</div>
                </div>
                <div className="contact-row">
                  <div className="contact-info-label">Mobile</div>
                  <div className="contact-info-val">+91 98186 71113</div>
                </div>
                <div className="contact-row">
                  <div className="contact-info-label">Location</div>
                  <div className="contact-info-val">Navi Mumbai, Maharashtra, India</div>
                </div>
              </div>
            </div>

            <div className="contact-form-card">
              <div className="cfc-title">Send us a message</div>
              <div className="cfc-sub">We typically respond within 24 hours.</div>
              <form onSubmit={handleSubmitContactForm}>
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label">Name</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder="Your name"
                      required
                      value={contactForm.name}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label">Mobile</label>
                    <input
                      className="form-input"
                      type="tel"
                      placeholder="+91"
                      required
                      value={contactForm.mobile}
                      onChange={(event) => setContactForm((prev) => ({ ...prev, mobile: event.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="you@company.com"
                    value={contactForm.email}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, email: event.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Business Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Your company"
                    value={contactForm.businessName}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, businessName: event.target.value }))}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Tell us your requirement"
                    required
                    value={contactForm.requirement}
                    onChange={(event) => setContactForm((prev) => ({ ...prev, requirement: event.target.value }))}
                  />
                </div>
                {contactSuccess ? <p className="form-success">{contactSuccess}</p> : null}
                {contactError ? <p className="form-error">{contactError}</p> : null}
                <button className="btn-form" type="submit" disabled={contactSubmitting}>
                  {contactSubmitting ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          </div>
        </section>

        <footer className="sl-footer">
          <div className="footer-inner">
            <div className="footer-top">
              <div className="footer-brand-block">
                <div className="footer-brand-name">Srijan Labs.</div>
                <p className="footer-brand-desc">
                  Building practical SaaS platforms to MSME digital systems, quotation workflows, and operational systems.
                </p>
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Products</div>
                <div className="footer-links">
                  <a href="https://www.srijanlabs.in/" target="_blank" rel="noreferrer">Quicksy</a>
                  <a href="/quotsy">Quotsy</a>
                  <a href="https://www.srijanlabs.in/" target="_blank" rel="noreferrer">Stocksy</a>
                  <a href="https://www.srijanlabs.in/" target="_blank" rel="noreferrer">QuoteIQ</a>
                </div>
              </div>
              <div className="footer-col">
                <div className="footer-col-title">Connect</div>
                <div className="footer-links">
                  <a href="#dashboard">About</a>
                  <a href="#industries">Industries</a>
                  <a href="#contact">Contact</a>
                  <a href="#contact">Get Started</a>
                </div>
              </div>
            </div>
            <div className="footer-bottom">
              <span className="footer-copy">(c) 2026 Srijan Labs. All rights reserved. | UAT Release Test</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

function DarkCard({ title, value, sub }) {
  return (
    <div className="quotsy-dark-card">
      <div className="quotsy-dark-card-title">{title}</div>
      <div className="quotsy-dark-card-value">{value}</div>
      <div className="quotsy-dark-card-sub">{sub}</div>
    </div>
  );
}
