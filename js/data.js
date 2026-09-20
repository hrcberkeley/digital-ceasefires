// Loads the seven content tabs, preferring the published Google Sheet CSVs and
// falling back to the bundled snapshot.json when they're not configured or the
// network fails (see PRD s.2 "Caching"). Also builds the lookup indices every
// other module needs instead of re-scanning arrays.
import { CSV_URLS, SNAPSHOT_URL, CACHE_TTL_MS } from "./config.js";

const CACHE_KEY = "ceasefire:data:v1";
const TABS = ["site_text", "sections", "provisions", "options", "definitions", "law_clauses", "footnotes", "posts"];

export function parseCsv(text) {
  const result = window.Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data;
}

async function fetchTab(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  return parseCsv(await res.text());
}

async function fetchAllFromSheet() {
  const configured = TABS.filter((t) => CSV_URLS[t]);
  if (configured.length !== TABS.length) return null; // partial config -> use snapshot instead of a mixed dataset
  const entries = await Promise.all(TABS.map((t) => fetchTab(CSV_URLS[t]).then((rows) => [t, rows])));
  return Object.fromEntries(entries);
}

async function fetchSnapshot() {
  const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("snapshot.json missing");
  return res.json();
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(raw) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), raw }));
  } catch {
    /* storage full or unavailable -- fine, just means no cache this session */
  }
}

function published(rows) {
  return (rows || []).filter((r) => r.status !== "retired" && r.status !== "draft");
}

function indexBy(rows, key) {
  const map = new Map();
  for (const r of rows) map.set(r[key], r);
  return map;
}

function buildDb(raw) {
  const sections = published(raw.sections).sort((a, b) => Number(a.order) - Number(b.order));
  const provisions = published(raw.provisions).sort((a, b) => Number(a.order) - Number(b.order));
  const definitions = published(raw.definitions);
  const lawClauses = published(raw.law_clauses);
  const options = raw.options || [];
  const footnotes = raw.footnotes || [];
  const posts = (raw.posts || [])
    .filter((p) => p.status === "published")
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const siteText = new Map((raw.site_text || []).map((r) => [r.key, r.text]));

  const byId = {
    sections: indexBy(sections, "section_id"),
    provisions: indexBy(provisions, "provision_id"),
    definitions: indexBy(definitions, "definition_id"),
    lawClauses: indexBy(lawClauses, "law_id"),
    options: indexBy(options, "option_id"),
    footnotes: indexBy(footnotes, "footnote_id"),
  };

  const childSections = (parentId) =>
    sections.filter((s) => (s.parent_id || "") === (parentId || "")).sort((a, b) => Number(a.order) - Number(b.order));
  const provisionsOf = (sectionId) => provisions.filter((p) => p.section_id === sectionId);

  return { sections, provisions, definitions, lawClauses, options, footnotes, posts, siteText, byId, childSections, provisionsOf };
}

/** t(key, fallback) -- read a site_text string, falling back to a literal if the
 *  Sheet doesn't have it yet (so a missing row degrades instead of breaking). */
export function t(db, key, fallback = "") {
  return db.siteText.get(key) ?? fallback;
}

/**
 * Resolves with the best data available immediately (cache or snapshot), and
 * calls onFresh(db) later if a network fetch turns up a newer version.
 */
export async function loadData(onFresh) {
  const cached = readCache();
  const cacheIsFresh = cached && Date.now() - cached.savedAt < CACHE_TTL_MS;

  const refreshInBackground = () => {
    fetchAllFromSheet()
      .then((raw) => {
        if (raw) {
          writeCache(raw);
          onFresh && onFresh(buildDb(raw));
        }
      })
      .catch((err) => console.warn("Background data refresh failed, keeping cached copy:", err));
  };

  if (cached) {
    if (!cacheIsFresh) refreshInBackground();
    return buildDb(cached.raw);
  }

  try {
    const raw = await fetchAllFromSheet();
    if (raw) {
      writeCache(raw);
      return buildDb(raw);
    }
  } catch (err) {
    console.warn("Sheet fetch failed, falling back to bundled snapshot:", err);
  }

  const snapshot = await fetchSnapshot();
  return buildDb(snapshot);
}
