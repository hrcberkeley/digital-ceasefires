// Small cross-cutting helpers. Nothing here is app-specific.

/** Tiny hyperscript helper so views can build DOM without a template engine.
 *  h('div', {className: 'card', onClick: fn}, ['text', childEl]) */
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "className") el.className = value;
    else if (key === "html") el.innerHTML = value; // caller is responsible for sanitizing
    else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "dataset") {
      Object.assign(el.dataset, value);
    } else if (key in el && key !== "list") {
      try { el[key] = value; } catch { el.setAttribute(key, value); }
    } else {
      el.setAttribute(key, value);
    }
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function pipeList(str) {
  return (str || "").split("|").map((s) => s.trim()).filter(Boolean);
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function uid(prefix = "id") {
  const rand = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}

export function formatDate(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr.length <= 10 ? `${isoStr}T00:00:00` : isoStr);
  if (isNaN(d)) return isoStr;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

let toastTimer = null;
export function toast(message, type = "info", ms = 4000) {
  const region = document.getElementById("toast-region");
  if (!region) return;
  const node = h("div", { className: `toast ${type === "error" ? "toast-error" : ""}` }, [message]);
  region.appendChild(node);
  setTimeout(() => node.remove(), ms);
  clearTimeout(toastTimer);
}

/** Render Sheet-sourced or user-sourced markdown safely: marked -> DOMPurify. */
export function renderMarkdown(text) {
  const raw = window.marked ? window.marked.parse(text || "") : (text || "");
  return window.DOMPurify ? window.DOMPurify.sanitize(raw) : escapeHtml(text);
}

/** Minimal modal: openModal({title, body: [nodes], actions: [buttonNodes]}) -> close() */
export function openModal({ title, body = [], actions = [] }) {
  const backdrop = h("div", { className: "modal-backdrop" });
  const close = () => backdrop.remove();
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  const modal = h("div", { className: "modal stack" }, [title ? h("h2", {}, title) : null, ...body, h("div", { className: "cluster" }, actions)]);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  return close;
}

const NUMERIC_SECTION_RE = /^[0-9]+(\.[0-9]+)*$/;
/** "3.1 Internet Interference", but just the title for the one section (Note to
 *  Users) whose "number" is a slug rather than a real dotted section number. */
export function sectionLabel(section) {
  return NUMERIC_SECTION_RE.test(section.number) ? `${section.number} ${section.title}` : section.title;
}

/** Sections that don't belong in the builder's addable list: definitions and the
 *  annex ride along automatically via requires_*, and front-matter isn't a provision. */
export const NON_BUILDER_SECTION_IDS = new Set(["s-9.0", "s-11.0", "s-note-to-users"]);

export function slugify(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
