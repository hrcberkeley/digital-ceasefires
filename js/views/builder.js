import { h, clear, toast, openModal, sectionLabel, renderMarkdown, lawGroupName, NON_BUILDER_SECTION_IDS } from "../utils.js";
import { t as siteText } from "../data.js";
import { resolveForReading, resolveForAgreement, resolvePartyPlaceholders, splitOptions } from "../tokens.js";
import * as state from "../state.js";
import { downloadMarkdown } from "../export/markdown.js";
import { downloadDocx } from "../export/docx.js";

let unsubscribe = null;
// Folded Definitions still belong in the printed Agreement.
addEventListener("beforeprint", () => document.querySelectorAll(".agreement-definitions").forEach((d) => { d.open = true; }));

export function renderBuilder({ mountEl, db }) {
  unsubscribe?.();
  const root = h("div", { className: "container section-pad" });
  mountEl.appendChild(root);

  // `open` remembers which library sections are expanded, so adding a provision
  // (which redraws everything) doesn't fold the section you're browsing shut.
  // `focusId` is the provision just added, scrolled into view in the agreement pane.
  const ui = { showSettings: false, editingId: null, search: "", open: new Set(), focusId: null };

  // Every change redraws everything, so keep both panes (and the page) where they were.
  const draw = () => {
    const scrolls = [...root.querySelectorAll(".builder-pane")].map((p) => p.scrollTop);
    const pageY = window.scrollY;
    clear(root);
    mountWorkspace(root, db, state.getActiveDraft(), ui, draw);
    root.querySelectorAll(".builder-pane").forEach((p, i) => { p.scrollTop = scrolls[i] ?? 0; });
    window.scrollTo(0, pageY);
    if (ui.focusId) {
      const el = root.querySelector(`.agreement-pane [data-entry-id="${CSS.escape(ui.focusId)}"]`);
      ui.focusId = null;
      if (el) { scrollPaneTo(el); el.classList.add("just-added"); }
    }
  };
  unsubscribe = state.subscribe(draw);
  draw();
}

// ---------------------------------------------------------------------------
// Main workspace
// ---------------------------------------------------------------------------

function mountWorkspace(root, db, draft, ui, redraw) {
  root.appendChild(renderIntro(db, draft, ui, redraw));
  root.appendChild(renderHeader(db, draft, ui, redraw));
  if (ui.showSettings) root.appendChild(renderSettingsPanel(db, draft, redraw));

  const outdated = state.findOutdatedProvisions(db);
  for (const { entry, current } of outdated) {
    root.appendChild(
      h("div", { className: "note-banner compact small" }, [
        h("strong", {}, `${current.provision_id} has changed in the handbook since you added it.`),
        h("p", {}, `Now reads: "${truncate(resolveForReading(current.text, db), 200)}"`),
        h("div", { className: "cluster" }, [
          button("Keep using the updated text", () => { state.acknowledgeProvisionUpdate(entry.id, db); redraw(); }, "btn-sm"),
          button("Freeze my current wording instead", () => { state.freezeProvisionText(entry.id, db); redraw(); }, "btn-ghost btn-sm"),
        ]),
      ])
    );
  }

  const shell = h("div", { className: "builder-shell" });
  shell.appendChild(renderLibraryPane(db, draft, ui, redraw));
  shell.appendChild(renderAgreementPane(db, draft, ui, redraw));
  root.appendChild(shell);
}

const NOTE_TO_USERS_HREF = "#/handbook/s-note-to-users";
const BUILDER_SECTION_IDS = (db) => new Set(db.sections.filter((s) => !NON_BUILDER_SECTION_IDS.has(s.section_id)).map((s) => s.section_id));

function renderIntro(db, draft, ui, redraw) {
  const wrap = h("div", { className: "builder-intro stack no-print" }, [
    h("div", { className: "note-banner", html: renderMarkdown(siteText(db, "builder.note_banner", `**Read this first:** the [Note to Users](${NOTE_TO_USERS_HREF}) explains how the Handbook's provisions fit together and how to adapt them.`)) }),
    h("details", { className: "builder-intro-text", open: !draft.provisions.length }, [
      h("summary", {}, h("h1", {}, siteText(db, "builder.intro_title", "Build Your Own Agreement"))),
      h("div", { className: "prose", html: renderMarkdown(siteText(db, "builder.intro", BUILDER_INTRO_FALLBACK)) }),
    ]),
  ]);
  if (!draft.provisions.length) {
    wrap.appendChild(
      h("div", { className: "cluster" }, [
        button(siteText(db, "builder.start_scratch", "Build from scratch"), () => document.querySelector(".search-input")?.focus(), "btn-primary"),
        button(siteText(db, "builder.start_full", "Start with the full Agreement"), () => { state.addEverything(db, BUILDER_SECTION_IDS(db)); redraw(); }),
        handbookViewLink(db),
      ])
    );
  }
  return wrap;
}

const BUILDER_INTRO_FALLBACK = `Use the Build an Agreement function to create an Agreement tailored to your specific conflict or security context. We recommend reading the [Note to Users](${NOTE_TO_USERS_HREF}) before you begin.

To get started, choose one of three approaches:

- **Build from scratch:** Select the provisions you wish to include from the left-hand column and add them to your Agreement in the right-hand column.
- **Start with the full Agreement:** Add all of the Handbook's model provisions to your Agreement, then remove those that are not relevant.
- **Use Handbook view:** Read the Handbook section by section and add provisions to your Agreement as you go.

Either way, once you have selected your provisions, you can edit and adapt the text in the right-hand column to reflect the specific circumstances, priorities, and commitments of the Parties.

Your Agreement is saved automatically in this browser, and you can come back to it at any time. You will find your saved Agreements in the Drafts box at the top left of the builder.

You can download your Agreement in various formats: Word, Markdown and PDF, by selecting the format in the Export drop down.

A few things to note:

- Terms that are defined will be included in the Definitions section, which you can add to.
- Relevant footnotes will also be included in the final Agreement.`;

const handbookViewLink = (db) => h("a", { className: "btn", href: "#/handbook", onClick: () => state.setHandbookView(true) }, siteText(db, "builder.start_handbook", "Use Handbook view"));

function renderHeader(db, draft, ui, redraw) {
  const drafts = state.listDrafts();
  const select = h(
    "select",
    { className: "text-input", style: "width:auto;", onChange: (e) => { state.switchDraft(e.target.value); redraw(); } },
    drafts.map((d) => h("option", { value: d.id, selected: d.id === draft.id }, d.name))
  );

  const exportMenu = h("details", { className: "export-menu" }, [h("summary", { className: "btn" }, "Export ▾")]);
  const choice = (label, fn) => button(label, () => { exportMenu.open = false; fn(); }, "btn-ghost btn-sm");
  exportMenu.appendChild(h("div", { className: "export-menu-panel" }, [
    choice(siteText(db, "builder.export_docx", "Export as Word (.docx)"), () => downloadDocx(db, draft).catch((e) => toast(e.message, "error"))),
    choice(siteText(db, "builder.export_markdown", "Export as Markdown"), () => downloadMarkdown(db, draft)),
    choice(siteText(db, "builder.export_print", "Print / Save as PDF"), () => window.print()),
  ]));

  return h("div", { className: "stack no-print", style: "margin-bottom: var(--space-5);" }, [
    h("div", { className: "cluster", style: "justify-content: space-between;" }, [
      h("div", { className: "cluster" }, [
        h("label", { className: "small muted" }, siteText(db, "builder.drafts_label", "Drafts")),
        select,
        button(siteText(db, "builder.new_draft", "New draft"), () => { state.newDraft(); redraw(); }),
        button(siteText(db, "builder.delete_draft", "Delete draft"), () => {
          if (confirm(`Delete "${draft.name}"? This can't be undone.`)) { state.deleteDraft(draft.id); redraw(); }
        }, "btn-ghost btn-danger"),
        h("span", { className: "small muted" }, siteText(db, "builder.saved_indicator", "Saved")),
      ]),
      h("div", { className: "cluster" }, [
        h("label", { className: "small muted" }, siteText(db, "context.label", "Context")),
        contextSelect(db, draft),
        button(siteText(db, "builder.settings", "Settings"), () => { ui.showSettings = !ui.showSettings; redraw(); }),
        handbookViewLink(db),
        exportMenu,
      ]),
    ]),
  ]);
}

function renderSettingsPanel(db, draft, redraw) {
  const panel = h("div", { className: "settings-panel stack" });

  panel.appendChild(h("h3", {}, siteText(db, "builder.settings", "Settings")));
  panel.appendChild(h("p", { className: "small muted" }, siteText(db, "builder.settings_help", "Name the Parties to fill [Party A], [Party B] and so on throughout your Agreement, or save this draft as a file to share or reopen later.")));

  // Parties
  const partiesField = h("div", { className: "field-row" }, [h("label", {}, siteText(db, "builder.parties_label", "Parties"))]);
  const parties = draft.parties.length ? draft.parties : ["", "", ""];
  parties.forEach((name, i) => {
    const label = `Party ${"ABCDEFGHIJ"[i] || i + 1}`;
    const input = h("input", { className: "text-input", value: name, placeholder: label });
    input.addEventListener("change", () => {
      const updated = [...parties];
      updated[i] = input.value;
      state.setParties(updated);
    });
    partiesField.appendChild(h("div", { className: "party-list-row" }, [h("span", { className: "small muted", style: "width:80px;" }, label), input]));
  });
  partiesField.appendChild(
    button("+ Add party", () => { state.setParties([...parties, ""]); redraw(); }, "btn-ghost btn-sm")
  );
  panel.appendChild(partiesField);

  // Import / export JSON
  const fileInput = h("input", { type: "file", accept: "application/json", style: "display:none;" });
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;
    try {
      state.importDraft(await file.text());
      redraw();
      toast("Draft imported.");
    } catch {
      toast("Couldn't read that file.", "error");
    }
  });
  panel.appendChild(
    h("div", { className: "cluster" }, [
      button("Export draft (.json)", () => {
        const blob = new Blob([state.exportDraft()], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = h("a", { href: url, download: `${draft.name}.ceasefire.json` });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }),
      button("Import draft (.json)", () => fileInput.click()),
      fileInput,
    ])
  );

  return panel;
}

// Context only fills the [Armed Conflict] [Grey Zone Activity] [Internal Disturbance]
// wording and flags which International Law clauses are suggested -- it never adds provisions.
function contextSelect(db, draft) {
  const select = h(
    "select",
    { className: "text-input", style: "width:auto;", title: siteText(db, "builder.context_help", "Fills the context wording in your Agreement and suggests relevant International Law commitments.") },
    [
      h("option", { value: "", selected: !draft.context }, siteText(db, "builder.context_none", "Not specified")),
      ...Object.entries(state.CONTEXT_LABELS).map(([code, label]) => h("option", { value: code, selected: draft.context === code }, label)),
    ]
  );
  select.addEventListener("change", () => state.setContext(select.value));
  return select;
}

// ---------------------------------------------------------------------------
// Library pane
// ---------------------------------------------------------------------------

function renderLibraryPane(db, draft, ui, redraw) {
  const pane = h("div", { className: "builder-pane library-pane no-print" });
  pane.appendChild(h("div", { className: "builder-pane-header" }, [h("h2", {}, siteText(db, "builder.library_title", "Provision library"))]));

  const search = h("input", { className: "search-input", type: "search", placeholder: siteText(db, "builder.library_search_placeholder", "Search provisions..."), value: ui.search });
  search.addEventListener("input", () => {
    ui.search = search.value;
    const caret = search.selectionStart;
    redraw(); // full rebuild -- restore focus/caret on the new input it creates
    const fresh = document.querySelector(".search-input");
    if (fresh) { fresh.focus(); fresh.setSelectionRange(caret, caret); }
  });
  pane.appendChild(search);

  const q = ui.search.trim().toLowerCase();
  const list = h("div", { className: "library-list" });
  for (const section of db.childSections("")) {
    if (NON_BUILDER_SECTION_IDS.has(section.section_id)) continue;
    const node = renderLibrarySection(section, db, draft, ui, redraw, q);
    if (node) list.appendChild(node);
  }
  const annex = renderLawLibrary(db, draft, ui, redraw, q);
  if (annex) list.appendChild(annex);
  pane.appendChild(list);
  return pane;
}

// One <details> per Handbook section, nested like the Handbook (3.0 > 3.1 > 3.1.1),
// with the section's guidance text and its own provisions above its subsections.
function renderLibrarySection(section, db, draft, ui, redraw, q) {
  const own = db.provisionsOf(section.section_id).filter((p) => !q || p.text.toLowerCase().includes(q));
  const children = db.childSections(section.section_id).map((c) => renderLibrarySection(c, db, draft, ui, redraw, q)).filter(Boolean);
  if (!own.length && !children.length) return null;

  const details = libraryDetails(section.section_id, sectionLabel(section), ui, q);
  if (section.guidance && !q) {
    details.appendChild(h("details", { className: "library-guidance" }, [
      h("summary", {}, siteText(db, "builder.section_guidance", "Note to Users for this section")),
      ...section.guidance.split("\n\n").map((para) => h("p", { className: "small" }, para)),
    ]));
  }
  for (const p of own) details.appendChild(renderLibraryItem(p, db, draft, ui, redraw));
  for (const c of children) details.appendChild(c);
  return details;
}

function libraryDetails(id, label, ui, q) {
  const details = h("details", { className: "library-section", open: !!q || ui.open.has(id) }, [h("summary", {}, label)]);
  details.addEventListener("toggle", (e) => {
    if (e.target !== details) return; // nested <details> bubble their own toggles
    details.open ? ui.open.add(id) : ui.open.delete(id);
    if (details.open) {
      const heading = document.querySelector(`.agreement-pane [data-section-id="${CSS.escape(id)}"]`);
      if (heading) scrollPaneTo(heading);
    }
  });
  return details;
}

const LAW_GROUP_ORDER = ["International Law", "IHL", "ICL", "IHRL"];

// Commitments to International Law: added by pinning, since attached law clauses
// already render (and export) as the Annex.
function renderLawLibrary(db, draft, ui, redraw, q) {
  const annex = db.byId.sections.get("s-11.0");
  const details = libraryDetails("s-11.0", annex ? sectionLabel(annex) : "Annex on Commitment to International Law", ui, q);
  let any = false;
  for (const group of LAW_GROUP_ORDER) {
    const clauses = db.lawClauses.filter((c) => c.group === group && (!q || c.text.toLowerCase().includes(q)));
    if (!clauses.length) continue;
    any = true;
    details.appendChild(h("h4", { className: "library-subhead" }, lawGroupName(group)));
    for (const c of clauses) {
      const added = draft.pinned.includes(c.law_id);
      const suggested = state.isSuggestedLawClause(c);
      const acOnly = c.applies_to === "ac";
      const full = resolveForReading(c.text, db);
      details.appendChild(
        h("div", { className: `library-item ${added ? "in-agreement" : ""}`, title: full }, [
          h("div", {}, [
            suggested && !added ? h("span", { className: "badge badge-suggested" }, siteText(db, "builder.suggested_badge", "Suggested for this context")) : null,
            acOnly && !suggested ? h("span", { className: "badge" }, siteText(db, "builder.ac_only_badge", "Armed Conflict only")) : null,
            h("p", {}, truncate(full, 140)),
          ]),
          added
            ? button("✓", () => { state.unpinItem(c.law_id); redraw(); }, "btn-sm badge-added")
            : button("+", () => { state.pinItem(c.law_id); redraw(); }, "btn-sm"),
        ])
      );
    }
  }
  return any ? details : null;
}

function renderLibraryItem(provision, db, draft, ui, redraw) {
  const inAgreement = draft.provisions.some((e) => e.id === provision.provision_id);
  const full = resolveForReading(provision.text, db);
  const item = h("div", { className: `library-item ${inAgreement ? "in-agreement" : ""}`, title: full }, [
    h("p", {}, truncate(full, 140)),
    inAgreement
      ? h("span", { className: "badge badge-added" }, "✓")
      : button("+", () => { state.addProvision(provision.provision_id); ui.focusId = provision.provision_id; redraw(); }, "btn-sm"),
  ]);
  return item;
}

// ---------------------------------------------------------------------------
// Agreement pane
// ---------------------------------------------------------------------------

function renderAgreementPane(db, draft, ui, redraw) {
  const pane = h("div", { className: "builder-pane agreement-pane" });
  pane.appendChild(
    h("div", { className: "builder-pane-header" }, [
      h("h2", {}, siteText(db, "builder.agreement_title", "Your agreement")),
      button(siteText(db, "builder.add_custom_provision", "Add a custom provision"), () => openCustomProvisionModal(db, draft, redraw)),
    ])
  );

  if (draft.provisions.length) {
    pane.appendChild(h("p", { className: "small muted no-print" }, siteText(db, "builder.reorder_hint", "Drag or use ↑ ↓ to reorder provisions within a section.")));
  }

  const bySection = groupBy(draft.provisions, (e) => (e.custom ? e.sectionId : db.byId.provisions.get(e.id)?.section_id));
  const outline = state.agreementOutline(db);

  if (!outline.length) {
    pane.appendChild(h("p", { className: "muted" }, siteText(db, "builder.empty_agreement", "Nothing added yet -- browse the library on the left.")));
  }

  const renderOutline = (list) => {
    for (const { section, number, depth } of list) {
      pane.appendChild(h(`h${Math.min(3 + depth, 5)}`, { className: "agreement-heading", dataset: { sectionId: section.section_id } }, `${number}. ${section.title}`));
      const entries = (bySection.get(section.section_id) || []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      if (!entries.length) continue;
      const group = h("div", { className: "section-group", dataset: { sectionId: section.section_id } });
      entries.forEach((entry, i) => group.appendChild(renderAgreementItem(entry, db, draft, redraw, entries, i)));
      pane.appendChild(group);
      if (window.Sortable) {
        window.Sortable.create(group, {
          animation: 150,
          onEnd: () => state.reorderWithinSection([...group.children].map((el) => el.dataset.entryId)),
        });
      }
    }
  };
  // Definitions sit between the body and the Signatures, like the exports
  renderOutline(outline.filter((o) => o.section.section_id !== "s-10.0"));

  // Definitions fold shut (they're long) so the substantive provisions stay close together
  const attachments = state.getAttachments(db);
  const defCount = attachments.definitions.size + draft.customDefinitions.length;
  const defs = h("details", { className: "agreement-definitions", open: ui.open.has("defs") }, [
    h("summary", {}, h("h3", {}, `${siteText(db, "builder.export_definitions_heading", "Definitions")} (${defCount})`)),
  ]);
  defs.addEventListener("toggle", () => { defs.open ? ui.open.add("defs") : ui.open.delete("defs"); });
  for (const id of attachments.definitions) {
    const def = db.byId.definitions.get(id);
    if (def) defs.appendChild(renderAttachedItem(def.definition_id, def.term, def.text, attachments.byDefinition.get(id), db, draft, redraw));
  }
  for (const cd of draft.customDefinitions) {
    defs.appendChild(renderAttachedItem(cd.id, cd.term, cd.text, null, db, draft, redraw, true));
  }
  defs.appendChild(button(siteText(db, "builder.add_custom_definition", "Add a custom definition"), () => openCustomDefinitionModal(db, redraw)));
  pane.appendChild(defs);
  renderOutline(outline.filter((o) => o.section.section_id === "s-10.0"));
  if (attachments.lawClauses.size) {
    pane.appendChild(h("h3", {}, siteText(db, "builder.export_annex_heading", "Annex on Commitment to International Law")));
    for (const id of attachments.lawClauses) {
      const clause = db.byId.lawClauses.get(id);
      if (clause) pane.appendChild(renderAttachedItem(clause.law_id, lawGroupName(clause.group), clause.text, attachments.byLaw.get(id), db, draft, redraw));
    }
  }
  if (draft.excluded?.length) {
    pane.appendChild(h("p", { className: "small muted no-print" }, [
      `${draft.excluded.length} removed definition(s) or clause(s). `,
      button(siteText(db, "builder.restore_removed", "Restore them"), () => { state.restoreExcluded(); redraw(); }, "btn-ghost btn-sm"),
    ]));
  }

  return pane;
}

function renderAgreementItem(entry, db, draft, redraw, siblings, index) {
  const provision = entry.custom ? null : db.byId.provisions.get(entry.id);
  const currentText = entry.text ?? provision?.text ?? "";

  const badges = [];
  if (entry.custom) badges.push(h("span", { className: "badge badge-custom" }, "Custom"));
  if (entry.edited) badges.push(h("span", { className: "badge badge-edited" }, siteText(db, "builder.edited_badge", "Edited")));

  const item = h("div", { className: "agreement-item", dataset: { entryId: entry.id } });
  const head = h("div", { className: "agreement-item-head" }, [h("div", { className: "cluster" }, badges), moveButtons(siblings, index, db, redraw)]);
  item.appendChild(head);

  const textHost = h("div", {});
  textHost.appendChild(h("p", { className: "provision-text" }, inlineText(currentText, db, draft)));
  textHost.addEventListener("dblclick", (e) => { if (e.target.tagName !== "SELECT") startEditing(item, textHost, entry, db, draft, redraw); });
  item.appendChild(textHost);

  const actions = h("div", { className: "cluster small" });
  actions.appendChild(button(siteText(db, "builder.edit", "Edit"), () => startEditing(item, textHost, entry, db, draft, redraw), "btn-ghost btn-sm"));
  if (!entry.custom && entry.text != null) {
    actions.appendChild(button(siteText(db, "builder.restore_original", "Restore original text"), () => { state.restoreProvisionText(entry.id); redraw(); }, "btn-ghost btn-sm"));
  }
  actions.appendChild(button(siteText(db, "builder.remove", "Remove"), () => { state.removeProvision(entry.id); redraw(); }, "btn-ghost btn-sm btn-danger"));
  item.appendChild(actions);

  return item;
}

// Each {{o-...}} alternative becomes a dropdown in the text; print shows the chosen words
// (or the Handbook's bracketed alternatives while nothing is chosen).
function inlineText(text, db, draft) {
  return splitOptions(text, db, draft.optionSelections).map((seg) => {
    if (!seg.optionId) return resolvePartyPlaceholders(seg.text, draft.parties);
    const opt = db.byId.options.get(seg.optionId);
    const chosen = draft.optionSelections[seg.optionId] || "";
    const select = h("select", { className: `inline-choice ${chosen ? "" : "unchosen"}`, title: opt.label }, [
      h("option", { value: "", selected: !chosen }, siteText(db, "builder.choose_option", "[choose an option]")),
      ...opt.choices.split("|").map((c) => h("option", { value: c, selected: c === chosen }, c)),
    ]);
    select.addEventListener("change", () => state.setOptionSelection(seg.optionId, select.value));
    return h("span", {}, [select, h("span", { className: "print-only" }, seg.text)]);
  });
}

function scrollPaneTo(el) {
  const pane = el.closest(".builder-pane");
  if (!pane) return;
  pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - 60; // clear the sticky pane header
}

function moveButtons(siblings, index, db, redraw) {
  const up_label = siteText(db, "builder.move_up", "Move up within this section");
  const down_label = siteText(db, "builder.move_down", "Move down within this section");
  const up = h("button", { className: "btn btn-ghost btn-sm", disabled: index === 0, title: up_label, ariaLabel: up_label }, "↑");
  const down = h("button", { className: "btn btn-ghost btn-sm", disabled: index === siblings.length - 1, title: down_label, ariaLabel: down_label }, "↓");
  up.addEventListener("click", () => {
    const ids = siblings.map((s) => s.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    state.reorderWithinSection(ids);
    redraw();
  });
  down.addEventListener("click", () => {
    const ids = siblings.map((s) => s.id);
    [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
    state.reorderWithinSection(ids);
    redraw();
  });
  return h("div", { className: "cluster" }, [up, down]);
}

function startEditing(item, textHost, entry, db, draft, redraw) {
  clear(textHost);
  const provision = entry.custom ? null : db.byId.provisions.get(entry.id);
  const textarea = editor(resolveForAgreement(entry.text ?? provision?.text ?? "", db, draft.optionSelections));
  const save = button("Save", () => { state.editProvisionText(entry.id, textarea.value); redraw(); }, "btn-primary btn-sm");
  const cancel = button("Cancel", () => redraw(), "btn-ghost btn-sm");
  textHost.appendChild(textarea);
  textHost.appendChild(h("div", { className: "cluster", style: "margin-top:6px;" }, [save, cancel]));
  textarea.focus();
}

function editor(raw) {
  return h("textarea", { style: "width:100%;", rows: Math.min(20, Math.max(4, Math.ceil(raw.length / 90) + 1)) }, raw);
}

function renderAttachedItem(id, label, text, requiredBy, db, draft, redraw, isCustom = false) {
  const edited = !isCustom && draft.definitionEdits?.[id] != null;
  if (edited) text = draft.definitionEdits[id];
  const item = h("div", { className: "agreement-item" });
  if (edited) item.appendChild(h("div", { className: "agreement-item-head" }, h("span", { className: "badge badge-edited" }, siteText(db, "builder.edited_badge", "Edited"))));
  const textHost = h("div", {}, [
    h("p", {}, [h("strong", {}, `${label}: `), resolvePartyPlaceholders(resolveForAgreement(text, db, draft.optionSelections), draft.parties)]),
  ]);
  item.appendChild(textHost);
  const chipRow = h("div", { className: "chip-row" });
  if (requiredBy) {
    for (const provId of requiredBy) {
      const p = db.byId.provisions.get(provId);
      chipRow.appendChild(h("span", { className: "chip" }, p ? `from ${p.provision_id}` : provId));
    }
  }
  item.appendChild(chipRow);
  const actions = h("div", { className: "cluster small" });
  {
    const startEdit = () => {
      clear(textHost);
      const textarea = editor(text);
      textHost.appendChild(textarea);
      textHost.appendChild(h("div", { className: "cluster", style: "margin-top:6px;" }, [
        button("Save", () => { state.editDefinitionText(id, textarea.value); redraw(); }, "btn-primary btn-sm"),
        button("Cancel", () => redraw(), "btn-ghost btn-sm"),
      ]));
      textarea.focus();
    };
    textHost.addEventListener("dblclick", startEdit);
    actions.appendChild(button(siteText(db, "builder.edit", "Edit"), startEdit, "btn-ghost btn-sm"));
    if (edited) actions.appendChild(button(siteText(db, "builder.restore_original", "Restore original text"), () => { state.restoreDefinitionText(id); redraw(); }, "btn-ghost btn-sm"));
  }
  if (isCustom) {
    actions.appendChild(button("Remove", () => {
      const d = state.getActiveDraft();
      d.customDefinitions = d.customDefinitions.filter((c) => c.id !== id);
      redraw();
    }, "btn-ghost btn-sm btn-danger"));
  } else {
    actions.appendChild(button(siteText(db, "builder.remove", "Remove"), () => { state.excludeItem(id); redraw(); }, "btn-ghost btn-sm btn-danger"));
  }
  item.appendChild(actions);
  return item;
}

function openCustomProvisionModal(db, draft, redraw) {
  const sectionSelect = h("select", { className: "text-input" }, db.sections.filter((s) => !NON_BUILDER_SECTION_IDS.has(s.section_id)).map((s) => h("option", { value: s.section_id }, sectionLabel(s))));
  const textarea = h("textarea", { className: "text-input", placeholder: "Provision text" });
  const close = openModal({
    title: siteText(db, "builder.add_custom_provision", "Add a custom provision"),
    body: [h("div", { className: "field-row" }, [h("label", {}, "Section"), sectionSelect]), h("div", { className: "field-row" }, [h("label", {}, "Text"), textarea])],
    actions: [
      button("Cancel", () => close(), "btn-ghost"),
      button("Add", () => {
        if (!textarea.value.trim()) return;
        state.addCustomProvision(sectionSelect.value, textarea.value.trim());
        close();
        redraw();
      }, "btn-primary"),
    ],
  });
}

function openCustomDefinitionModal(db, redraw) {
  const termInput = h("input", { className: "text-input", placeholder: "Term" });
  const textarea = h("textarea", { className: "text-input", placeholder: "Definition" });
  const close = openModal({
    title: siteText(db, "builder.add_custom_definition", "Add a custom definition"),
    body: [h("div", { className: "field-row" }, [h("label", {}, "Term"), termInput]), h("div", { className: "field-row" }, [h("label", {}, "Definition"), textarea])],
    actions: [
      button("Cancel", () => close(), "btn-ghost"),
      button("Add", () => {
        if (!termInput.value.trim() || !textarea.value.trim()) return;
        state.addCustomDefinition(termInput.value.trim(), textarea.value.trim());
        close();
        redraw();
      }, "btn-primary"),
    ],
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function button(label, onClick, modifiers = "") {
  return h("button", { className: `btn ${modifiers}`.trim(), onClick }, label);
}

function truncate(text, len) {
  return text.length > len ? `${text.slice(0, len)}...` : text;
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
