// Talks to the single Apps Script web app for everything that writes (comments,
// replies) and for the two read endpoints that need a token or aren't public
// enough to publish as a CSV (who-am-I). See apps-script/Code.gs for the server side.
import { APPS_SCRIPT_URL } from "./config.js";

class ApiError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function assertConfigured() {
  if (!APPS_SCRIPT_URL) throw new ApiError("not_configured");
}

async function post(payload) {
  assertConfigured();
  // sent as text/plain so the browser doesn't send a CORS preflight (PRD s.8)
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ hp: "", ...payload }),
  });
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error || "unknown");
  return json;
}

async function get(params) {
  assertConfigured();
  const url = `${APPS_SCRIPT_URL}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json && json.ok === false) throw new ApiError(json.error || "unknown");
  return json;
}

export function postComment({ token, targetId, targetType, handbookVersion, selectedText, startOffset, endOffset, body, parentId }) {
  return post({
    action: "comment",
    token,
    target_id: targetId,
    target_type: targetType,
    handbook_version: handbookVersion,
    selected_text: selectedText || "",
    start_offset: startOffset ?? "",
    end_offset: endOffset ?? "",
    body,
    parent_id: parentId || "",
  });
}

export function getComments(handbookVersion) {
  return get({ action: "comments", version: handbookVersion });
}

export function whoAmI(token) {
  return get({ action: "me", token });
}

export { ApiError };
