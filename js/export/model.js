// Shared traversal that both export/markdown.js and export/docx.js format
// differently, so "what's in the export and in what order" is defined once.
import { resolveForAgreement, resolvePartyPlaceholders } from "../tokens.js";
import { getAttachments, CONTEXT_LABELS } from "../state.js";
import { pipeList } from "../utils.js";

function finalText(entry, db, draft) {
  const raw = entry.custom ? entry.text : entry.text ?? db.byId.provisions.get(entry.id)?.text ?? "";
  const withOptions = resolveForAgreement(raw, db, draft.optionSelections);
  return resolvePartyPlaceholders(withOptions, draft.parties);
}

function footnoteIdsOf(entry, db) {
  if (entry.custom || entry.text != null) return []; // edited/custom text has no reliable footnote mapping
  return pipeList(db.byId.provisions.get(entry.id)?.footnote_ids || "");
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

  const usedFootnotes = new Map();
  const sections = [...bySection.keys()]
    .map((id) => db.byId.sections.get(id))
    .filter(Boolean)
    .sort((a, b) => Number(a.order) - Number(b.order))
    .map((section) => ({
      title: `${section.number} ${section.title}`,
      items: bySection
        .get(section.section_id)
        .map((entry, i) => ({ order: entry.order ?? i, text: finalText(entry, db, draft), footnoteIds: footnoteIdsOf(entry, db) }))
        .sort((a, b) => a.order - b.order)
        .map((x) => {
          for (const fid of x.footnoteIds) {
            const fn = db.byId.footnotes.get(fid);
            if (fn) usedFootnotes.set(fid, fn);
          }
          return x;
        }),
    }));

  const defRows = [...definitions]
    .map((id) => db.byId.definitions.get(id))
    .filter(Boolean)
    .concat(draft.customDefinitions)
    .map((d) => ({ term: d.term, text: resolvePartyPlaceholders(resolveForAgreement(d.text, db, draft.optionSelections), draft.parties) }))
    .sort((a, b) => a.term.localeCompare(b.term));

  const lawRows = [...lawClauses]
    .map((id) => db.byId.lawClauses.get(id))
    .filter(Boolean)
    .map((l) => ({ group: l.group, text: resolvePartyPlaceholders(resolveForAgreement(l.text, db, draft.optionSelections), draft.parties) }));

  const parties = draft.parties.filter(Boolean);

  return {
    title: "Digital Ceasefire Agreement",
    contextLabel: draft.context ? CONTEXT_LABELS[draft.context] : "",
    parties,
    sections,
    definitions: defRows,
    lawClauses: lawRows,
    footnotes: [...usedFootnotes.values()],
  };
}
