// Reviewer sign-in: the token lives only in localStorage, never in a visible
// URL after the initial email-link visit (PRD s.7 "Token handling").
import { whoAmI, ApiError } from "./api.js";
import { parseCsv } from "./data.js";
import { REVIEWERS_CSV_URL } from "./config.js";

const KEY = "ceasefire:reviewer:v1";

export function getReviewer() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getReviewerToken() {
  return getReviewer()?.token || null;
}

export async function signInWithToken(token) {
  let role;
  try {
    role = (await whoAmI(token)).role; // throws ApiError("invalid_token") if not active
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== "not_configured") throw err;
    role = await lookupRoleFromSheet(token); // Apps Script not deployed -- read the published reviewers CSV directly
  }
  const reviewer = { token, role };
  localStorage.setItem(KEY, JSON.stringify(reviewer));
  return reviewer;
}

async function lookupRoleFromSheet(token) {
  if (!REVIEWERS_CSV_URL) throw new ApiError("invalid_token");
  const res = await fetch(REVIEWERS_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new ApiError("invalid_token");
  const match = parseCsv(await res.text()).find((r) => r.token === token && r.status === "active");
  if (!match) throw new ApiError("invalid_token");
  return match.role;
}

export function signOutReviewer() {
  localStorage.removeItem(KEY);
}
