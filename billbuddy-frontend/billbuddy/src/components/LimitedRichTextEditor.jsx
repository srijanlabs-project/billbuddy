import { useEffect, useRef } from "react";
import { getRichTextValue, sanitizeLimitedRichText } from "../utils/richText";

const TOOLBAR_ACTIONS = [
  { command: "bold", label: "B", title: "Bold" },
  { command: "insertUnorderedList", label: "\u2022 List", title: "Bullet list" },
  { command: "insertOrderedList", label: "1. List", title: "Numbered list" }
];

export default function LimitedRichTextEditor({
  label,
  value,
  plainFallback = "",
  onChange,
  placeholder = "",
  className = ""
}) {
  const editorRef = useRef(null);
  const isFocusedRef = useRef(false);
  const lastCommittedValueRef = useRef("");

  const normalizedValue = getRichTextValue(value, plainFallback);

  useEffect(() => {
    if (!editorRef.current) return;
    if (isFocusedRef.current) return;
    if (editorRef.current.innerHTML !== normalizedValue) {
      editorRef.current.innerHTML = normalizedValue;
    }
    lastCommittedValueRef.current = normalizedValue;
  }, [normalizedValue]);

  function emitChange({ normalizeDom = false } = {}) {
    if (!editorRef.current) return;
    const sanitized = sanitizeLimitedRichText(editorRef.current.innerHTML);
    if (normalizeDom && editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized;
    }
    lastCommittedValueRef.current = sanitized;
    onChange?.(sanitized);
  }

  function handleToolbarAction(command) {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  }

  function handlePaste(event) {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    document.execCommand("insertText", false, text);
    emitChange();
  }

  return (
    <label className={`limited-rich-text ${className}`}>
      {label ? <span>{label}</span> : null}
      <div className="limited-rich-text-shell">
        <div className="limited-rich-text-toolbar">
          {TOOLBAR_ACTIONS.map((action) => (
            <button
              key={action.command}
              type="button"
              className="ghost-btn limited-rich-text-toolbar-btn"
              title={action.title}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleToolbarAction(action.command)}
            >
              {action.label}
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          className="limited-rich-text-editor"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onInput={() => emitChange()}
          onPaste={handlePaste}
          onBlur={() => {
            isFocusedRef.current = false;
            emitChange({ normalizeDom: true });
          }}
        />
      </div>
    </label>
  );
}
