function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeTag(token) {
  const match = String(token || "").trim().match(/^<\s*(\/)?\s*([a-z0-9]+)(?:\s[^>]*)?>$/i);
  if (!match) return null;
  return {
    closing: Boolean(match[1]),
    tag: String(match[2] || "").toLowerCase()
  };
}

function sanitizeLimitedRichTextWithDom(value) {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${String(value || "")}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return "";

  function renderChildren(node, context = {}) {
    return Array.from(node.childNodes || []).map((child) => renderNode(child, context)).join("");
  }

  function wrapInlineAsParagraph(content) {
    const trimmed = String(content || "").trim();
    return trimmed ? `<p>${trimmed}</p>` : "";
  }

  function renderNode(node, context = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || "");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = String(node.tagName || "").toLowerCase();
    const style = String(node.getAttribute?.("style") || "").toLowerCase();
    const isBoldStyled = style.includes("font-weight") && (style.includes("bold") || /font-weight:\s*[6-9]00/.test(style));

    if (tag === "br") return "<br />";

    if (tag === "strong" || tag === "b" || isBoldStyled) {
      const content = renderChildren(node, { ...context, inline: true });
      return content ? `<strong>${content}</strong>` : "";
    }

    if (tag === "ul" || tag === "ol") {
      const items = Array.from(node.children || [])
        .filter((child) => String(child.tagName || "").toLowerCase() === "li")
        .map((child) => renderNode(child, { inline: false }))
        .join("");
      return items ? `<${tag}>${items}</${tag}>` : "";
    }

    if (tag === "li") {
      const content = renderChildren(node, { inline: true }).trim();
      return content ? `<li>${content}</li>` : "";
    }

    if (tag === "p") {
      const content = renderChildren(node, { inline: true }).trim();
      return content ? `<p>${content}</p>` : "";
    }

    if (tag === "div") {
      const content = renderChildren(node, { inline: false });
      if (context.inline) return content;
      return wrapInlineAsParagraph(content);
    }

    return renderChildren(node, context);
  }

  return Array.from(root.childNodes || [])
    .map((child) => renderNode(child, { inline: false }))
    .join("")
    .trim();
}

export function sanitizeLimitedRichText(value) {
  const domSanitized = sanitizeLimitedRichTextWithDom(value);
  if (domSanitized !== null) {
    return domSanitized;
  }

  const tokens = String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/(<[^>]+>)/g)
    .filter(Boolean);

  const allowed = new Set(["p", "strong", "b", "ul", "ol", "li", "br"]);
  let output = "";

  tokens.forEach((token) => {
    if (token.startsWith("<")) {
      const normalized = normalizeTag(token);
      if (!normalized || !allowed.has(normalized.tag)) return;
      if (normalized.tag === "br") {
        output += "<br />";
        return;
      }
      const tagName = normalized.tag === "b" ? "strong" : normalized.tag;
      output += normalized.closing ? `</${tagName}>` : `<${tagName}>`;
      return;
    }
    output += escapeHtml(token);
  });

  return output.trim();
}

export function richTextToPlainText(value) {
  return sanitizeLimitedRichText(value)
    .replace(/<\/(p|li|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function plainTextToRichText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function getRichTextValue(richValue, plainValue = "") {
  const sanitized = sanitizeLimitedRichText(richValue);
  if (sanitized) return sanitized;
  return plainTextToRichText(plainValue);
}
