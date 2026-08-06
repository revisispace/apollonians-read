import JSZip from "jszip";

export type ParsedDocument = {
  title: string;
  author: string;
  text: string;
  sourceName: string;
};

export type DocumentParseProgress = {
  phase: "extract" | "ocr";
  completed: number;
  total: number;
  message: string;
};

export type DocumentParseOptions = {
  onProgress?: (progress: DocumentParseProgress) => void;
};

type PdfDocument = Awaited<ReturnType<(typeof import("pdfjs-dist/legacy/build/pdf.mjs"))["getDocument"]>["promise"]>;

type TesseractWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};

type TesseractGlobal = {
  createWorker: (
    languages: string,
    oem?: number,
    options?: {
      workerPath?: string;
      corePath?: string;
      langPath?: string;
      logger?: (status: { status?: string; progress?: number }) => void;
    },
  ) => Promise<TesseractWorker>;
};

declare global {
  interface Window {
    Tesseract?: TesseractGlobal;
  }
}

const TESSERACT_VERSION = "6.0.1";
const TESSERACT_SCRIPT = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/tesseract.min.js`;
const TESSERACT_WORKER = `https://cdn.jsdelivr.net/npm/tesseract.js@${TESSERACT_VERSION}/dist/worker.min.js`;
const TESSERACT_CORE = "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.0.0/tesseract-core-simd-lstm.wasm.js";
const TESSERACT_LANG = "https://tessdata.projectnaptha.com/4.0.0";
let tesseractLoader: Promise<TesseractGlobal> | null = null;

const cleanText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const textFromMarkup = (markup: string, type: DOMParserSupportedType = "text/html") => {
  const document = new DOMParser().parseFromString(markup, type);
  document.querySelectorAll("script, style, nav, noscript, svg").forEach((node) => node.remove());
  return cleanText(document.body?.textContent ?? document.documentElement.textContent ?? "");
};

async function loadTesseract() {
  if (typeof window === "undefined") throw new Error("OCR PDF hanya tersedia di browser.");
  if (window.Tesseract) return window.Tesseract;
  if (tesseractLoader) return tesseractLoader;

  tesseractLoader = new Promise<TesseractGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TESSERACT_SCRIPT}"]`);
    const script = existing ?? document.createElement("script");
    const finish = () => {
      if (window.Tesseract) resolve(window.Tesseract);
      else reject(new Error("Modul OCR gagal dimuat."));
    };
    const fail = () => reject(new Error("Modul OCR gagal dimuat. Periksa koneksi internet lalu coba lagi."));

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", fail, { once: true });
      return;
    }

    script.src = TESSERACT_SCRIPT;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    tesseractLoader = null;
    throw error;
  });

  return tesseractLoader;
}

async function ocrPdf(
  pdf: PdfDocument,
  onProgress?: DocumentParseOptions["onProgress"],
) {
  const tesseract = await loadTesseract();
  const worker = await tesseract.createWorker("ind+eng", 1, {
    workerPath: TESSERACT_WORKER,
    corePath: TESSERACT_CORE,
    langPath: TESSERACT_LANG,
  });
  const pages: string[] = [];

  try {
    for (let index = 1; index <= pdf.numPages; index += 1) {
      onProgress?.({
        phase: "ocr",
        completed: index - 1,
        total: pdf.numPages,
        message: `Menjalankan OCR halaman ${index} dari ${pdf.numPages}…`,
      });
      const page = await pdf.getPage(index);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(2, Math.max(1.35, 1600 / Math.max(1, baseViewport.width)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas OCR tidak tersedia di browser ini.");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      const pageText = cleanText(result.data.text);
      if (pageText) pages.push(pageText);
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      onProgress?.({
        phase: "ocr",
        completed: index,
        total: pdf.numPages,
        message: `OCR halaman ${index} dari ${pdf.numPages} selesai.`,
      });
    }
  } finally {
    await worker.terminate();
  }

  return cleanText(pages.join("\n\n"));
}

async function parsePdf(file: Blob, options: DocumentParseOptions = {}) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= pdf.numPages; index += 1) {
    options.onProgress?.({
      phase: "extract",
      completed: index - 1,
      total: pdf.numPages,
      message: `Membaca teks PDF halaman ${index} dari ${pdf.numPages}…`,
    });
    const page = await pdf.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
    page.cleanup();
  }
  const extracted = cleanText(pages.join("\n\n"));
  if (extracted.length >= 20) return extracted;

  options.onProgress?.({
    phase: "ocr",
    completed: 0,
    total: pdf.numPages,
    message: `PDF berupa hasil scan. Menyiapkan OCR untuk ${pdf.numPages} halaman…`,
  });
  const recognized = await ocrPdf(pdf, options.onProgress);
  if (recognized.length < 20) {
    throw new Error("PDF berupa hasil scan, tetapi OCR tidak menemukan teks yang cukup jelas.");
  }
  return recognized;
}

async function parseEpub(file: Blob) {
  const archive = await JSZip.loadAsync(await file.arrayBuffer());
  const container = await archive.file("META-INF/container.xml")?.async("string");
  if (!container) throw new Error("Struktur EPUB tidak valid.");
  const containerXml = new DOMParser().parseFromString(container, "application/xml");
  const packagePath = containerXml.querySelector("rootfile")?.getAttribute("full-path");
  if (!packagePath) throw new Error("Daftar isi EPUB tidak ditemukan.");

  const packageXml = await archive.file(packagePath)?.async("string");
  if (!packageXml) throw new Error("Metadata EPUB tidak ditemukan.");
  const opf = new DOMParser().parseFromString(packageXml, "application/xml");
  const folder = packagePath.includes("/") ? packagePath.slice(0, packagePath.lastIndexOf("/") + 1) : "";
  const manifest = new Map(
    Array.from(opf.querySelectorAll("manifest item")).map((item) => [
      item.getAttribute("id") ?? "",
      item.getAttribute("href") ?? "",
    ]),
  );
  const sections: string[] = [];
  for (const item of Array.from(opf.querySelectorAll("spine itemref"))) {
    const href = manifest.get(item.getAttribute("idref") ?? "");
    if (!href) continue;
    const entry = archive.file(decodeURIComponent(`${folder}${href}`.split("#")[0]));
    if (entry) sections.push(textFromMarkup(await entry.async("string")));
  }
  return {
    title: cleanText(opf.querySelector("metadata title")?.textContent ?? ""),
    author: cleanText(opf.querySelector("metadata creator")?.textContent ?? ""),
    text: cleanText(sections.join("\n\n")),
  };
}

async function parseDocx(file: Blob) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return cleanText(result.value);
}

export async function parseBookFile(file: File, options: DocumentParseOptions = {}): Promise<ParsedDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  let title = file.name.replace(/\.[^.]+$/, "");
  let author = "Penulis tidak diketahui";
  let text = "";

  if (extension === "txt" || extension === "md") text = cleanText(await file.text());
  else if (extension === "pdf") text = await parsePdf(file, options);
  else if (extension === "docx") text = await parseDocx(file);
  else if (extension === "epub") {
    const epub = await parseEpub(file);
    title = epub.title || title;
    author = epub.author || author;
    text = epub.text;
  } else {
    throw new Error("Format belum didukung. Gunakan PDF, EPUB, DOCX, TXT, atau MD.");
  }

  if (text.length < 20) throw new Error("Teks buku tidak dapat dibaca atau terlalu pendek.");
  return { title, author, text, sourceName: file.name };
}

export async function parseBookUrl(url: string, options: DocumentParseOptions = {}): Promise<ParsedDocument> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Tautan merespons ${response.status}.`);
  const contentType = response.headers.get("content-type") ?? "";
  const pathname = new URL(url).pathname;
  const filename = decodeURIComponent(pathname.split("/").pop() || "Buku dari tautan");
  const blob = await response.blob();

  if (/pdf|epub|wordprocessingml|text\/(plain|markdown)/i.test(contentType) || /\.(pdf|epub|docx|txt|md)$/i.test(pathname)) {
    return parseBookFile(new File([blob], filename, { type: contentType }), options);
  }

  const html = await blob.text();
  const document = new DOMParser().parseFromString(html, "text/html");
  const title = cleanText(document.querySelector("h1")?.textContent ?? document.title ?? filename);
  const author = cleanText(
    document.querySelector('[rel="author"], [name="author"]')?.getAttribute("content") ??
      document.querySelector('[rel="author"]')?.textContent ??
      "Penulis tidak diketahui",
  );
  const text = textFromMarkup(document.querySelector("article")?.outerHTML ?? html);
  if (text.length < 20) throw new Error("Teks pada tautan tidak dapat dibaca.");
  return { title, author, text, sourceName: url };
}

export function textChunks(text: string, maxLength = 420) {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = `${current} ${sentence}`.trim();
    if (candidate.length <= maxLength) current = candidate;
    else {
      if (current) chunks.push(current);
      if (sentence.length <= maxLength) current = sentence.trim();
      else {
        const words = sentence.trim().split(/\s+/);
        current = "";
        for (const word of words) {
          if (`${current} ${word}`.trim().length > maxLength && current) {
            chunks.push(current);
            current = word;
          } else current = `${current} ${word}`.trim();
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
