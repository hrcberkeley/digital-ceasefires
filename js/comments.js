// Reviewer comment layer (PRD s.7). Comments are public to read; only a signed-in
// reviewer (a token in localStorage) can write. One handbook-wide fetch feeds every
// provision's thread so opening the reader doesn't fire one request per item.
import { h, clear, formatDate, toast } from "./utils.js";
import { t, parseCsv } from "./data.js";
import { getReviewer } from "./review-auth.js";
import { postComment, getComments, ApiError } from "./api.js";
import { FEEDBACK_CSV_URL } from "./config.js";

const HANDBOOK_VERSION = "1.4";
let allComments = null; // null = not loaded yet, [] = loaded but empty/unavailable

export async function preloadComments() {
  if (allComments) return allComments;
  try {
    const res = await getComments(HANDBOOK_VERSION);
    allComments = res.comments || [];
  } catch (err) {
    if (err instanceof ApiError && err.code === "not_configured") {
      allComments = await loadCommentsFromSheet(); // Apps Script not deployed -- read the published feedback CSV directly
    } else {
      console.warn("Couldn't load reviewer comments:", err);
      allComments = [];
    }
  }
  return allComments;
}

// Read-only mirror of the Apps Script backend's getPublicComments(), since a published
// CSV has no cache/version filtering of its own -- see apps-script/Code.gs.
async function loadCommentsFromSheet() {
  if (!FEEDBACK_CSV_URL) return [];
  try {
    const res = await fetch(FEEDBACK_CSV_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const rows = parseCsv(await res.text());
    const visible = rows.filter((r) => r.status === "visible" && String(r.handbook_version) === HANDBOOK_VERSION);
    const hiddenParentIds = new Set(rows.filter((r) => r.status === "hidden").map((r) => r.comment_id));
    const visibleParentIds = new Set(visible.map((r) => r.parent_id).filter(Boolean));
    const publicRows = visible.map(publicCommentFields);
    for (const hiddenId of hiddenParentIds) {
      if (visibleParentIds.has(hiddenId) && !publicRows.some((r) => r.comment_id === hiddenId)) {
        const hiddenRow = rows.find((r) => r.comment_id === hiddenId);
        if (hiddenRow) publicRows.push(publicCommentFields({ ...hiddenRow, status: "hidden", body: "" }));
      }
    }
    return publicRows;
  } catch (err) {
    console.warn("Couldn't load feedback from published sheet:", err);
    return [];
  }
}

function publicCommentFields(r) {
  return {
    comment_id: r.comment_id,
    parent_id: r.parent_id,
    role: r.role,
    target: r.provision_id,
    target_id: r.provision_id,
    target_type: r.target_type,
    selected_text: r.selected_text,
    body: r.status === "hidden" ? "" : r.body,
    status: r.status,
    created_at: r.created_at,
  };
}

function threadFor(targetId) {
  const items = allComments.filter((c) => c.target === targetId || c.target_id === targetId);
  const byParent = new Map();
  for (const c of items) {
    const key = c.parent_id || "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }
  return byParent;
}

function roleClass(role) {
  return `role-${(role || "other").toLowerCase().replace(/[^a-z]+/g, "-").split("-")[0] || "other"}`;
}

function renderComment(db, comment, byParent, ctx, isReply = false) {
  const replies = byParent.get(comment.comment_id) || [];
  const node = h("div", { className: isReply ? "comment-reply" : "comment-thread" }, [
    !isReply && comment.selected_text ? h("div", { className: "comment-quote" }, comment.selected_text) : null,
    h("div", { className: "comment-meta" }, [
      h("span", { className: `role-badge ${roleClass(comment.role)}` }, comment.role || "Reviewer"),
      h("span", {}, formatDate(comment.created_at)),
    ]),
    h("div", { className: "comment-body" }, comment.status === "hidden" ? t(db, "review.comment_removed", "Comment removed") : comment.body),
    ...replies.map((r) => renderComment(db, r, byParent, ctx, true)),
  ]);
  if (!isReply && getReviewer()) node.appendChild(replyToggle(db, comment, ctx));
  return node;
}

function replyToggle(db, parent, ctx) {
  const btn = h("button", { className: "comment-link" }, t(db, "review.reply_button", "Reply"));
  btn.addEventListener("click", () => {
    const form = commentForm(db, ctx.target, { parentId: parent.comment_id, submitLabel: t(db, "review.reply_button", "Reply") }, ctx.rerender, () => { form.replaceWith(btn); layoutMarginThreads(); });
    btn.replaceWith(form);
    form.querySelector("textarea").focus();
    layoutMarginThreads();
  });
  return btn;
}

function commentForm(db, target, { quote, offsets, parentId, submitLabel } = {}, onPosted, onCancel) {
  const reviewer = getReviewer();
  const textarea = h("textarea", { placeholder: parentId ? "Reply..." : "Add your comment...", maxLength: 4000, rows: 2 });
  const error = h("div", { className: "form-error" }, "");
  const submit = h("button", { className: "btn btn-primary btn-sm" }, submitLabel || t(db, "review.comment_button", "Comment"));
  const cancel = h("button", { className: "btn btn-ghost btn-sm" }, "Cancel");
  cancel.addEventListener("click", onCancel);
  submit.disabled = true;
  textarea.addEventListener("input", () => { submit.disabled = !textarea.value.trim(); });
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !submit.disabled) submit.click();
  });
  submit.addEventListener("click", async () => {
    const body = textarea.value.trim();
    if (!body) return;
    submit.disabled = true;
    try {
      const res = await postComment({
        token: reviewer.token,
        targetId: target.id,
        targetType: target.type,
        handbookVersion: HANDBOOK_VERSION,
        selectedText: quote || "",
        startOffset: offsets?.start ?? "",
        endOffset: offsets?.end ?? "",
        body,
        parentId: parentId || "",
      });
      allComments.push({
        comment_id: res.comment_id,
        parent_id: parentId || "",
        target: target.id,
        target_type: target.type,
        role: reviewer.role,
        selected_text: quote || "",
        body,
        status: "visible",
        created_at: res.created_at || new Date().toISOString(),
      });
      onPosted();
    } catch (err) {
      error.textContent = errorMessage(db, err);
      submit.disabled = false;
    }
  });
  return h("div", { className: "comment-form" }, [
    quote ? h("div", { className: "comment-quote" }, quote) : null,
    textarea,
    h("div", { className: "comment-form-actions" }, [cancel, submit]),
    error,
  ]);
}

function errorMessage(db, err) {
  if (err instanceof ApiError) {
    const key = { rate_limited: "error.rate_limited", invalid_token: "error.invalid_token", body_too_long: "error.body_too_long", selection_too_long: "error.selection_too_long" }[err.code];
    if (key) return t(db, key, err.code);
  }
  return t(db, "error.network", "Couldn't reach the server.");
}

/** The thread card(s) for one target. With `quote` (from a text selection) or no
 *  comments yet, the new-comment form starts open; otherwise it's behind "New comment". */
function buildPanel(db, target, host, onClose, { quote, offsets } = {}) {
  const ctx = { target, rerender: () => { clear(host); host.appendChild(buildPanel(db, target, host, onClose)); layoutMarginThreads(); } };
  const byParent = threadFor(target.id);
  const topLevel = byParent.get("") || [];
  const close = h("button", { className: "comment-close", ariaLabel: "Close comments", title: "Close" }, "\u00d7");
  close.addEventListener("click", (e) => { e.stopPropagation(); onClose(); });
  const wrap = h("div", { className: "comment-panel" }, [close, ...topLevel.map((c) => renderComment(db, c, byParent, ctx))]);

  if (!getReviewer()) {
    wrap.appendChild(h("p", { className: "small muted" }, [
      "Sign in as a reviewer to comment -- ",
      h("a", { href: "#/review/register" }, t(db, "review.register_title", "Become a reviewer")),
      ".",
    ]));
  } else if (quote || !topLevel.length) {
    // cancelling a brand-new comment closes the panel; cancelling a quote on an existing thread just drops the form
    wrap.appendChild(commentForm(db, target, { quote, offsets }, ctx.rerender, topLevel.length ? ctx.rerender : onClose));
  } else {
    const add = h("button", { className: "comment-link" }, "New comment");
    add.addEventListener("click", () => {
      const form = commentForm(db, target, {}, ctx.rerender, () => { form.replaceWith(add); layoutMarginThreads(); });
      add.replaceWith(form);
      form.querySelector("textarea").focus();
      layoutMarginThreads();
    });
    wrap.appendChild(add);
  }
  return wrap;
}

// Every mounted toggle, so "show/hide all" and the margin layout can reach them.
const mounted = [];

/** Stacks open threads in the right margin (Google Docs style): each sits level with
 *  its paragraph, pushed down just enough not to overlap the one above. No-op when the
 *  CSS has put threads back inline (narrow screens). */
export function layoutMarginThreads() {
  let prevBottom = -Infinity;
  for (const m of mounted) {
    const el = m.panelHost;
    el.style.top = "";
    if (!el.firstChild || getComputedStyle(el).position !== "absolute") continue;
    const natural = el.getBoundingClientRect().top;
    const top = Math.max(natural, prevBottom + 12);
    el.style.top = `${top - natural}px`;
    prevBottom = top + el.offsetHeight;
  }
  highlightQuotes();
}

let activeEntry = null;

// Marks each open thread's quoted text in its paragraph with the CSS Custom Highlight
// API (no DOM changes, so it can't break term links or selection offsets).
function highlightQuotes() {
  if (!window.CSS?.highlights) return; // ponytail: older browsers just skip the highlight
  const normal = new Highlight(), active = new Highlight();
  for (const m of mounted) {
    if (!m.isOpen) continue;
    for (const c of allComments.filter((c) => (c.target === m.targetId || c.target_id === m.targetId) && c.selected_text)) {
      const range = findTextRange(m.textEl, c.selected_text);
      if (range) (m === activeEntry ? active : normal).add(range);
    }
  }
  CSS.highlights.set("comment-quote", normal);
  CSS.highlights.set("comment-quote-active", active);
}

function findTextRange(root, needle) {
  const nodes = [];
  let text = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest(".comment-panel-host, .provision-actions") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  while (walker.nextNode()) { nodes.push([walker.currentNode, text.length]); text += walker.currentNode.data; }
  const start = text.indexOf(needle.trim());
  if (start < 0) return null;
  const end = start + needle.trim().length;
  const at = (pos) => { const [n, off] = nodes.findLast(([, o]) => o <= pos); return [n, pos - off]; };
  const range = document.createRange();
  range.setStart(...at(start));
  range.setEnd(...at(end - 1));
  range.setEnd(range.endContainer, range.endOffset + 1);
  return range;
}

function setActive(entry) {
  if (activeEntry === entry) return;
  activeEntry?.panelHost.classList.remove("active");
  activeEntry = entry;
  entry?.panelHost.classList.add("active");
  highlightQuotes();
}
window.addEventListener("resize", () => layoutMarginThreads());

/** Forget the previous view's toggles; call at the start of each handbook render. */
export function resetCommentToggles() {
  mounted.length = 0;
  activeEntry = null;
}

export function totalCommentCount() {
  return mounted.reduce((n, m) => n + m.count, 0);
}

/** Opens every thread that has comments, or closes them all. */
export function setAllThreadsOpen(open) {
  for (const m of mounted) open && m.count ? m.open() : m.close();
  layoutMarginThreads();
}

/** Mounts a "Comment" / "N comments" toggle for one target (provision, definition,
 *  law clause, or section guidance) into buttonHost; its thread opens in panelParent
 *  (the margin, via CSS). Call after preloadComments() has resolved. */
export function mountCommentToggle(db, target, buttonHost, panelParent = buttonHost) {
  const count = (allComments || []).filter((c) => (c.target === target.id || c.target_id === target.id) && c.status !== "hidden").length;
  const toggle = h("button", { className: "btn btn-ghost btn-sm" }, count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : t(db, "review.comment_button", "Comment"));
  const panelHost = h("div", { className: "comment-panel-host" });
  const entry = {
    count,
    panelHost,
    targetId: target.id,
    textEl: panelParent,
    get isOpen() { return !!panelHost.firstChild; },
    open(opts) {
      if (entry.isOpen && !opts) return;
      clear(panelHost);
      panelHost.appendChild(buildPanel(db, target, panelHost, () => { entry.close(); layoutMarginThreads(); }, opts));
    },
    close() { clear(panelHost); if (activeEntry === entry) setActive(null); },
  };
  panelHost.addEventListener("focusin", () => setActive(entry));
  panelHost.addEventListener("click", () => setActive(entry));
  mounted.push(entry);
  toggle.addEventListener("click", () => {
    entry.isOpen ? entry.close() : entry.open();
    layoutMarginThreads();
  });
  buttonHost.appendChild(toggle);
  panelParent.appendChild(panelHost);
  return { openWithQuote: (quote, offsets) => {
    entry.open({ quote, offsets });
    layoutMarginThreads();
    setActive(entry);
    panelHost.querySelector("textarea")?.focus();
  } };
}
