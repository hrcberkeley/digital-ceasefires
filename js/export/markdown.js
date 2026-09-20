import { buildExportModel } from "./model.js";

export function draftToMarkdown(db, draft, { includeFootnotes = false } = {}) {
  const model = buildExportModel(db, draft);
  const lines = [`# ${model.title}`, ""];
  if (model.contextLabel) lines.push(`**Context:** ${model.contextLabel}`, "");
  if (model.parties.length) lines.push(`**Parties:** ${model.parties.join(", ")}`, "");

  for (const section of model.sections) {
    lines.push(`## ${section.title}`, "");
    for (const item of section.items) {
      lines.push(item.text + footnoteMarks(item.footnoteIds, includeFootnotes), "");
    }
  }

  if (model.definitions.length) {
    lines.push("## Definitions", "");
    for (const d of model.definitions) lines.push(`**${d.term}:** ${d.text}`, "");
  }

  if (model.lawClauses.length) {
    lines.push("## Annex on Commitment to International Law", "");
    let lastGroup = null;
    for (const clause of model.lawClauses) {
      if (clause.group !== lastGroup) {
        lines.push(`### ${clause.group}`, "");
        lastGroup = clause.group;
      }
      lines.push(`- ${clause.text}`);
    }
    lines.push("");
  }

  lines.push("## Signatures", "");
  for (const party of model.parties.length ? model.parties : ["Party A", "Party B"]) {
    lines.push(`For ${party}: ________________________`, "");
  }

  if (includeFootnotes && model.footnotes.length) {
    lines.push("## Footnotes", "");
    for (const fn of model.footnotes) {
      lines.push(`${fn.footnote_id.replace("fn-", "")}. ${fn.text}${fn.url ? ` (${fn.url})` : ""}`);
    }
  }

  return lines.join("\n");
}

function footnoteMarks(ids, includeFootnotes) {
  if (!includeFootnotes || !ids.length) return "";
  return ` ${ids.map((id) => `[${id.replace("fn-", "")}]`).join(" ")}`;
}

export function downloadMarkdown(db, draft, opts) {
  const text = draftToMarkdown(db, draft, opts);
  const blob = new Blob([text], { type: "text/markdown" });
  triggerDownload(blob, "digital-ceasefire-agreement.md");
}

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
