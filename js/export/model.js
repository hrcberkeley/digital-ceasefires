// Shared traversal that both export/markdown.js and export/docx.js format
// differently, so "what's in the export and in what order" is defined once.
import { resolveForAgreement, resolvePartyPlaceholders } from "../tokens.js";
import { getAttachments, agreementOutline, CONTEXT_LABELS } from "../state.js";
import { pipeList } from "../utils.js";

function finalText(entry, db, draft) {
  const raw = entry.custom ? entry.text : entry.text ?? db.byId.provisions.get(entry.id)?.text ?? "";
  const withOptions = resolveForAgreement(raw, db, draft.optionSelections);
  return resolvePartyPlaceholders(withOptions, draft.parties).replace(/\^[^^]*\^/g, "");
}

/** A provision's footnotes: the Handbook's (minus any the user removed, with any edited text) then the user's own. */
export function entryFootnotes(entry, db, draft) {
  const handbook = entry.custom ? [] : pipeList(db.byId.provisions.get(entry.id)?.footnote_ids || "")
    .filter((id) => !entry.hiddenFootnotes?.includes(id) && db.byId.footnotes.get(id))
    .map((id) => {
      const fn = db.byId.footnotes.get(id);
      const edited = draft.footnoteEdits?.[id];
      return { key: id, text: edited ?? fn.text, url: edited ? "" : fn.url, own: false };
    });
  return handbook.concat((entry.ownFootnotes || []).map((f) => ({ key: f.id, text: f.text, url: "", own: true })));
}

export function buildExportModel(db, draft) {
  const { definitions, lawClauses } = getAttachments(db);

  const bySection = new Map();
  for (const entry of draft.provisions) {
    const sectionId = entry.custom ? entry.sectionId : db.byId.provisions.get(entry.id)?.section_id;
    if (!sectionId) continue;
    if (!bySection.has(sectionId)) bySection.set(sectionId, []);
    bySection.get(sectionId).push(entry);
  }

  const footnotes = []; // numbered 1, 2, 3 ... in document order
  // Every used section plus its ancestors, renumbered 1, 1.1, 2 ... (no gaps for skipped
  // sections). Provisions are lettered (a), (b) so they never collide with subsection numbers.
  const sections = agreementOutline(db).map(({ section, number, depth }) => ({
    sectionId: section.section_id,
    number,
    title: section.title,
    depth,
    items: (bySection.get(section.section_id) || [])
      .map((entry, i) => ({ order: entry.order ?? i, text: finalText(entry, db, draft), footnotes: entryFootnotes(entry, db, draft) }))
      .sort((a, b) => a.order - b.order)
      .map((x, i) => {
        const footnoteNums = x.footnotes.map((fn) => footnotes.push({ num: footnotes.length + 1, text: fn.text, url: fn.url }));
        return { order: x.order, text: x.text, footnoteNums, label: `(${letterLabel(i)})` };
      }),
  }));

  const defRows = [...definitions]
    .map((id) => db.byId.definitions.get(id))
    .filter(Boolean)
    .concat(draft.customDefinitions)
    .map((d) => ({ term: d.term, text: resolvePartyPlaceholders(resolveForAgreement(draft.definitionEdits?.[d.definition_id] ?? d.text, db, draft.optionSelections), draft.parties) }))
    .sort((a, b) => a.term.localeCompare(b.term));

  const lawRows = [...lawClauses]
    .map((id) => db.byId.lawClauses.get(id))
    .filter(Boolean)
    .map((l) => ({ group: l.group, text: resolvePartyPlaceholders(resolveForAgreement(draft.definitionEdits?.[l.law_id] ?? l.text, db, draft.optionSelections), draft.parties) }));

  const parties = draft.parties.filter(Boolean);

  return {
    title: "Digital Ceasefire/De-escalation Agreement",
    contextLabel: draft.context ? CONTEXT_LABELS[draft.context] : "",
    parties,
    // Signatures come after the Definitions, so they're split off the body
    sections: sections.filter((s) => s.sectionId !== "s-10.0"),
    signatureSections: sections.filter((s) => s.sectionId === "s-10.0"),
    // the Handbook's own 10.0 Signatures provisions replace the generic block
    genericSignatures: !sections.some((s) => s.sectionId === "s-10.0"),
    definitions: defRows,
    lawClauses: lawRows,
    footnotes,
  };
}

/** 0 -> a, 25 -> z, 26 -> aa */
export function letterLabel(i) {
  return i < 26 ? String.fromCharCode(97 + i) : letterLabel(Math.floor(i / 26) - 1) + String.fromCharCode(97 + (i % 26));
}
