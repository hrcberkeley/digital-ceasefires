/**
 * Digital Ceasefire Platform -- Apps Script backend (PRD section 8).
 * Bound to the "Digital Ceasefire Platform" spreadsheet. Provides:
 *   - onRegistration(e): form-submit trigger, creates a pending reviewer row.
 *   - onReviewerEdit(e): edit trigger, approves/resends reviewer access by email.
 *   - doPost(e): comment/reply submission.
 *   - doGet(e): public comment listing, and "who am I" for a reviewer token.
 *
 * Install the triggers manually (Extensions > Apps Script > clock icon > Add
 * trigger) -- see the PRD "Instructions for the owner" section. Simple triggers
 * (onEdit, onFormSubmit) can't send email or run with full permissions, so this
 * relies on installable triggers pointed at the functions below.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAB_REGISTRATIONS = "registrations";
const TAB_REVIEWERS = "reviewers";
const TAB_FEEDBACK = "feedback";
const TAB_SITE_TEXT = "site_text";

// token_hash is appended last so the approved/resend column positions the onEdit
// trigger relies on don't shift. It's what the `reviewers_public` tab publishes in
// place of the token: the raw token is a credential and the email is PII, and a
// "publish to web" tab is readable by anyone with the link. See README "Published tabs".
const REVIEWERS_COLUMNS = ["token", "email", "role", "status", "approved", "resend", "created_at", "approved_at", "token_hash"];
const FEEDBACK_COLUMNS = [
  "comment_id", "parent_id", "token", "role", "provision_id", "target_type",
  "handbook_version", "selected_text", "start_offset", "end_offset", "body", "status", "created_at",
];

const MAX_BODY_LENGTH = 4000;
const MAX_SELECTION_LENGTH = 1000;
const RATE_LIMIT_PER_HOUR = 20;
const TOKEN_CACHE_SECONDS = 5 * 60;
const COMMENTS_CACHE_SECONDS = 60;

/** Site URL the reviewer email link points at -- set this to where index.html
 *  is hosted (e.g. "https://hrcberkeley.github.io/digital-ceasefires/"). */
const SITE_URL = "https://hrcberkeley.github.io/digital-ceasefires/";

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

/**
 * Installable "On form submit" trigger on the registration Google Form.
 * Creates a pending row in `reviewers`. @param {Object} e Form submit event.
 */
function onRegistration(e) {
  const values = e.namedValues || {};
  const email = firstValue(values["Email Address"] || values["Email"]);
  const role = firstValue(values["Role"]);
  if (!email) return;

  const token = Utilities.getUuid(); // 122 bits of entropy -- safe to publish a hash of
  const sheet = getSheet(TAB_REVIEWERS);
  appendAfterLastRow(sheet, [
    token,
    email,
    role || "",
    "pending",
    false,
    false,
    new Date().toISOString(),
    "",
    sha256Base64(token),
  ]);
}

/**
 * Run by hand (select it in the editor toolbar, then Run) to add `registrations`
 * rows the trigger never saw -- e.g. submissions made before the trigger existed,
 * or while it was failing. Skips emails already in `reviewers`, so it's safe to
 * run any number of times.
 */
function importMissedRegistrations() {
  const regSheet = getSheet(TAB_REGISTRATIONS);
  const [headers, ...rows] = regSheet.getDataRange().getValues();
  const known = new Set(readRows(getSheet(TAB_REVIEWERS), REVIEWERS_COLUMNS).map((r) => String(r.email).trim().toLowerCase()));
  let added = 0;
  rows.forEach((row) => {
    const namedValues = {};
    headers.forEach((h, i) => { namedValues[String(h).trim()] = [String(row[i])]; });
    const email = String(firstValue(namedValues["Email Address"] || namedValues["Email"]) || "").trim().toLowerCase();
    if (!email || known.has(email)) return;
    onRegistration({ namedValues });
    known.add(email);
    added += 1;
  });
  Logger.log(`Imported ${added} missed registration(s).`);
}

/** Matches the browser's sha256() in js/review-auth.js, so a token hashed here
 *  and a token hashed there produce the same string.
 *  Check vector: "abc" -> "ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=" */
function sha256Base64(s) {
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)
  );
}

/**
 * Installable "On edit" trigger on the spreadsheet. Watches the `reviewers`
 * tab's approved/resend checkboxes. @param {Object} e Edit event.
 */
function onReviewerEdit(e) {
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== TAB_REVIEWERS || range.getRow() === 1) return;

  const row = range.getRow();
  const col = range.getColumn();
  const approvedCol = REVIEWERS_COLUMNS.indexOf("approved") + 1;
  const resendCol = REVIEWERS_COLUMNS.indexOf("resend") + 1;

  const rowValues = sheet.getRange(row, 1, 1, REVIEWERS_COLUMNS.length).getValues()[0];
  const record = rowFromValues(REVIEWERS_COLUMNS, rowValues);

  if (col === approvedCol && record.approved === true && record.status === "pending") {
    record.status = "active";
    record.approved_at = new Date().toISOString();
    writeRow(sheet, row, REVIEWERS_COLUMNS, record);
    sendReviewLink(record.email, record.token);
  } else if (col === resendCol && record.resend === true) {
    sendReviewLink(record.email, record.token);
    record.resend = false;
    writeRow(sheet, row, REVIEWERS_COLUMNS, record);
  }

  invalidateTokenCache();
}

function sendReviewLink(email, token) {
  const link = `${SITE_URL}#/review?t=${encodeURIComponent(token)}`;
  MailApp.sendEmail({
    to: email,
    subject: "Your Digital Ceasefire Platform reviewer link",
    body: `You're approved to review the Digital Ceasefire Handbook.\n\nOpen this link to start: ${link}\n\nKeep this link private -- it's how the site recognizes you as a reviewer.`,
  });
}

// ---------------------------------------------------------------------------
// doPost: comment / reply submission
// ---------------------------------------------------------------------------

/** @param {Object} e doPost event with JSON in e.postData.contents (text/plain). */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ ok: false, error: "bad_request" });
  }

  if (payload.hp) return jsonResponse({ ok: false, error: "bad_request" }); // honeypot tripped

  if (payload.action !== "comment") return jsonResponse({ ok: false, error: "bad_request" });

  const body = String(payload.body || "").trim();
  const selectedText = String(payload.selected_text || "");
  if (!body || body.length > MAX_BODY_LENGTH) return jsonResponse({ ok: false, error: "body_too_long" });
  if (selectedText.length > MAX_SELECTION_LENGTH) return jsonResponse({ ok: false, error: "selection_too_long" });

  const reviewer = lookupReviewerByToken(payload.token);
  if (!reviewer || reviewer.status !== "active") return jsonResponse({ ok: false, error: "invalid_token" });

  if (!checkRateLimit(payload.token)) return jsonResponse({ ok: false, error: "rate_limited" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet(TAB_FEEDBACK);
    const commentId = Utilities.getUuid();
    const createdAt = new Date().toISOString();
    sheet.appendRow([
      commentId,
      payload.parent_id || "",
      payload.token,
      reviewer.role,
      payload.target_id || "",
      payload.target_type || "",
      payload.handbook_version || "",
      selectedText,
      payload.start_offset ?? "",
      payload.end_offset ?? "",
      body,
      "visible",
      createdAt,
    ]);
    invalidateCommentsCache(payload.handbook_version);
    return jsonResponse({ ok: true, comment_id: commentId, role: reviewer.role, created_at: createdAt });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// doGet: public comments + who-am-I
// ---------------------------------------------------------------------------

/** @param {Object} e doGet event with query params in e.parameter. */
function doGet(e) {
  const action = e.parameter.action;
  if (action === "comments") return jsonResponse(getPublicComments(e.parameter.version || ""));
  if (action === "me") return jsonResponse(whoAmI(e.parameter.token));
  return jsonResponse({ ok: false, error: "bad_request" });
}

function whoAmI(token) {
  const reviewer = lookupReviewerByToken(token);
  if (!reviewer || reviewer.status !== "active") return { ok: false, error: "invalid_token" };
  return { ok: true, role: reviewer.role };
}

function getPublicComments(version) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `comments:${version}`;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sheet = getSheet(TAB_FEEDBACK);
  const rows = readRows(sheet, FEEDBACK_COLUMNS);
  const visible = rows.filter((r) => r.status === "visible" && (!version || r.handbook_version === version));
  const hiddenParentIds = new Set(
    rows.filter((r) => r.status === "hidden").map((r) => r.comment_id)
  );
  const visibleParentIds = new Set(visible.map((r) => r.parent_id).filter(Boolean));

  const publicRows = visible.map(publicCommentFields);
  // hidden parents that still have visible replies need a placeholder so the thread renders
  for (const hiddenId of hiddenParentIds) {
    if (visibleParentIds.has(hiddenId) && !publicRows.some((r) => r.comment_id === hiddenId)) {
      const hiddenRow = rows.find((r) => r.comment_id === hiddenId);
      if (hiddenRow) publicRows.push(publicCommentFields(Object.assign({}, hiddenRow, { status: "hidden", body: "" })));
    }
  }

  const result = { ok: true, comments: publicRows };
  cache.put(cacheKey, JSON.stringify(result), COMMENTS_CACHE_SECONDS);
  return result;
}

function publicCommentFields(r) {
  return {
    comment_id: r.comment_id,
    parent_id: r.parent_id,
    role: r.role,
    target: r.provision_id,
    target_type: r.target_type,
    handbook_version: r.handbook_version,
    selected_text: r.selected_text,
    start_offset: r.start_offset,
    end_offset: r.end_offset,
    body: r.status === "hidden" ? "" : r.body,
    status: r.status,
    created_at: r.created_at,
  };
}

function invalidateCommentsCache(version) {
  CacheService.getScriptCache().remove(`comments:${version}`);
}

// ---------------------------------------------------------------------------
// Reviewer token lookup (cached) + rate limiting
// ---------------------------------------------------------------------------

function lookupReviewerByToken(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const cacheKey = `token:${token}`;
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const sheet = getSheet(TAB_REVIEWERS);
  const rows = readRows(sheet, REVIEWERS_COLUMNS);
  const match = rows.find((r) => r.token === token);
  if (match) cache.put(cacheKey, JSON.stringify(match), TOKEN_CACHE_SECONDS);
  return match || null;
}

function invalidateTokenCache() {
  // individual token keys expire on their own (5 min); nothing to do per-edit.
}

function checkRateLimit(token) {
  const cache = CacheService.getScriptCache();
  const bucket = `rate:${token}:${new Date().getHours()}`;
  const count = Number(cache.get(bucket) || "0");
  if (count >= RATE_LIMIT_PER_HOUR) return false;
  cache.put(bucket, String(count + 1), 3600);
  return true;
}

// ---------------------------------------------------------------------------
// Sheet helpers
// ---------------------------------------------------------------------------

function getSheet(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet tab: ${name}`);
  return sheet;
}

function readRows(sheet, columns) {
  const values = sheet.getDataRange().getValues();
  return values.slice(1).map((row) => rowFromValues(columns, row));
}

function rowFromValues(columns, values) {
  const record = {};
  columns.forEach((col, i) => { record[col] = values[i]; });
  return record;
}

function writeRow(sheet, rowNumber, columns, record) {
  const values = columns.map((col) => record[col]);
  sheet.getRange(rowNumber, 1, 1, columns.length).setValues([values]);
}

/** appendRow() writes below the last cell holding any value, and a checkbox column
 *  counts as values all the way down (unticked = FALSE) -- so on `reviewers`, whose
 *  approved/resend columns are checkboxes, appendRow() lands around row 1001.
 *  This writes below the last row with something in column A (the id column). */
function appendAfterLastRow(sheet, values) {
  const ids = sheet.getRange("A:A").getValues();
  let last = ids.length;
  while (last > 0 && ids[last - 1][0] === "") last -= 1;
  sheet.getRange(last + 1, 1, 1, values.length).setValues([values]);
}

function firstValue(arr) {
  return Array.isArray(arr) ? arr[0] : arr;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
