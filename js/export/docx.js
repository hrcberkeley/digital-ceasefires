// .docx export via the `docx` npm package's UMD build, loaded on demand (it's
// ~1MB) rather than on every page load -- only builder users who click Export need it.
import { buildExportModel } from "./model.js";
import { triggerDownload } from "./markdown.js";

// the .umd.cjs build is served by jsdelivr as content-type application/node,
// which Chrome refuses to execute as a <script> -- the iife build gets a real
// application/javascript type and sets the same `docx` global.
const DOCX_LIB_URL = "https://cdn.jsdelivr.net/npm/docx@9.7.1/dist/index.iife.js";
let loadingPromise = null;

function loadDocxLib() {
  if (window.docx) return Promise.resolve(window.docx);
  if (!loadingPromise) {
    loadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = DOCX_LIB_URL;
      script.onload = () => resolve(window.docx);
      script.onerror = () => reject(new Error("Couldn't load the .docx export library."));
      document.head.appendChild(script);
    });
  }
  return loadingPromise;
}

export async function downloadDocx(db, draft, { includeFootnotes = false } = {}) {
  const docx = await loadDocxLib();
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;
  const model = buildExportModel(db, draft);
  const children = [new Paragraph({ text: model.title, heading: HeadingLevel.TITLE })];

  if (model.contextLabel) children.push(new Paragraph({ children: [new TextRun({ text: `Context: ${model.contextLabel}`, bold: true })] }));
  if (model.parties.length) children.push(new Paragraph({ children: [new TextRun({ text: `Parties: ${model.parties.join(", ")}`, bold: true })] }));

  for (const section of model.sections) {
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1 }));
    for (const item of section.items) {
      const text = includeFootnotes && item.footnoteIds.length ? `${item.text} ${item.footnoteIds.map((id) => `[${id.replace("fn-", "")}]`).join(" ")}` : item.text;
      children.push(new Paragraph({ text }));
    }
  }

  if (model.definitions.length) {
    children.push(new Paragraph({ text: "Definitions", heading: HeadingLevel.HEADING_1 }));
    for (const d of model.definitions) {
      children.push(new Paragraph({ children: [new TextRun({ text: `${d.term}: `, bold: true }), new TextRun(d.text)] }));
    }
  }

  if (model.lawClauses.length) {
    children.push(new Paragraph({ text: "Annex on Commitment to International Law", heading: HeadingLevel.HEADING_1 }));
    let lastGroup = null;
    for (const clause of model.lawClauses) {
      if (clause.group !== lastGroup) {
        children.push(new Paragraph({ text: clause.group, heading: HeadingLevel.HEADING_2 }));
        lastGroup = clause.group;
      }
      children.push(new Paragraph({ text: clause.text, bullet: { level: 0 } }));
    }
  }

  children.push(new Paragraph({ text: "Signatures", heading: HeadingLevel.HEADING_1 }));
  for (const party of model.parties.length ? model.parties : ["Party A", "Party B"]) {
    children.push(new Paragraph({ text: `For ${party}: ________________________` }));
  }

  if (includeFootnotes && model.footnotes.length) {
    children.push(new Paragraph({ text: "Footnotes", heading: HeadingLevel.HEADING_1 }));
    for (const fn of model.footnotes) {
      children.push(new Paragraph({ text: `${fn.footnote_id.replace("fn-", "")}. ${fn.text}${fn.url ? ` (${fn.url})` : ""}` }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, "digital-ceasefire-agreement.docx");
}
