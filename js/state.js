// The builder's state: one serializable object per draft, mutated only through
// the named actions below (PRD "Technical rules"), autosaved to localStorage
// debounced to 1s. Multiple named drafts share one store, one active at a time.
import { debounce, uid } from "./utils.js";
import { computeAttachments } from "./attach.js";

const STORAGE_KEY = "ceasefire:builder:v1";
export const CONTEXT_LABELS = { ac: "Armed Conflict", gz: "Grey Zone Activity", id: "Internal Disturbance" };
export const HANDBOOK_VERSION = "1.4";

function freshDraft(name = "Draft 1") {
  return {
    id: uid("draft"),
    name,
    handbookVersion: HANDBOOK_VERSION,
    context: null,
    parties: ["", "", ""],
    optionSelections: {},
    provisions: [], // { id, custom, sectionId, text, edited, addedVia }
    customDefinitions: [], // { id, term, text }
    pinned: [], // definition_id / law_id kept even if unreferenced
    dismissedSuggestions: [], // provision ids removed from a context's preselect list
    updatedAt: Date.now(),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupt or unavailable -- start fresh */
  }
  const draft = freshDraft();
  return { activeDraftId: draft.id, drafts: { [draft.id]: draft } };
}

let store = load();
const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  for (const fn of listeners) fn(store);
}

const persist = debounce(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* storage full -- draft still lives in memory for this session */
  }
}, 1000);

function touch(draft) {
  draft.updatedAt = Date.now();
  persist();
  notify();
}

export function getStore() {
  return store;
}
export function getActiveDraft() {
  return store.drafts[store.activeDraftId];
}
export function listDrafts() {
  return Object.values(store.drafts).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function newDraft(name) {
  const draft = freshDraft(name || `Draft ${Object.keys(store.drafts).length + 1}`);
  store.drafts[draft.id] = draft;
  store.activeDraftId = draft.id;
  touch(draft);
  return draft;
}

export function switchDraft(id) {
  if (store.drafts[id]) {
    store.activeDraftId = id;
    persist();
    notify();
  }
}

// ---------------------------------------------------------------------------
// Provisions
// ---------------------------------------------------------------------------

export function isInAgreement(provisionId) {
  return getActiveDraft().provisions.some((p) => p.id === provisionId);
}

function nextOrder(draft) {
  return draft.provisions.reduce((max, p) => Math.max(max, p.order ?? 0), 0) + 1;
}

export function addProvision(provisionId, { addedVia = "manual" } = {}) {
  const draft = getActiveDraft();
  if (draft.provisions.some((p) => p.id === provisionId)) return;
  draft.provisions.push({ id: provisionId, custom: false, text: null, edited: false, addedVia, order: nextOrder(draft) });
  draft.dismissedSuggestions = draft.dismissedSuggestions.filter((id) => id !== provisionId);
  touch(draft);
}

export function addProvisions(provisionIds, opts) {
  const draft = getActiveDraft();
  for (const id of provisionIds) {
    if (!draft.provisions.some((p) => p.id === id)) {
      draft.provisions.push({ id, custom: false, text: null, edited: false, addedVia: opts?.addedVia || "manual", order: nextOrder(draft) });
    }
  }
  touch(draft);
}

export function reorderWithinSection(orderedProvisionIds) {
  const draft = getActiveDraft();
  orderedProvisionIds.forEach((id, i) => {
    const entry = draft.provisions.find((p) => p.id === id);
    if (entry) entry.order = i;
  });
  touch(draft);
}

export function removeProvision(provisionId) {
  const draft = getActiveDraft();
  const entry = draft.provisions.find((p) => p.id === provisionId);
  if (!entry) return;
  draft.provisions = draft.provisions.filter((p) => p.id !== provisionId);
  if (entry.addedVia === "context" && !entry.custom) {
    draft.dismissedSuggestions.push(provisionId);
  }
  touch(draft);
}

export function editProvisionText(provisionId, newText) {
  const draft = getActiveDraft();
  const entry = draft.provisions.find((p) => p.id === provisionId);
  if (!entry) return;
  entry.text = newText;
  entry.edited = !entry.custom; // custom provisions are always "their own text", not "edited"
  touch(draft);
}

export function restoreProvisionText(provisionId) {
  const draft = getActiveDraft();
  const entry = draft.provisions.find((p) => p.id === provisionId);
  if (!entry || entry.custom) return;
  entry.text = null;
  entry.edited = false;
  touch(draft);
}

export function addCustomProvision(sectionId, text) {
  const draft = getActiveDraft();
  const id = uid("c");
  draft.provisions.push({ id, custom: true, sectionId, text, edited: false, addedVia: "manual", order: nextOrder(draft) });
  touch(draft);
  return id;
}

// ---------------------------------------------------------------------------
// Definitions, pins, options, parties, context
// ---------------------------------------------------------------------------

export function addCustomDefinition(term, text) {
  const draft = getActiveDraft();
  const id = uid("cd");
  draft.customDefinitions.push({ id, term, text });
  touch(draft);
  return id;
}

export function pinItem(id) {
  const draft = getActiveDraft();
  if (!draft.pinned.includes(id)) draft.pinned.push(id);
  touch(draft);
}
export function unpinItem(id) {
  const draft = getActiveDraft();
  draft.pinned = draft.pinned.filter((p) => p !== id);
  touch(draft);
}

export function setOptionSelection(optionId, choice) {
  const draft = getActiveDraft();
  draft.optionSelections[optionId] = choice;
  touch(draft);
}

export function setParties(parties) {
  const draft = getActiveDraft();
  draft.parties = parties;
  touch(draft);
}

// The {{o-context}} token is just another option, but it must always track
// draft.context rather than the option's own static default -- otherwise
// picking Grey Zone/Internal Disturbance would still export "Armed Conflict".
function setContextFields(draft, contextCode) {
  draft.context = contextCode;
  draft.optionSelections["o-context"] = CONTEXT_LABELS[contextCode];
}

/** First-time context pick (builder step 1): adds every provision preselected
 *  for that context, minus anything the user already dismissed. */
export function setInitialContext(contextCode, db) {
  const draft = getActiveDraft();
  setContextFields(draft, contextCode);
  const toAdd = db.provisions.filter(
    (p) => p.preselect_for?.split("|").includes(contextCode) && !draft.dismissedSuggestions.includes(p.provision_id)
  );
  for (const p of toAdd) {
    if (!draft.provisions.some((e) => e.id === p.provision_id)) {
      draft.provisions.push({ id: p.provision_id, custom: false, text: null, edited: false, addedVia: "context", order: nextOrder(draft) });
    }
  }
  touch(draft);
}

/** Sets the context without adding any preselected provisions ("start empty"). */
export function setContextOnly(contextCode) {
  const draft = getActiveDraft();
  setContextFields(draft, contextCode);
  touch(draft);
}

/** What changing to a new context would do, without doing it -- for the confirm dialog. */
export function previewContextChange(newContext, db) {
  const draft = getActiveDraft();
  const toAdd = db.provisions.filter(
    (p) =>
      p.preselect_for?.split("|").includes(newContext) &&
      !draft.provisions.some((e) => e.id === p.provision_id) &&
      !draft.dismissedSuggestions.includes(p.provision_id)
  );
  const toRemove = draft.provisions.filter((e) => e.addedVia === "context" && !e.edited && !e.custom);
  return { toAdd, toRemove };
}

export function applyContextChange(newContext, db, { addSuggested = true, removeOldUnedited = true } = {}) {
  const draft = getActiveDraft();
  const { toAdd, toRemove } = previewContextChange(newContext, db);
  if (removeOldUnedited) {
    const removeIds = new Set(toRemove.map((e) => e.id));
    draft.provisions = draft.provisions.filter((e) => !removeIds.has(e.id));
  }
  setContextFields(draft, newContext);
  if (addSuggested) {
    for (const p of toAdd) {
      draft.provisions.push({ id: p.provision_id, custom: false, text: null, edited: false, addedVia: "context", order: nextOrder(draft) });
    }
  }
  touch(draft);
}

// ---------------------------------------------------------------------------
// Derived: attachments, undefined-terms, export/import
// ---------------------------------------------------------------------------

export function getAttachments(db) {
  const draft = getActiveDraft();
  const handbookIds = draft.provisions.filter((p) => !p.custom).map((p) => p.id);
  const { definitions, lawClauses, byDefinition, byLaw } = computeAttachments(handbookIds, db);
  for (const id of draft.pinned) {
    if (db.byId.definitions.has(id)) definitions.add(id);
    if (db.byId.lawClauses.has(id)) lawClauses.add(id);
  }
  return { definitions, lawClauses, byDefinition, byLaw };
}

export function exportDraft() {
  const draft = getActiveDraft();
  return JSON.stringify(draft, null, 2);
}

export function importDraft(json) {
  const parsed = JSON.parse(json);
  parsed.id = uid("draft");
  parsed.name = `${parsed.name || "Imported draft"} (imported)`;
  store.drafts[parsed.id] = parsed;
  store.activeDraftId = parsed.id;
  touch(parsed);
  return parsed;
}

/** Provisions in the draft whose handbook text has moved on since this draft
 *  last saved them (milestone 9: re-extraction / version_changed handling).
 *  Only entries still showing the live original (text === null) are ambiguous --
 *  an entry the drafter already edited is already "their version," no conflict. */
export function findOutdatedProvisions(db) {
  const draft = getActiveDraft();
  return draft.provisions
    .filter((e) => !e.custom && e.text === null && e.acknowledgedVersion !== db.byId.provisions.get(e.id)?.version_changed)
    .map((e) => ({ entry: e, current: db.byId.provisions.get(e.id) }))
    .filter(({ current }) => current && current.version_changed && current.version_changed > draft.handbookVersion);
}

/** "Keep using the updated text" -- just stop flagging this provision until it changes again. */
export function acknowledgeProvisionUpdate(provisionId, db) {
  const draft = getActiveDraft();
  const entry = draft.provisions.find((p) => p.id === provisionId);
  if (!entry) return;
  entry.acknowledgedVersion = db.byId.provisions.get(provisionId)?.version_changed;
  touch(draft);
}

/** "Freeze my current wording instead" -- locks in whatever text is showing now
 *  (there's no stored snapshot of the pre-change original to diff against). */
export function freezeProvisionText(provisionId, db) {
  const draft = getActiveDraft();
  const entry = draft.provisions.find((p) => p.id === provisionId);
  if (!entry) return;
  entry.text = db.byId.provisions.get(provisionId)?.text ?? entry.text;
  entry.acknowledgedVersion = db.byId.provisions.get(provisionId)?.version_changed;
  touch(draft);
}
