import { h, sectionLabel } from "../utils.js";
import { t as siteText } from "../data.js";
import { resolveForReading } from "../tokens.js";
import { buildTermMatcher, linkifyTerms } from "../terms.js";
import { preloadComments, mountCommentToggle } from "../comments.js";
import { addProvision } from "../state.js";
import { toast } from "../utils.js";

const selectionTargets = new Map(); // targetId -> { el, openWithQuote, plainText }
let selectionListenerController = null; // torn down/recreated each mount -- see setupSelectionTrigger

// Both float with position:fixed but are appended inside the view's own root
// (not document.body) so the router's clear(mountEl) removes them for free when
// navigating away -- otherwise they'd linger, visible, on top of the next page.
function createHoverCard(root) {
  const card = document.createElement("div");
  card.className = "definition-card";
  card.style.display = "none";
  root.appendChild(card);
  return card;
}

function attachDefinitionHoverCards(root, db) {
  const card = createHoverCard(root);
  const show = (el) => {
    const def = db.byId.definitions.get(el.dataset.defId);
    if (!def) return;
    card.innerHTML = `<strong>${def.term}</strong>${resolveForReading(def.text, db)}`;
    const rect = el.getBoundingClientRect();
    card.style.left = `${Math.max(8, rect.left)}px`;
    card.style.top = `${rect.bottom + window.scrollY + 6}px`;
    card.style.display = "block";
  };
  const hide = () => { card.style.display = "none"; };
  root.addEventListener("mouseover", (e) => { if (e.target.matches(".defined-term")) show(e.target); });
  root.addEventListener("mouseout", (e) => { if (e.target.matches(".defined-term")) hide(); });
  root.addEventListener("focusin", (e) => { if (e.target.matches(".defined-term")) show(e.target); });
  root.addEventListener("focusout", (e) => { if (e.target.matches(".defined-term")) hide(); });
}

function footnoteRefs(footnoteIds, db) {
  return footnoteIds
    .split("|")
    .filter(Boolean)
    .map((id) => {
      const fn = db.byId.footnotes.get(id);
      const num = id.replace("fn-", "");
      return h("sup", {}, h("a", { className: "footnote-ref", href: `#${id}` }, num));
    });
}

function renderTextBlock(rawText, footnoteIds, db, matcher) {
  const resolved = resolveForReading(rawText, db);
  const html = linkifyTerms(resolved, db.definitions, defByTermMap(db), matcher);
  const span = h("span", { html });
  const wrap = h("p", { className: "provision-text" }, [span]);
  if (footnoteIds) footnoteRefs(footnoteIds, db).forEach((r) => wrap.appendChild(r));
  return wrap;
}

let _defByTerm = null;
function defByTermMap(db) {
  if (!_defByTerm) _defByTerm = new Map(db.definitions.map((d) => [d.term, d]));
  return _defByTerm;
}

function renderProvisionBlock(provision, db, matcher) {
  const el = h("div", { className: "provision", id: `prov-${provision.provision_id}`, dataset: { targetId: provision.provision_id } });
  el.appendChild(renderTextBlock(provision.text, provision.footnote_ids, db, matcher));

  const actions = h("div", { className: "provision-actions" });
  const addBtn = h("button", { className: "btn btn-sm btn-primary" }, siteText(db, "builder.add_button", "Add to my agreement"));
  addBtn.addEventListener("click", () => {
    addProvision(provision.provision_id);
    toast("Added to your agreement.");
  });
  actions.appendChild(addBtn);
  el.appendChild(actions);

  const commentHost = h("div", { className: "cluster small" });
  el.appendChild(commentHost);
  const target = { id: provision.provision_id, type: "provision" };
  const { openWithQuote } = mountCommentToggle(db, target, commentHost);
  selectionTargets.set(provision.provision_id, { el, openWithQuote });

  return el;
}

function headingTag(depth) {
  return `h${Math.min(4, Math.max(2, depth))}`;
}

function renderDefinitionsSection(db, matcher) {
  const list = h("div", { className: "stack" });
  for (const def of db.definitions) {
    const item = h("div", { className: "provision", id: `def-${def.definition_id}`, dataset: { targetId: def.definition_id } });
    item.appendChild(h("p", {}, [h("strong", {}, `${def.term}: `), h("span", { html: linkifyTerms(resolveForReading(def.text, db), db.definitions, defByTermMap(db), matcher) })]));
    if (def.footnote_ids) footnoteRefs(def.footnote_ids, db).forEach((r) => item.querySelector("p").appendChild(r));
    const commentHost = h("div", { className: "cluster small" });
    item.appendChild(commentHost);
    mountCommentToggle(db, { id: def.definition_id, type: "definition" }, commentHost);
    list.appendChild(item);
  }
  return list;
}

const LAW_GROUP_ORDER = ["International Law", "IHL", "ICL", "IHRL"];

function renderLawClausesSection(db, matcher) {
  const wrap = h("div", { className: "stack" });
  for (const group of LAW_GROUP_ORDER) {
    const clauses = db.lawClauses.filter((c) => c.group === group);
    if (!clauses.length) continue;
    wrap.appendChild(h("h3", {}, group));
    for (const clause of clauses) {
      const item = h("div", { className: "provision", id: `law-${clause.law_id}`, dataset: { targetId: clause.law_id } });
      item.appendChild(renderTextBlock(clause.text, clause.footnote_ids, db, matcher));
      const commentHost = h("div", { className: "cluster small" });
      item.appendChild(commentHost);
      mountCommentToggle(db, { id: clause.law_id, type: "law_clause" }, commentHost);
      wrap.appendChild(item);
    }
  }
  return wrap;
}

function renderSection(section, db, matcher, depth) {
  const block = h("section", { className: "section-block", id: `sec-${section.section_id}` });
  block.appendChild(h(headingTag(depth), {}, sectionLabel(section)));
  if (section.guidance) {
    for (const para of section.guidance.split("\n\n")) {
      block.appendChild(h("p", { className: "section-guidance" }, para));
    }
  }

  if (section.section_id === "s-9.0") {
    block.appendChild(renderDefinitionsSection(db, matcher));
  } else if (section.section_id === "s-11.0") {
    block.appendChild(renderLawClausesSection(db, matcher));
  } else {
    for (const p of db.provisionsOf(section.section_id)) {
      block.appendChild(renderProvisionBlock(p, db, matcher));
    }
  }

  for (const child of db.childSections(section.section_id)) {
    block.appendChild(renderSection(child, db, matcher, depth + 1));
  }
  return block;
}

function renderToc(sections, db, activeId) {
  const ul = h("ul", { className: "toc-list" });
  for (const s of sections) {
    const li = h("li", {}, [
      h("a", { href: `#/handbook/${s.section_id}`, className: s.section_id === activeId ? "active" : "" }, sectionLabel(s)),
    ]);
    const children = db.childSections(s.section_id);
    if (children.length) li.appendChild(renderToc(children, db, activeId));
    ul.appendChild(li);
  }
  return ul;
}

function renderFootnotesList(db) {
  const used = db.footnotes.filter((f) => f.text);
  return h("section", { className: "footnotes-list" }, [
    h("h3", {}, "Footnotes"),
    h(
      "ol",
      {},
      used.map((f) => h("li", { id: f.footnote_id }, [f.text, f.url ? h("a", { href: f.url, target: "_blank", rel: "noopener" }, ` [source]`) : null]))
    ),
  ]);
}

function setupSelectionTrigger(root, db) {
  // document-level listener outlives this view's own DOM, so it needs its own
  // explicit teardown -- abort the previous mount's listener before adding a new one.
  selectionListenerController?.abort();
  selectionListenerController = new AbortController();

  const trigger = h("button", { className: "comment-trigger" }, siteText(db, "review.comment_button", "Comment"));
  root.appendChild(trigger);

  document.addEventListener("selectionchange", () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !root.contains(sel.anchorNode)) {
      trigger.style.display = "none";
      return;
    }
    const container = sel.anchorNode.parentElement?.closest("[data-target-id]");
    const focusContainer = sel.focusNode.parentElement?.closest("[data-target-id]");
    if (!container || container !== focusContainer) {
      trigger.style.display = "none";
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    trigger.style.left = `${rect.left}px`;
    trigger.style.top = `${rect.top + window.scrollY - 36}px`;
    trigger.style.display = "block";
    trigger.onclick = () => {
      const text = sel.toString().trim();
      const targetId = container.dataset.targetId;
      const entry = selectionTargets.get(targetId);
      trigger.style.display = "none";
      if (entry) entry.openWithQuote(text, {});
    };
  }, { signal: selectionListenerController.signal });
}

export async function renderHandbook({ mountEl, db, params }) {
  selectionTargets.clear();
  await preloadComments();
  const matcher = buildTermMatcher(db.definitions);
  const topSections = db.childSections("");

  const toc = h("nav", { className: "toc", ariaLabel: "Handbook sections" }, renderToc(topSections, db, params.sectionId || null));
  const content = h("div", { className: "prose" });
  for (const s of topSections) content.appendChild(renderSection(s, db, matcher, 2));
  content.appendChild(renderFootnotesList(db));

  attachDefinitionHoverCards(content, db);
  setupSelectionTrigger(content, db);

  mountEl.appendChild(h("div", { className: "container section-pad grid-two" }, [toc, content]));

  if (params.sectionId) {
    document.getElementById(`sec-${params.sectionId}`)?.scrollIntoView({ behavior: "instant", block: "start" });
  }
}
