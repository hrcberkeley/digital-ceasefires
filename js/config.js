// Fill these in once the Google Sheet is set up and published (PRD section 10).
// File > Share > Publish to web > pick each content tab > format CSV > copy the URL here.
// Until a tab has a URL, the site falls back straight to the bundled snapshot below --
// that's what makes the site work out of the box before Google is wired up.
export const CSV_URLS = {
  site_text: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=724713379&single=true&output=csv",
  sections: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=861688801&single=true&output=csv",
  provisions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=1609926639&single=true&output=csv",
  options: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=352679907&single=true&output=csv",
  definitions: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=202878497&single=true&output=csv",
  law_clauses: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=142977822&single=true&output=csv",
  footnotes: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=1586824256&single=true&output=csv",
  posts: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=891525524&single=true&output=csv",
};

// Deploy > New deployment > Web app, then paste the /exec URL here.
export const APPS_SCRIPT_URL = "";

// The Google Form owner-instructions step 4 creates for reviewer registration.
export const REGISTRATION_FORM_URL = "";

export const SNAPSHOT_URL = "data/snapshot.json";

// How long a cached CSV is trusted before the site re-fetches it in the background.
export const CACHE_TTL_MS = 5 * 60 * 1000;
