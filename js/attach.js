// Automatic attachment (PRD s.6): adding a provision pulls in every definition
// and law clause it requires_*, resolved recursively. Nothing here is stored --
// attachment is derived fresh from the current draft each time it's needed, so
// there's no separate reference-count ledger to keep in sync.
import { pipeList } from "./utils.js";

function expandDefinition(defId, db, out) {
  if (out.has(defId)) return;
  out.add(defId);
  const def = db.byId.definitions.get(defId);
  if (!def) return;
  for (const id of pipeList(def.requires_definitions)) expandDefinition(id, db, out);
}

/** requires_* for one provision or law clause -> the full recursive closure. */
function dependenciesOf(item, db) {
  const defs = new Set();
  for (const id of pipeList(item.requires_definitions)) expandDefinition(id, db, defs);
  const law = new Set(pipeList(item.requires_law));
  const provisions = new Set(pipeList(item.requires_provisions));
  return { defs, law, provisions };
}

/**
 * Given the draft's current (non-custom) provision ids, returns:
 *  - definitions / lawClauses: Set of ids that should be attached
 *  - byDefinition / byLaw: Map(id -> Set(provisionIds that pulled it in)) for the
 *    "chips linking back to the provisions that require it" display
 *  - impliedProvisions: Set of provision ids that requires_provisions hard-pairs in
 */
export function computeAttachments(provisionIds, db) {
  const definitions = new Set();
  const lawClauses = new Set();
  const impliedProvisions = new Set();
  const byDefinition = new Map();
  const byLaw = new Map();

  const visit = (id, item) => {
    const { defs, law, provisions } = dependenciesOf(item, db);
    for (const d of defs) {
      definitions.add(d);
      if (!byDefinition.has(d)) byDefinition.set(d, new Set());
      byDefinition.get(d).add(id);
    }
    for (const l of law) {
      lawClauses.add(l);
      if (!byLaw.has(l)) byLaw.set(l, new Set());
      byLaw.get(l).add(id);
    }
    for (const p of provisions) impliedProvisions.add(p);
  };

  for (const id of provisionIds) {
    const p = db.byId.provisions.get(id);
    if (p) visit(id, p);
  }
  return { definitions, lawClauses, impliedProvisions, byDefinition, byLaw };
}

/** requires_definitions on a definition can point at other definitions -- also
 *  surface reverse links (which attached definitions depend on which). */
export function definitionRequires(defId, db) {
  const def = db.byId.definitions.get(defId);
  return def ? pipeList(def.requires_definitions) : [];
}
