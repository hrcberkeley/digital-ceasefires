// Fill these in once the Google Sheet is set up and published (PRD section 10).
// File > Share > Publish to web > pick each content tab > format CSV > copy the URL here.
// Until a tab has a URL, the site falls back straight to the bundled snapshot below --
// that's what makes the site work out of the box before Google is wired up.
export const CSV_URLS = {
  site_text: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=2062097190&single=true&output=csv",
  sections: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=1623755899&single=true&output=csv",
  provisions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=1998644264&single=true&output=csv",
  options: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=1985418343&single=true&output=csv",
  definitions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=258680377&single=true&output=csv",
  law_clauses: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=1107480777&single=true&output=csv",
  footnotes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=279018003&single=true&output=csv",
  posts: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR2kpx_-WBCyOioIiXqwlxbWCKNU-YH6PtRQqIxada7OEfx0nEYvvkp_AkUJ6x2pOuycqw2Wzci6W0F/pub?gid=114496911&single=true&output=csv",
};

export const SNAPSHOT_URL = "data/snapshot.json";

// How long a cached CSV is trusted before the site re-fetches it in the background.
export const CACHE_TTL_MS = 5 * 60 * 1000;

// Target for the Handbook PDF link. Empty hides the link (renders as plain text)
// until the final PDF is available -- set once the final PDF is available.
export const HANDBOOK_PDF_URL = "";
