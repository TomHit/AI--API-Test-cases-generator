// src/core/intelligence/documentIngestion.js
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function normalizeWhitespace(text = "") {
  return String(text || "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanPdfLine(line = "") {
  return String(line || "")
    .replace(/\s+/g, " ")
    .replace(/[•▪■]/g, "-")
    .trim();
}

function mergeBrokenLines(lines = []) {
  const out = [];

  for (const raw of lines) {
    const line = cleanPdfLine(raw);
    if (!line) continue;

    if (out.length === 0) {
      out.push(line);
      continue;
    }

    const prev = out[out.length - 1];

    const shouldJoin =
      !/[.!?:]$/.test(prev) &&
      !/^[A-Z][A-Za-z0-9\s/&-]{1,80}$/.test(line) &&
      !/^[-*•]/.test(line) &&
      !/^\d+[.)]/.test(line);

    if (shouldJoin) {
      out[out.length - 1] = `${prev} ${line}`.replace(/\s+/g, " ").trim();
    } else {
      out.push(line);
    }
  }

  return out;
}

async function extractPdfText(filePath) {
  const data = await fs.readFile(filePath);
  const pdf = await getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const pages = [];
  let textItemCount = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    textItemCount += textContent.items.length;

    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const item of textContent.items) {
      if (!("str" in item)) continue;

      const y = item.transform?.[5] ?? null;
      const str = String(item.str || "").trim();
      if (!str) continue;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5) {
        if (currentLine.length) {
          lines.push(currentLine.join(" "));
          currentLine = [];
        }
      }

      currentLine.push(str);
      lastY = y;
    }

    if (currentLine.length) {
      lines.push(currentLine.join(" "));
    }

    const merged = mergeBrokenLines(lines);
    pages.push(merged.join("\n"));
  }

  const text = normalizeWhitespace(pages.join("\n\n"));

  return {
    kind: "pdf",
    text,
    pageCount: pdf.numPages,
    hasTextLayer: textItemCount > 0 && text.length > 0,
    warnings:
      textItemCount > 0
        ? []
        : ["No PDF text layer found. Likely scanned PDF; OCR not applied."],
  };
}

async function extractDocxText(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  return {
    kind: "docx",
    text: normalizeWhitespace(result.value || ""),
    warnings: result.messages?.map((m) => m.message || String(m)) || [],
  };
}

async function convertDocToDocx(filePath) {
  const dir = path.dirname(filePath);

  await execFileAsync("soffice", [
    "--headless",
    "--convert-to",
    "docx",
    "--outdir",
    dir,
    filePath,
  ]);

  const parsed = path.parse(filePath);
  return path.join(dir, `${parsed.name}.docx`);
}

export async function ingestDocument(filePath, options = {}) {
  const originalName = String(options.originalName || "");
  const mimeType = String(options.mimeType || "").toLowerCase();

  let ext = path.extname(originalName).toLowerCase();

  if (!ext) {
    ext = path.extname(filePath).toLowerCase();
  }

  if (!ext) {
    if (mimeType.includes("pdf")) {
      ext = ".pdf";
    } else if (
      mimeType.includes(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      )
    ) {
      ext = ".docx";
    } else if (mimeType.includes("application/msword")) {
      ext = ".doc";
    }
  }

  if (ext === ".pdf") {
    return extractPdfText(filePath);
  }

  if (ext === ".docx") {
    return extractDocxText(filePath);
  }

  if (ext === ".doc") {
    const docxPath = await convertDocToDocx(filePath);
    const extracted = await extractDocxText(docxPath);
    return {
      ...extracted,
      originalKind: "doc",
      convertedFromDoc: true,
      convertedPath: docxPath,
    };
  }

  throw new Error(
    `Unsupported document type: ${ext || "unknown"} | originalName=${originalName} | mimeType=${mimeType}`,
  );
}
