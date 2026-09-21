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

// Base64 SHA-256, matching Apps Script's
// Utilities.base64Encode(Utilities.computeDigest(SHA_256, s)) so both sides agree.
// Check vector: "abc" -> "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0="
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// Anything "published to the web" is public, so the reviewers tab itself must never be:
// publish a projection tab holding only token_hash + role for active reviewers. No email
// (the site never needs one) and no raw token (it's the credential). See owner setup notes.
async function lookupRoleFromSheet(token) {
  if (!REVIEWERS_CSV_URL) throw new ApiError("invalid_token");
  const res = await fetch(REVIEWERS_CSV_URL, { cache: "no-store" });
  if (!res.ok) throw new ApiError("invalid_token");
  const hash = await sha256(token);
  const match = parseCsv(await res.text()).find((r) => r.token_hash === hash);
  if (!match) throw new ApiError("invalid_token");
  return match.role;
}

export function signOutReviewer() {
  localStorage.removeItem(KEY);
}
