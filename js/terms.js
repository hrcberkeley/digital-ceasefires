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

// Articles/quantifiers/conjunctions capitalized only because they start a sentence,
// not because they're part of a Title-Case term ("The Parties", "If Parties").
const LEADING_STOPWORDS = new Set(["the", "a", "an", "no", "all", "this", "that", "these", "those", "such", "each", "any", "some", "other", "if", "when", "where", "while", "because", "under", "undertaking"]);
// Lowercase connectors that can sit inside a Title-Case name ("Distributed Denial of Service Attacks").
const CONNECTORS = "(?:of|on|and|to|for|the|in)";
// Proper names of legal instruments and bodies are cited, not defined ("International Humanitarian Law").
// Placeholders ("Party A") and instrument/body names anywhere in the phrase are skipped too.
const PROPER_NAME = /\b(?:law|laws|convention|covenant|charter|protocol|statute|treaty|rights|commission|committee|court|plan|article|agreement|[A-Z])\b/i;

// Lowercased words with simple plurals folded: "Third Parties" -> ["third", "party"].
const wordsOf = (s) => s.toLowerCase().match(/[a-z]+/g)?.map((w) => w.replace(/ies$/, "y").replace(/s$/, "")) ?? [];
// "Confidence Building Measures (CBMs)" and "Malware / Malicious Software" each count as every variant.
const variantsOf = (term) => term.split(/[()/]/).map(wordsOf).filter((w) => w.length);
const containsRun = (outer, inner) => inner.length > 0 && outer.some((_, i) => inner.every((w, j) => outer[i + j] === w));

/** Title-Case phrases used in `text` that match no defined term. A phrase is fine if it
 *  equals, contains or is contained in a defined term (at word boundaries), or names a
 *  legal instrument/body. Single capitalized words are too weak a signal and are skipped. */
export function findUndefinedCapitalizedTerms(text, definedTermsLower) {
  const defined = [...definedTermsLower].flatMap(variantsOf);
  const found = new Set();
  const re = new RegExp(`\\b[A-Z][\\w-]*(?:\\s+(?:${CONNECTORS}\\s+)*[A-Z][\\w-]*){0,5}`, "g");
  for (const [phrase] of text.matchAll(re)) {
    let words = phrase.split(/\s+/);
    while (words.length > 1 && LEADING_STOPWORDS.has(words[0].toLowerCase())) words = words.slice(1);
    if (words.length < 2 || PROPER_NAME.test(words.join(" "))) continue;
    const run = wordsOf(words.join(" "));
    if (!defined.some((d) => containsRun(run, d) || containsRun(d, run))) found.add(words.join(" "));
  }
  return [...found];
}

function escapeHtmlLocal(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
