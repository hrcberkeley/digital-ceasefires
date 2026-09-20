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

export function resolveForAgreement(text, db, selections) {
  return text.replace(TOKEN_RE, (_, optionId) => {
    const opt = db.byId.options.get(optionId);
    if (!opt) return "";
    return selections?.[optionId] ?? opt.default;
  });
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
