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

// Deploy > New deployment > Web app, then paste the /exec URL here. Enables posting new
// comments and approving reviewers by email; read-only comment display and reviewer
// sign-in fall back to REVIEWERS_CSV_URL / FEEDBACK_CSV_URL below when this is blank.
export const APPS_SCRIPT_URL = "";

// Published CSVs for the two reviewer-workflow tabs the Apps Script backend normally
// serves. Read-only: this is what lets sign-in and comment display work without the
// Apps Script web app deployed, but posting a new comment still needs APPS_SCRIPT_URL
// above, since a published CSV can't be written to from the browser.
//
// IMPORTANT -- these must point at the `reviewers_public` / `feedback_public` tabs,
// never the raw `reviewers` / `feedback` ones. "Publish to web" makes a tab readable by
// anyone with the link, and the raw tabs hold reviewer emails and sign-in tokens. The
// two _public tabs are one QUERY formula each (built by extract/build_workbook.py):
// reviewers_public carries token_hash + role for active reviewers only, feedback_public
// drops the token column. See README "Published tabs" for the setup steps.
export const REVIEWERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=1646552475&single=true&output=csv";
export const FEEDBACK_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRn8dsN7Ug5zHdTkldN4MkIhlVKxAzxM19iZx2znndO7YlWtaETTWDUUXJkhDske0dIFXLOMZbhf2Rl/pub?gid=955120672&single=true&output=csv";

// The Google Form owner-instructions step 4 creates for reviewer registration.
export const REGISTRATION_FORM_URL = "";

export const SNAPSHOT_URL = "data/snapshot.json";

// How long a cached CSV is trusted before the site re-fetches it in the background.
export const CACHE_TTL_MS = 5 * 60 * 1000;
