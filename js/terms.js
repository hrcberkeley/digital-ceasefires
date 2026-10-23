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
  // inline [text](http(s)/mailto url) -> <a>; term linking runs only on the text between/inside links' labels' siblings
  const LINK = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^\s)]+)\)/g;
  let out = "", last = 0, m;
  while ((m = LINK.exec(text))) {
    out += linkifyPlain(text.slice(last, m.index), defByTerm, matcher);
    out += `<a href="${escapeHtmlLocal(m[2]).replace(/"/g, "&quot;")}" target="_blank" rel="noopener">${escapeHtmlLocal(m[1])}</a>`;
    last = m.index + m[0].length;
  }
  return out + linkifyPlain(text.slice(last), defByTerm, matcher);
}

function linkifyPlain(text, defByTerm, matcher) {
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

function escapeHtmlLocal(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}
