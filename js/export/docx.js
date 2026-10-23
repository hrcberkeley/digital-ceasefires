// .docx export via the `docx` npm package's UMD build, loaded on demand (it's
// ~1MB) rather than on every page load -- only builder users who click Export need it.
import { buildExportModel } from "./model.js";
import { lawGroupName } from "../utils.js";
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

export async function downloadDocx(db, draft, { includeFootnotes = true } = {}) {
  const docx = await loadDocxLib();
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, FootnoteReferenceRun, AlignmentType, LevelFormat } = docx;
  const model = buildExportModel(db, draft);
  const fnNum = new Map(model.footnotes.map((fn, i) => [fn.footnote_id, i + 1]));
  const meta = (label, value) => new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)] });
  const children = [new Paragraph({ text: model.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER })];

  if (model.contextLabel) children.push(meta("Context", model.contextLabel));
  if (model.parties.length) children.push(meta("Parties", model.parties.join(", ")));

  const renderSections = (list) => {
  for (const section of list) {
      const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][Math.min(section.depth, 2)];
      children.push(new Paragraph({ text: `${section.number}. ${section.title}`, heading }));
      section.items.forEach((item) => {
        const runs = [new TextRun({ text: `${item.label}\t` }), new TextRun(item.text)];
        if (includeFootnotes) for (const id of item.footnoteIds) if (fnNum.has(id)) runs.push(new FootnoteReferenceRun(fnNum.get(id)));
        children.push(new Paragraph({ children: runs, tabStops: [{ type: "left", position: 720 }], indent: { left: 720, hanging: 720 } }));
      });
    }
  };
  renderSections(model.sections);

  if (model.definitions.length) {
    children.push(new Paragraph({ text: "Definitions", heading: HeadingLevel.HEADING_1 }));
    for (const d of model.definitions) children.push(meta(d.term, d.text));
  }

  renderSections(model.signatureSections);
  if (model.genericSignatures) {
    children.push(new Paragraph({ text: "Signatures", heading: HeadingLevel.HEADING_1, keepNext: true }));
    for (const party of model.parties.length ? model.parties : ["Party A", "Party B"]) {
      children.push(new Paragraph({ children: [new TextRun({ text: `For ${party}`, bold: true })], keepNext: true, spacing: { before: 480, after: 0 } }));
      for (const label of ["Name:", "Title:", "Signature:", "Date:"]) {
        children.push(new Paragraph({ text: `${label} ______________________________`, keepNext: true, spacing: { before: 240, after: 0 } }));
      }
    }
  }
  if (model.lawClauses.length) {
    children.push(new Paragraph({ text: "Annex on Commitment to International Law", heading: HeadingLevel.HEADING_1 }));
    let lastGroup = null;
    for (const clause of model.lawClauses) {
      if (clause.group !== lastGroup) {
        children.push(new Paragraph({ text: lawGroupName(clause.group), heading: HeadingLevel.HEADING_2 }));
        lastGroup = clause.group;
      }
      children.push(new Paragraph({ text: clause.text, numbering: { reference: "bullets", level: 0 } }));
    }
  }



  const footnotes = {};
  if (includeFootnotes) {
    for (const fn of model.footnotes) {
      footnotes[fnNum.get(fn.footnote_id)] = { children: [new Paragraph({ children: [new TextRun({ text: `${fn.text}${fn.url ? ` (${fn.url})` : ""}`, size: 18 })] })] };
    }
  }

  const font = "Open Sans";
  const head = (size, before) => ({ run: { font, size, bold: true, color: "000000" }, paragraph: { spacing: { before, after: 120 }, keepNext: true } });
  const doc = new Document({
    creator: "Digital Ceasefire Builder",
    title: model.title,
    footnotes,
    numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
    styles: {
      default: {
        document: { run: { font: { ascii: font, hAnsi: font, cs: font }, size: 22 }, paragraph: { spacing: { after: 120, line: 276 } } },
        title: { run: { font, size: 36, bold: true, color: "000000" }, paragraph: { spacing: { before: 0, after: 360 }, alignment: AlignmentType.CENTER } },
        heading1: head(26, 360),
        heading2: head(22, 240),
        heading3: { ...head(22, 200), run: { font, size: 22, bold: true, italics: true, color: "000000" } },
      },
    },
    sections: [{ properties: { page: { margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } }, children }],
  });
  const blob = await Packer.toBlob(doc);
  triggerDownload(blob, "Digital Ceasefire-De-escalation Agreement.docx");
}
