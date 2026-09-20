// Fill these in once the Google Sheet is set up and published (PRD section 10).
// File > Share > Publish to web > pick each content tab > format CSV > copy the URL here.
// Until a tab has a URL, the site falls back straight to the bundled snapshot below --
// that's what makes the site work out of the box before Google is wired up.
export const CSV_URLS = {
  site_text: "",
  sections: "",
  provisions: "",
  options: "",
  definitions: "",
  law_clauses: "",
  footnotes: "",
  posts: "",
};

// Deploy > New deployment > Web app, then paste the /exec URL here.
export const APPS_SCRIPT_URL = "";

// The Google Form owner-instructions step 4 creates for reviewer registration.
export const REGISTRATION_FORM_URL = "";

export const SNAPSHOT_URL = "data/snapshot.json";

// How long a cached CSV is trusted before the site re-fetches it in the background.
export const CACHE_TTL_MS = 5 * 60 * 1000;
