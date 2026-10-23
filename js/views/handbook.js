import { h, lawGroupName, sectionLabel, renderMarkdown } from "../utils.js";
import { HANDBOOK_PDF_URL } from "../config.js";
import { t as siteText } from "../data.js";
import { resolveForReading } from "../tokens.js";
import { buildTermMatcher, linkifyTerms } from "../terms.js";
import { addProvision, getActiveDraft, isHandbookView, setHandbookView } from "../state.js";
import { toast } from "../utils.js";

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
  const el = h("div", { className: "provision", id: `prov-${provision.provision_id}` });
  el.appendChild(renderTextBlock(provision.text, provision.footnote_ids, db, matcher));
  if (provision.section_id === "s-note-to-users" || !isHandbookView()) return el; // guidance, not agreement text

  el.classList.add("provision--actionable");
  const actions = h("div", { className: "provision-actions" });
  const addLabel = siteText(db, "builder.add_button", "Add to my agreement");
  const addBtn = h("button", { className: "btn btn-sm btn-add", title: addLabel, ariaLabel: addLabel }, "+ Add");
  addBtn.addEventListener("click", () => {
    addProvision(provision.provision_id);
    toast("Added to your agreement.");
  });
  actions.appendChild(addBtn);
  el.appendChild(actions);

  return el;
}

// The PDF link is a placeholder (#handbook-pdf) in the Markdown: it points at
// HANDBOOK_PDF_URL once that's set, and reads as plain text until then.
function renderIntro(db) {
  const intro = h("div", { className: "handbook-intro", html: renderMarkdown(siteText(db, "handbook.intro", HANDBOOK_INTRO_FALLBACK)) });
  for (const a of intro.querySelectorAll('a[href="#handbook-pdf"]')) {
    if (HANDBOOK_PDF_URL) Object.assign(a, { href: HANDBOOK_PDF_URL, target: "_blank", rel: "noopener" });
    else a.replaceWith(document.createTextNode(a.textContent));
  }
  return intro;
}

function headingTag(depth) {
  return `h${Math.min(4, Math.max(2, depth))}`;
}

function renderDefinitionsSection(db, matcher) {
  const list = h("div", { className: "stack" });
  for (const def of db.definitions) {
    const item = h("div", { className: "provision", id: `def-${def.definition_id}` });
    item.appendChild(h("p", {}, [h("strong", {}, `${def.term}: `), h("span", { html: linkifyTerms(resolveForReading(def.text, db), db.definitions, defByTermMap(db), matcher) })]));
    if (def.footnote_ids) footnoteRefs(def.footnote_ids, db).forEach((r) => item.querySelector("p").appendChild(r));
    list.appendChild(item);
  }
  return list;
}

// The reader intro is one Markdown row in site_text (handbook.intro); this is the
// same text, used only if that row is missing.
const HANDBOOK_INTRO_FALLBACK = `The full text of the Digital Ceasefire & De-escalation Handbook is available here, section by section, or it can be downloaded in full in [PDF format](#handbook-pdf). The Handbook guides users through the process of developing an Agreement, using the Platform's [Build an Agreement function](#/builder). We recommend starting with reading the [Note to Users](#/handbook/s-note-to-users) below. Sections 1.0 through 11.0 then provide model provisions that can be selected, adapted, and combined in [Build an Agreement](#/builder) to construct an Agreement tailored to different conflict and security contexts.`;

const LAW_GROUP_ORDER = ["International Law", "IHL", "ICL", "IHRL"];

function renderLawClausesSection(db, matcher) {
  const wrap = h("div", { className: "stack" });
  for (const group of LAW_GROUP_ORDER) {
    const clauses = db.lawClauses.filter((c) => c.group === group);
    if (!clauses.length) continue;
    wrap.appendChild(h("h3", {}, lawGroupName(group)));
    for (const clause of clauses) {
      const item = h("div", { className: "provision", id: `law-${clause.law_id}` });
      item.appendChild(renderTextBlock(clause.text, clause.footnote_ids, db, matcher));
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

export function renderHandbook({ mountEl, db, params }) {
  const matcher = buildTermMatcher(db.definitions);
  const topSections = db.childSections("");

  const toc = h("nav", { ariaLabel: "Handbook sections" }, renderToc(topSections, db, params.sectionId || null));
  const tocDetails = h("details", { className: "toc-details", open: window.matchMedia("(min-width: 769px)").matches }, [h("summary", {}, "Contents"), toc]);
  const content = h("div", { className: "prose" });
  content.appendChild(h("h1", {}, siteText(db, "handbook.title", "The Handbook")));
  if (isHandbookView()) {
    const bar = h("div", { className: "note-banner compact small cluster" }, [
      h("span", {}, `Handbook view: adding provisions to ${getActiveDraft().name}`),
      h("a", { href: "#/builder" }, "Back to Build an Agreement"),
      h("button", { className: "btn btn-sm btn-ghost", onClick: () => { setHandbookView(false); bar.remove(); content.querySelectorAll(".provision-actions").forEach((e) => e.remove()); } }, "Turn off"),
    ]);
    content.appendChild(bar);
  }
  content.appendChild(renderIntro(db));
  for (const s of topSections) content.appendChild(renderSection(s, db, matcher, 2));
  content.appendChild(renderFootnotesList(db));

  attachDefinitionHoverCards(content, db);

  mountEl.appendChild(h("div", { className: "container section-pad grid-two handbook-layout" }, [
    h("div", { className: "toc" }, [tocDetails]),
    content,
  ]));

  // scroll-spy: highlight the TOC link of the section nearest the top; no URL change
  const links = new Map([...toc.querySelectorAll("a")].map((a) => [a.getAttribute("href"), a]));
  const tocEl = tocDetails.parentElement;
  const spy = new IntersectionObserver((entries) => {
    if (!document.contains(content)) return spy.disconnect();
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const link = links.get(`#/handbook/${e.target.id.slice(4)}`);
      if (!link) continue;
      toc.querySelector("a.active")?.classList.remove("active");
      link.classList.add("active");
      if (tocEl.scrollHeight > tocEl.clientHeight) link.scrollIntoView({ block: "nearest" });
    }
  }, { rootMargin: "-80px 0px -70% 0px" });
  content.querySelectorAll("section.section-block").forEach((s) => spy.observe(s));

  if (params.sectionId) {
    document.getElementById(`sec-${params.sectionId}`)?.scrollIntoView({ behavior: "instant", block: "start" });
  }
}
