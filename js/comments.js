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
    const visible = rows.filter((r) => r.status === "visible" && r.handbook_version === HANDBOOK_VERSION);
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

function renderComment(db, comment, byParent, container, target) {
  const replies = byParent.get(comment.comment_id) || [];
  const node = h("div", { className: "comment-thread" }, [
    comment.selected_text ? h("div", { className: "comment-quote" }, `"${comment.selected_text}"`) : null,
    h("div", { className: "comment-meta" }, [
      h("span", { className: `role-badge ${roleClass(comment.role)}` }, comment.role || "Reviewer"),
      h("span", {}, formatDate(comment.created_at)),
    ]),
    h("div", { className: "comment-body" }, comment.status === "hidden" ? t(db, "review.comment_removed", "Comment removed") : comment.body),
    getReviewer() ? replyToggle(db, comment, container, target) : null,
    h(
      "div",
      { className: "comment-replies" },
      replies.map((r) => renderComment(db, r, byParent, container, target))
    ),
  ]);
  return node;
}

function replyToggle(db, parent, container, target) {
  const btn = h("button", { className: "btn btn-ghost btn-sm" }, t(db, "review.reply_button", "Reply"));
  btn.addEventListener("click", () => {
    const form = commentForm(db, target, { parentId: parent.comment_id }, () => rerenderThread(db, container, target));
    btn.replaceWith(form);
  });
  return btn;
}

function commentForm(db, target, { quote, offsets, parentId } = {}, onPosted) {
  const reviewer = getReviewer();
  const textarea = h("textarea", { placeholder: "Add your comment...", maxLength: 4000 });
  const error = h("div", { className: "form-error" }, "");
  const submit = h("button", { className: "btn btn-primary btn-sm" }, t(db, "review.comment_button", "Comment"));
  submit.addEventListener("click", async () => {
    const body = textarea.value.trim();
    if (!body) return;
    submit.disabled = true;
    try {
      const res = await postComment({
        token: reviewer.token,
        targetId: target.id,
        targetType: target.type,
        handbookVersion: "1.4",
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
  return h("div", { className: "comment-form stack" }, [
    quote ? h("div", { className: "comment-quote" }, `"${quote}"`) : null,
    textarea,
    h("div", { className: "cluster" }, [submit]),
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

function rerenderThread(db, container, target) {
  clear(container);
  container.appendChild(buildPanel(db, target));
}

function buildPanel(db, target) {
  const byParent = threadFor(target.id);
  const topLevel = byParent.get("") || [];
  const wrap = h("div", { className: "comment-panel" });
  wrap.appendChild(
    h(
      "div",
      { className: "stack" },
      topLevel.map((c) => renderComment(db, c, byParent, wrap, target))
    )
  );
  if (getReviewer()) {
    wrap.appendChild(commentForm(db, target, {}, () => rerenderThread(db, wrap, target)));
  } else {
    wrap.appendChild(h("p", { className: "small muted" }, [
      "Sign in as a reviewer to comment -- ",
      h("a", { href: "#/review/register" }, t(db, "review.register_title", "Become a reviewer")),
      ".",
    ]));
  }
  return wrap;
}

/** Mounts a collapsible "N comments" toggle for one target (provision, definition,
 *  law clause, or section guidance). Call after preloadComments() has resolved. */
export function mountCommentToggle(db, target, hostEl) {
  const count = (allComments || []).filter((c) => (c.target === target.id || c.target_id === target.id) && c.status !== "hidden").length;
  const toggle = h("button", { className: "btn btn-ghost btn-sm" }, count > 0 ? `${count} comment${count === 1 ? "" : "s"}` : t(db, "review.comment_button", "Comment"));
  const panelHost = h("div", { className: "comment-panel-host" });
  let open = false;
  toggle.addEventListener("click", () => {
    open = !open;
    if (open) {
      panelHost.appendChild(buildPanel(db, target));
    } else {
      clear(panelHost);
    }
  });
  hostEl.appendChild(toggle);
  hostEl.appendChild(panelHost);
  return { openWithQuote: (quote, offsets) => {
    if (!open) { open = true; clear(panelHost); panelHost.appendChild(buildPanel(db, target)); }
    if (getReviewer()) {
      clear(panelHost);
      const byParent = threadFor(target.id);
      const topLevel = byParent.get("") || [];
      const wrap = h("div", { className: "comment-panel" }, [
        ...topLevel.map((c) => renderComment(db, c, byParent, panelHost, target)),
        commentForm(db, target, { quote, offsets }, () => rerenderThread(db, panelHost, target)),
      ]);
      panelHost.appendChild(wrap);
    }
  } };
}
