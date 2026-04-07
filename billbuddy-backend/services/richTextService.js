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

function sanitizeLimitedRichText(value) {
  const tokens = String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/(<[^>]+>)/g)
    .filter(Boolean);

  const allowed = new Set(["p", "strong", "b", "ul", "ol", "li"]);
  let output = "";

  tokens.forEach((token) => {
    if (token.startsWith("<")) {
      const normalized = normalizeTag(token);
      if (!normalized || !allowed.has(normalized.tag)) return;
      const tagName = normalized.tag === "b" ? "strong" : normalized.tag;
      output += normalized.closing ? `</${tagName}>` : `<${tagName}>`;
      return;
    }
    output += escapeHtml(token);
  });

  return output.trim();
}

function plainTextToRichText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function richTextToPlainText(value) {
  return sanitizeLimitedRichText(value)
    .replace(/<\/(p|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getRichTextHtml(value, fallbackText = "") {
  const sanitized = sanitizeLimitedRichText(value);
  if (sanitized) return sanitized;
  return plainTextToRichText(fallbackText);
}

function parseRichTextBlocks(value) {
  const html = sanitizeLimitedRichText(value);
  if (!html) return [];

  const tokens = html.split(/(<[^>]+>)/g).filter(Boolean);
  const blocks = [];
  let currentParagraph = null;
  let currentList = null;
  let currentItem = null;
  let boldDepth = 0;

  const ensureParagraph = () => {
    if (!currentParagraph) {
      currentParagraph = { type: "paragraph", segments: [] };
    }
    return currentParagraph;
  };

  const pushParagraph = () => {
    if (currentParagraph && currentParagraph.segments.some((segment) => segment.text.trim())) {
      blocks.push(currentParagraph);
    }
    currentParagraph = null;
  };

  const ensureList = (type) => {
    if (!currentList || currentList.type !== type) {
      if (currentList?.items?.length) {
        blocks.push(currentList);
      }
      currentList = { type, items: [] };
    }
    return currentList;
  };

  const pushList = () => {
    if (currentList?.items?.length) {
      blocks.push(currentList);
    }
    currentList = null;
  };

  const pushItem = () => {
    if (currentItem && currentItem.some((segment) => segment.text.trim())) {
      currentList?.items.push(currentItem);
    }
    currentItem = null;
  };

  const appendText = (text) => {
    const normalized = String(text || "").replace(/\s+/g, " ");
    if (!normalized.trim()) return;
    const target = currentItem || ensureParagraph().segments;
    target.push({
      text: normalized,
      bold: boldDepth > 0
    });
  };

  tokens.forEach((token) => {
    if (!token.startsWith("<")) {
      appendText(token);
      return;
    }

    const tag = normalizeTag(token);
    if (!tag) return;

    if (!tag.closing) {
      if (tag.tag === "p") {
        pushParagraph();
        return;
      }
      if (tag.tag === "ul") {
        pushParagraph();
        ensureList("unordered");
        return;
      }
      if (tag.tag === "ol") {
        pushParagraph();
        ensureList("ordered");
        return;
      }
      if (tag.tag === "li") {
        currentItem = [];
        return;
      }
      if (tag.tag === "strong" || tag.tag === "b") {
        boldDepth += 1;
      }
      return;
    }

    if (tag.tag === "p") {
      pushParagraph();
      return;
    }
    if (tag.tag === "li") {
      pushItem();
      return;
    }
    if (tag.tag === "ul" || tag.tag === "ol") {
      pushItem();
      pushList();
      return;
    }
    if ((tag.tag === "strong" || tag.tag === "b") && boldDepth > 0) {
      boldDepth -= 1;
    }
  });

  pushItem();
  pushParagraph();
  pushList();
  return blocks;
}

function renderInlineSegments(doc, segments, x, y, width, options = {}) {
  const fontSize = options.fontSize || 9.5;
  const lineGap = options.lineGap ?? 2;
  const color = options.color || "#101828";
  const cleanSegments = Array.isArray(segments)
    ? segments.filter((segment) => String(segment?.text || "").trim())
    : [];

  if (!cleanSegments.length) {
    doc.fillColor(color).font("Helvetica").fontSize(fontSize).text("-", x, y, { width, lineGap });
    return;
  }

  cleanSegments.forEach((segment, index) => {
    doc
      .fillColor(color)
      .font(segment.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(fontSize)
      .text(segment.text, index === 0 ? x : undefined, index === 0 ? y : undefined, {
        width,
        continued: index < cleanSegments.length - 1,
        lineGap
      });
  });
}

function measureRichTextPdfHeight(doc, html, options = {}) {
  const blocks = parseRichTextBlocks(html);
  const width = options.width ?? (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  const fontSize = options.fontSize || 9.5;
  const lineGap = options.lineGap ?? 2;
  const blockGap = options.blockGap ?? 6;
  const listIndent = options.listIndent ?? 16;

  if (!blocks.length) {
    return doc.heightOfString("-", { width, lineGap });
  }

  let height = 0;
  blocks.forEach((block, blockIndex) => {
    if (block.type === "paragraph") {
      const text = block.segments.map((segment) => String(segment?.text || "")).join("");
      height += doc.heightOfString(text || "-", {
        width,
        lineGap,
        font: "Helvetica",
        size: fontSize
      });
    } else {
      block.items.forEach((itemSegments, itemIndex) => {
        const text = itemSegments.map((segment) => String(segment?.text || "")).join("");
        height += doc.heightOfString(text || "-", {
          width: Math.max(0, width - listIndent),
          lineGap,
          font: "Helvetica",
          size: fontSize
        });
        if (itemIndex < block.items.length - 1) {
          height += fontSize * 0.15;
        }
      });
    }

    if (blockIndex < blocks.length - 1) {
      height += fontSize * (blockGap / 12);
    }
  });

  return height;
}

function renderRichTextPdf(doc, html, options = {}) {
  const blocks = parseRichTextBlocks(html);
  const x = options.x ?? doc.x;
  const width = options.width ?? (doc.page.width - doc.page.margins.left - doc.page.margins.right);
  const fontSize = options.fontSize || 9.5;
  const lineGap = options.lineGap ?? 2;
  const color = options.color || "#101828";
  const blockGap = options.blockGap ?? 6;
  const listIndent = options.listIndent ?? 16;
  const bulletGap = options.bulletGap ?? 12;

  if (!blocks.length) {
    doc.fillColor(color).font("Helvetica").fontSize(fontSize).text("-", x, doc.y, { width, lineGap });
    return;
  }

  blocks.forEach((block, blockIndex) => {
    const baseY = doc.y;
    if (block.type === "paragraph") {
      renderInlineSegments(doc, block.segments, x, baseY, width, { fontSize, lineGap, color });
    } else {
      block.items.forEach((itemSegments, itemIndex) => {
        const itemY = doc.y;
        const prefix = block.type === "ordered" ? `${itemIndex + 1}.` : "\u2022";
        const itemText = itemSegments.map((segment) => String(segment?.text || "")).join("") || "-";
        const itemHeight = doc.heightOfString(itemText, {
          width: Math.max(0, width - listIndent),
          lineGap,
          font: "Helvetica",
          size: fontSize
        });
        doc.fillColor(color).font("Helvetica-Bold").fontSize(fontSize).text(prefix, x, itemY, {
          width: bulletGap,
          lineBreak: false
        });
        renderInlineSegments(doc, itemSegments, x + listIndent, itemY, width - listIndent, {
          fontSize,
          lineGap,
          color
        });
        doc.y = Math.max(doc.y, itemY + itemHeight);
        if (itemIndex < block.items.length - 1) {
          doc.moveDown(0.15);
        }
      });
    }

    if (blockIndex < blocks.length - 1) {
      doc.moveDown(blockGap / 12);
    }
  });
}

module.exports = {
  getRichTextHtml,
  measureRichTextPdfHeight,
  parseRichTextBlocks,
  plainTextToRichText,
  renderRichTextPdf,
  richTextToPlainText,
  sanitizeLimitedRichText
};
