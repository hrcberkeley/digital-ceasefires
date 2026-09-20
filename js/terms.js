// Defined-term matching, shared by the handbook reader (hover cards) and the
// builder (undefined-terms warning). Mirrors extract.py's longest-match-first,
// simple-plural-aware matching so the two stay consistent.

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildTermMatcher(definitions) {
  const terms = [...new Set(definitions.map((d) => d.term))].sort((a, b) => b.length - a.length);
  if (terms.length === 0) return { regex: null, termByLower: new Map() };
  const parts = terms.map((t) => (t.endsWith("s") ? escapeRe(t) : `${escapeRe(t)}s?`));
  const regex = new RegExp(`\\b(${parts.join("|")})\\b`, "g");
  const termByLower = new Map(terms.map((t) => [t.toLowerCase(), t]));
  return { regex, termByLower };
}

function resolveTerm(matched, termByLower) {
  let term = termByLower.get(matched.toLowerCase());
  if (!term && matched.endsWith("s")) term = termByLower.get(matched.slice(0, -1).toLowerCase());
  return term || matched;
}

/** Wraps every defined-term occurrence in a <span class="defined-term" data-term="...">
 *  and returns an HTML string. Caller is expected to have already escaped/derived
 *  `text` from plain Sheet content (no markdown expected in provision/definition text). */
export function linkifyTerms(text, definitions, defByTerm, matcher) {
  if (!matcher.regex) return escapeHtmlLocal(text);
  let out = "";
  let last = 0;
  matcher.regex.lastIndex = 0;
  let m;
  while ((m = matcher.regex.exec(text))) {
    const term = resolveTerm(m[1], matcher.termByLower);
    const def = defByTerm.get(term);
    out += escapeHtmlLocal(text.slice(last, m.index));
    if (def) {
      out += `<span class="defined-term" data-def-id="${def.definition_id}" tabindex="0">${escapeHtmlLocal(m[1])}</span>`;
    } else {
      out += escapeHtmlLocal(m[1]);
    }
    last = m.index + m[1].length;
  }
  out += escapeHtmlLocal(text.slice(last));
  return out;
}

// Articles/quantifiers that are capitalized only because they start a sentence,
// not because they're part of a Title-Case term ("The Parties", "No Party").
const LEADING_STOPWORDS = new Set(["the", "a", "an", "no", "all", "this", "that", "these", "those", "such", "each", "any", "some", "other"]);

/** Just the set of defined terms used in a piece of text (no HTML), for the
 *  builder's "capitalized terms with no definition" warning. */
export function findUndefinedCapitalizedTerms(text, definedTermsLower) {
  const found = new Set();
  const re = /\b(?:[A-Z][a-zA-Z]+(?:\s+|$)){1,4}/g;
  let m;
  while ((m = re.exec(text))) {
    let words = m[0].trim().split(/\s+/);
    while (words.length > 1 && LEADING_STOPWORDS.has(words[0].toLowerCase())) words = words.slice(1);
    if (words.length < 2) continue; // a single capitalized word is too weak a signal on its own
    const phrase = words.join(" ");
    const lower = phrase.toLowerCase();
    const isDefined = definedTermsLower.has(lower) || definedTermsLower.has(`${lower}s`) || (lower.endsWith("s") && definedTermsLower.has(lower.slice(0, -1)));
    if (!isDefined) found.add(phrase);
  }
  return [...found];
}

function escapeHtmlLocal(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
