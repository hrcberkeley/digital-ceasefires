import { h, clear, toast, openModal, sectionLabel, NON_BUILDER_SECTION_IDS } from "../utils.js";
import { t as siteText } from "../data.js";
import { resolveForReading, resolveForAgreement, resolvePartyPlaceholders, optionIdsIn } from "../tokens.js";
import { findUndefinedCapitalizedTerms } from "../terms.js";
import * as state from "../state.js";
import { downloadMarkdown } from "../export/markdown.js";
import { downloadDocx } from "../export/docx.js";

let unsubscribe = null;

export function renderBuilder({ mountEl, db }) {
  unsubscribe?.();
  const root = h("div", { className: "container section-pad" });
  mountEl.appendChild(root);

  const ui = { showSettings: false, editingId: null, search: "", categoryFilter: "all" };

  const draw = () => {
    clear(root);
    const draft = state.getActiveDraft();
    if (!draft.context) mountStep1(root, db, draw);
    else mountWorkspace(root, db, draft, ui, draw);
  };
  unsubscribe = state.subscribe(draw);
  draw();
}

// ---------------------------------------------------------------------------
// Step 1: choose a context
// ---------------------------------------------------------------------------

function mountStep1(root, db, redraw) {
  let picked = null;
  const wrap = h("div", { className: "stack" });
  root.appendChild(wrap);

  function draw() {
    clear(wrap);
    if (!picked) {
      wrap.appendChild(h("h1", {}, siteText(db, "builder.step1_title", "What kind of situation is this agreement for?")));
      wrap.appendChild(h("p", { className: "muted" }, siteText(db, "builder.step1_help", "")));
      const grid = h("div", { className: "context-choice-grid" });
      for (const code of ["ac", "gz", "id"]) {
        const label = state.CONTEXT_LABELS[code];
        // the defined term for grey zone is just "Grey Zone", not "Grey Zone Activity"
        const def = db.definitions.find((d) => d.term === (code === "gz" ? "Grey Zone" : label));
        const exampleKey = { ac: "context.armed_conflict.example", gz: "context.grey_zone.example", id: "context.internal_disturbance.example" }[code];
        grid.appendChild(
          h("button", { className: "context-choice", onClick: () => { picked = code; draw(); } }, [
            h("h3", {}, label),
            def ? h("p", { className: "small muted" }, truncate(resolveForReading(def.text, db), 160)) : null,
            h("p", { className: "small" }, siteText(db, exampleKey, "")),
          ])
        );
      }
      wrap.appendChild(grid);
    } else {
      const matches = db.provisions.filter((p) => (p.preselect_for || "").split("|").includes(picked));
      const bySection = groupBy(matches, (p) => p.section_id);
      wrap.appendChild(h("h2", {}, `${matches.length} provisions suggested for ${state.CONTEXT_LABELS[picked]}`));
      const list = h(
        "ul",
        { className: "summary-list" },
        [...bySection.entries()].map(([sid, items]) => {
          const section = db.byId.sections.get(sid);
          return h("li", {}, [h("strong", {}, section ? sectionLabel(section) : sid), ` — ${items.length}`]);
        })
      );
      wrap.appendChild(list);
      wrap.appendChild(
        h("div", { className: "cluster" }, [
          h("button", { className: "btn btn-primary", onClick: () => { state.setInitialContext(picked, db); redraw(); } }, siteText(db, "builder.continue", "Continue")),
          h("button", { className: "btn btn-ghost", onClick: () => { state.setContextOnly(picked); redraw(); } }, siteText(db, "builder.start_empty", "Start empty instead")),
        ])
      );
    }
  }
  draw();
}

// ---------------------------------------------------------------------------
// Main workspace
// ---------------------------------------------------------------------------

function mountWorkspace(root, db, draft, ui, redraw) {
  root.appendChild(renderHeader(db, draft, ui, redraw));
  if (ui.showSettings) root.appendChild(renderSettingsPanel(db, draft, redraw));

  const outdated = state.findOutdatedProvisions(db);
  for (const { entry, current } of outdated) {
    root.appendChild(
      h("div", { className: "card small", style: "border-color:var(--color-warning); margin-bottom: var(--space-5);" }, [
        h("strong", {}, `${current.provision_id} has changed in the handbook since you added it.`),
        h("p", {}, `Now reads: "${truncate(resolveForReading(current.text, db), 200)}"`),
        h("div", { className: "cluster" }, [
          button("Keep using the updated text", () => { state.acknowledgeProvisionUpdate(entry.id, db); redraw(); }, "btn-sm"),
          button("Freeze my current wording instead", () => { state.freezeProvisionText(entry.id, db); redraw(); }, "btn-ghost btn-sm"),
        ]),
      ])
    );
  }

  const undefinedTerms = getUndefinedTerms(db, draft);
  if (undefinedTerms.length) {
    root.appendChild(
      h("div", { className: "card small", style: "border-color:var(--color-warning); margin-bottom: var(--space-5);" }, [
        h("strong", {}, siteText(db, "builder.undefined_terms_warning", "")),
        h("p", {}, undefinedTerms.join(", ")),
      ])
    );
  }

  const shell = h("div", { className: "builder-shell" });
  shell.appendChild(renderLibraryPane(db, draft, ui, redraw));
  shell.appendChild(renderAgreementPane(db, draft, redraw));
  root.appendChild(shell);
}

function renderHeader(db, draft, ui, redraw) {
  const drafts = state.listDrafts();
  const select = h(
    "select",
    { className: "text-input", style: "width:auto;", onChange: (e) => { state.switchDraft(e.target.value); redraw(); } },
    drafts.map((d) => h("option", { value: d.id, selected: d.id === draft.id }, d.name))
  );

  const exportMenu = h("div", { className: "cluster" }, [
    button(siteText(db, "builder.export_docx", "Export as Word (.docx)"), () => downloadDocx(db, draft, { includeFootnotes: false }).catch((e) => toast(e.message, "error"))),
    button(siteText(db, "builder.export_markdown", "Export as Markdown"), () => downloadMarkdown(db, draft, { includeFootnotes: false })),
    button(siteText(db, "builder.export_print", "Print / Save as PDF"), () => window.print()),
  ]);

  return h("div", { className: "stack", style: "margin-bottom: var(--space-5);" }, [
    h("div", { className: "cluster", style: "justify-content: space-between;" }, [
      h("div", { className: "cluster" }, [
        select,
        button(siteText(db, "builder.new_draft", "New draft"), () => { state.newDraft(); redraw(); }),
        h("span", { className: "small muted" }, siteText(db, "builder.saved_indicator", "Saved")),
      ]),
      h("div", { className: "cluster" }, [
        button(siteText(db, "builder.settings", "Settings"), () => { ui.showSettings = !ui.showSettings; redraw(); }),
      ]),
    ]),
    exportMenu,
  ]);
}

function renderSettingsPanel(db, draft, redraw) {
  const panel = h("div", { className: "settings-panel stack" });

  panel.appendChild(h("h3", {}, siteText(db, "builder.settings", "Settings")));

  // Context
  panel.appendChild(
    h("div", { className: "field-row" }, [
      h("label", {}, siteText(db, "context.label", "Context")),
      h("div", { className: "cluster" }, [
        h("span", {}, state.CONTEXT_LABELS[draft.context]),
        button("Change", () => openContextChangeModal(db, draft, redraw)),
      ]),
    ])
  );

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

  // Option selections used in the current agreement (e.g. entry into force)
  const usedOptionIds = new Set();
  for (const entry of draft.provisions) {
    const raw = entry.custom ? "" : db.byId.provisions.get(entry.id)?.text || "";
    for (const id of optionIdsIn(raw)) if (id !== "o-context") usedOptionIds.add(id);
  }
  for (const optionId of usedOptionIds) {
    const opt = db.byId.options.get(optionId);
    if (!opt) continue;
    const choices = opt.choices.split("|");
    const select = h(
      "select",
      { className: "text-input" },
      choices.map((c) => h("option", { value: c, selected: (draft.optionSelections[optionId] ?? opt.default) === c }, c))
    );
    select.addEventListener("change", () => state.setOptionSelection(optionId, select.value));
    panel.appendChild(h("div", { className: "field-row" }, [h("label", {}, opt.label), select]));
  }

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

function openContextChangeModal(db, draft, redraw) {
  const options = ["ac", "gz", "id"].filter((c) => c !== draft.context);
  let target = options[0];
  const select = h("select", { className: "text-input" }, options.map((c) => h("option", { value: c }, state.CONTEXT_LABELS[c])));
  select.addEventListener("change", () => { target = select.value; });

  const close = openModal({
    title: siteText(db, "builder.context_change_confirm_title", "Change context?"),
    body: [h("p", {}, siteText(db, "builder.context_change_confirm_body", "")), select],
    actions: [
      button("Cancel", () => close(), "btn-ghost"),
      button(
        "Change context",
        () => {
          state.applyContextChange(target, db);
          close();
          redraw();
        },
        "btn-primary"
      ),
    ],
  });
}

// ---------------------------------------------------------------------------
// Library pane
// ---------------------------------------------------------------------------

function renderLibraryPane(db, draft, ui, redraw) {
  const pane = h("div", { className: "builder-pane" });
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

  const list = h("div", {});
  const q = ui.search.trim().toLowerCase();
  const topSections = db.childSections("").filter((s) => !NON_BUILDER_SECTION_IDS.has(s.section_id));

  for (const section of topSections) {
    const rows = collectLibraryRows(section, db, q);
    if (!rows.length) continue;
    const details = h("details", { className: "library-section", open: !!q });
    details.appendChild(h("summary", {}, sectionLabel(section)));
    for (const p of rows) {
      details.appendChild(renderLibraryItem(p, db, draft, redraw));
    }
    list.appendChild(details);
  }
  pane.appendChild(list);
  return pane;
}

function collectLibraryRows(section, db, query) {
  const all = [section, ...descendantSections(section, db)];
  const rows = all.flatMap((s) => db.provisionsOf(s.section_id));
  if (!query) return rows;
  return rows.filter((p) => p.text.toLowerCase().includes(query));
}

function descendantSections(section, db) {
  const children = db.childSections(section.section_id);
  return children.flatMap((c) => [c, ...descendantSections(c, db)]);
}

function renderLibraryItem(provision, db, draft, redraw) {
  const inAgreement = draft.provisions.some((e) => e.id === provision.provision_id);
  const outsideContext = draft.context && provision.applies_to && !provision.applies_to.split("|").includes(draft.context);
  const item = h("div", { className: `library-item ${inAgreement ? "in-agreement" : ""} ${outsideContext ? "outside-context" : ""}` }, [
    h("p", {}, truncate(resolveForReading(provision.text, db), 140)),
    inAgreement
      ? h("span", { className: "badge badge-added" }, "✓")
      : button("+", () => { state.addProvision(provision.provision_id); redraw(); }, "btn-sm"),
  ]);
  return item;
}

// ---------------------------------------------------------------------------
// Agreement pane
// ---------------------------------------------------------------------------

function renderAgreementPane(db, draft, redraw) {
  const pane = h("div", { className: "builder-pane" });
  pane.appendChild(
    h("div", { className: "builder-pane-header" }, [
      h("h2", {}, siteText(db, "builder.agreement_title", "Your agreement")),
      button(siteText(db, "builder.add_custom_provision", "Add a custom provision"), () => openCustomProvisionModal(db, draft, redraw)),
    ])
  );

  const bySection = groupBy(
    draft.provisions.filter((e) => !e.custom),
    (e) => db.byId.provisions.get(e.id)?.section_id
  );
  const customBySection = groupBy(
    draft.provisions.filter((e) => e.custom),
    (e) => e.sectionId
  );
  const allSectionIds = new Set([...bySection.keys(), ...customBySection.keys()]);
  const sections = [...allSectionIds]
    .map((id) => db.byId.sections.get(id))
    .filter(Boolean)
    .sort((a, b) => Number(a.order) - Number(b.order));

  if (!sections.length) {
    pane.appendChild(h("p", { className: "muted" }, "Nothing added yet -- browse the library on the left."));
  }

  for (const section of sections) {
    pane.appendChild(h("h3", {}, sectionLabel(section)));
    const group = h("div", { className: "section-group", dataset: { sectionId: section.section_id } });
    const entries = [...(bySection.get(section.section_id) || []), ...(customBySection.get(section.section_id) || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    entries.forEach((entry, i) => group.appendChild(renderAgreementItem(entry, db, draft, redraw, entries, i)));
    pane.appendChild(group);
    if (window.Sortable) {
      window.Sortable.create(group, {
        animation: 150,
        onEnd: () => {
          const ids = [...group.children].map((el) => el.dataset.entryId);
          state.reorderWithinSection(ids);
        },
      });
    }
  }

  const attachments = state.getAttachments(db);
  if (attachments.definitions.size || draft.customDefinitions.length) {
    pane.appendChild(h("h3", {}, siteText(db, "builder.export_definitions_heading", "Definitions")));
    for (const id of attachments.definitions) {
      const def = db.byId.definitions.get(id);
      if (def) pane.appendChild(renderAttachedItem(def.definition_id, def.term, def.text, "definitions", attachments.byDefinition.get(id), db, draft, redraw));
    }
    for (const cd of draft.customDefinitions) {
      pane.appendChild(renderAttachedItem(cd.id, cd.term, cd.text, "definitions", null, db, draft, redraw, true));
    }
  }
  if (attachments.lawClauses.size) {
    pane.appendChild(h("h3", {}, siteText(db, "builder.export_annex_heading", "Annex on Commitment to International Law")));
    for (const id of attachments.lawClauses) {
      const clause = db.byId.lawClauses.get(id);
      if (clause) pane.appendChild(renderAttachedItem(clause.law_id, clause.group, clause.text, "lawClauses", attachments.byLaw.get(id), db, draft, redraw));
    }
  }
  pane.appendChild(button(siteText(db, "builder.add_custom_definition", "Add a custom definition"), () => openCustomDefinitionModal(db, redraw)));

  return pane;
}

function renderAgreementItem(entry, db, draft, redraw, siblings, index) {
  const provision = entry.custom ? null : db.byId.provisions.get(entry.id);
  const currentText = entry.text ?? provision?.text ?? "";
  const displayText = resolvePartyPlaceholders(resolveForAgreement(currentText, db, draft.optionSelections), draft.parties);

  const badges = [];
  if (entry.custom) badges.push(h("span", { className: "badge badge-custom" }, "Custom"));
  if (entry.addedVia === "context" && !entry.edited) badges.push(h("span", { className: "badge badge-suggested" }, siteText(db, "builder.suggested_badge", "Suggested for this context")));
  if (entry.edited) badges.push(h("span", { className: "badge badge-edited" }, siteText(db, "builder.edited_badge", "Edited")));

  const item = h("div", { className: "agreement-item", dataset: { entryId: entry.id } });
  const head = h("div", { className: "agreement-item-head" }, [h("div", { className: "cluster" }, badges), moveButtons(siblings, index, db, redraw)]);
  item.appendChild(head);

  const textHost = h("div", {});
  textHost.appendChild(h("p", { className: "provision-text" }, displayText));
  textHost.addEventListener("dblclick", () => startEditing(item, textHost, entry, db, draft, redraw));
  item.appendChild(textHost);

  const actions = h("div", { className: "cluster small" });
  if (!entry.custom && entry.text != null) {
    actions.appendChild(button(siteText(db, "builder.restore_original", "Restore original text"), () => { state.restoreProvisionText(entry.id); redraw(); }, "btn-ghost btn-sm"));
  }
  actions.appendChild(button(siteText(db, "builder.remove", "Remove"), () => { state.removeProvision(entry.id); redraw(); }, "btn-ghost btn-sm btn-danger"));
  item.appendChild(actions);

  return item;
}

function moveButtons(siblings, index, db, redraw) {
  const up = h("button", { className: "btn btn-ghost btn-sm", disabled: index === 0, ariaLabel: "Move up" }, "↑");
  const down = h("button", { className: "btn btn-ghost btn-sm", disabled: index === siblings.length - 1, ariaLabel: "Move down" }, "↓");
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
  const currentRaw = entry.text ?? provision?.text ?? "";
  const textarea = h("textarea", {}, currentRaw);
  const save = button("Save", () => {
    if (entry.custom) {
      entry.text = textarea.value;
    } else {
      state.editProvisionText(entry.id, textarea.value);
    }
    redraw();
  }, "btn-primary btn-sm");
  const cancel = button("Cancel", () => redraw(), "btn-ghost btn-sm");
  textHost.appendChild(textarea);
  textHost.appendChild(h("div", { className: "cluster", style: "margin-top:6px;" }, [save, cancel]));
  textarea.focus();
}

function renderAttachedItem(id, label, text, kind, requiredBy, db, draft, redraw, isCustom = false) {
  const pinned = draft.pinned.includes(id);
  const item = h("div", { className: "agreement-item" }, [
    h("p", {}, [h("strong", {}, `${label}: `), resolvePartyPlaceholders(resolveForAgreement(text, db, draft.optionSelections), draft.parties)]),
  ]);
  const chipRow = h("div", { className: "chip-row" });
  if (requiredBy) {
    for (const provId of requiredBy) {
      const p = db.byId.provisions.get(provId);
      chipRow.appendChild(h("span", { className: "chip" }, p ? `from ${p.provision_id}` : provId));
    }
  }
  item.appendChild(chipRow);
  const actions = h("div", { className: "cluster small" });
  if (isCustom) {
    actions.appendChild(button("Remove", () => {
      const d = state.getActiveDraft();
      d.customDefinitions = d.customDefinitions.filter((c) => c.id !== id);
      redraw();
    }, "btn-ghost btn-sm btn-danger"));
  } else {
    actions.appendChild(
      button(pinned ? siteText(db, "builder.unpin", "Unpin") : siteText(db, "builder.pin", "Pin"), () => {
        (pinned ? state.unpinItem : state.pinItem)(id);
        redraw();
      }, "btn-ghost btn-sm")
    );
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

function getUndefinedTerms(db, draft) {
  const definedLower = new Set([...db.definitions.map((d) => d.term.toLowerCase()), ...draft.customDefinitions.map((d) => d.term.toLowerCase())]);
  const found = new Set();
  for (const entry of draft.provisions) {
    const text = entry.custom ? entry.text : entry.text ?? db.byId.provisions.get(entry.id)?.text ?? "";
    for (const term of findUndefinedCapitalizedTerms(text, definedLower)) found.add(term);
  }
  return [...found];
}
