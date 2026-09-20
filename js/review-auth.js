// Reviewer sign-in: the token lives only in localStorage, never in a visible
// URL after the initial email-link visit (PRD s.7 "Token handling").
import { whoAmI } from "./api.js";

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
  const res = await whoAmI(token); // throws ApiError("invalid_token") if not active
  const reviewer = { token, role: res.role };
  localStorage.setItem(KEY, JSON.stringify(reviewer));
  return reviewer;
}

export function signOutReviewer() {
  localStorage.removeItem(KEY);
}
