// Resolves {{o-option-id}} tokens left by the extractor. The handbook reader
// shows the original bracketed alternatives (faithful to the source text); the
// builder substitutes the single choice the drafter picked in Settings.
import { pipeList } from "./utils.js";

const TOKEN_RE = /\{\{(o-[a-z0-9-]+)\}\}/g;

export function resolveForReading(text, db) {
  return text.replace(TOKEN_RE, (_, optionId) => {
    const opt = db.byId.options.get(optionId);
    if (!opt) return "";
    return pipeList(opt.choices).map((c) => `[${c}]`).join(" ");
  });
}

// Nothing is chosen for the drafter: until they pick, the Handbook's bracketed alternatives stay.
export function resolveForAgreement(text, db, selections) {
  return text.replace(TOKEN_RE, (_, optionId) => resolveOption(optionId, db, selections));
}

function resolveOption(optionId, db, selections) {
  const opt = db.byId.options.get(optionId);
  if (!opt) return "";
  return selections?.[optionId] || pipeList(opt.choices).map((c) => `[${c}]`).join(" ");
}

/** Text split around option tokens, for rendering each choice inline: [{ text } | { optionId, text }]. */
export function splitOptions(text, db, selections) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    out.push({ text: text.slice(last, m.index) });
    if (db.byId.options.has(m[1])) out.push({ optionId: m[1], text: resolveOption(m[1], db, selections) });
    last = m.index + m[0].length;
  }
  out.push({ text: text.slice(last) });
  return out;
}

/** [Party A] / [Party B] / [Party C] -- filled live from the Settings parties list. */
export function resolvePartyPlaceholders(text, parties) {
  return text.replace(/\[Party ([A-Za-z0-9]+)\]/g, (match, label) => {
    const idx = "ABCDEFGHIJ".indexOf(label.toUpperCase());
    if (idx >= 0 && parties && parties[idx]) return parties[idx];
    return match;
  });
}

export function optionIdsIn(text) {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1]);
}
