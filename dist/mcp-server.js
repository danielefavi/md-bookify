#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { writeFile, mkdir, stat, mkdtemp, rm, readFile } from 'fs/promises';
import { isAbsolute, resolve, dirname, basename, join, extname } from 'path';
import { Renderer, Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-diff.js';
import { createRequire } from 'module';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import JSZip from 'jszip';
import sharp from 'sharp';

var renderer = new Renderer();
renderer.code = function({ text, lang }) {
  const language = lang ?? "";
  const grammar = language ? Prism.languages[language] : void 0;
  if (grammar) {
    const highlighted = Prism.highlight(text, grammar, language);
    return `<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre>
`;
  }
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<pre><code${language ? ` class="language-${language}"` : ""}>${escaped}</code></pre>
`;
};
var markedInstances = /* @__PURE__ */ new Map();
function getMarked(mathOutput) {
  const cached = markedInstances.get(mathOutput);
  if (cached) return cached;
  const instance = new Marked();
  instance.use(markedKatex({ throwOnError: false, output: mathOutput }));
  markedInstances.set(mathOutput, instance);
  return instance;
}
function parseMarkdown(markdown, options) {
  const instance = getMarked(options?.mathOutput ?? "html");
  const result = instance.parse(markdown, {
    gfm: options?.gfm ?? true,
    async: false,
    renderer
  });
  if (typeof result !== "string") {
    throw new Error("Unexpected async result from marked.parse");
  }
  return result;
}
async function parseMarkdownFile(filePath, options) {
  const ext = extname(filePath).toLowerCase();
  if (ext !== ".md" && ext !== ".markdown") {
    throw new Error(`Unsupported file extension "${ext}". Expected .md or .markdown`);
  }
  const content = await readFile(filePath, "utf-8");
  return parseMarkdown(content, options);
}
var PRISM_DRACULA_CSS = `code[class*=language-],pre[class*=language-]{color:#f8f8f2;background:0 0;text-shadow:0 1px rgba(0,0,0,.3);font-family:Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;word-wrap:normal;line-height:1.5;-moz-tab-size:4;-o-tab-size:4;tab-size:4;-webkit-hyphens:none;-moz-hyphens:none;-ms-hyphens:none;hyphens:none}pre[class*=language-]{padding:1em;margin:.5em 0;overflow:auto;border-radius:.3em}:not(pre)>code[class*=language-],pre[class*=language-]{background:#282a36}:not(pre)>code[class*=language-]{padding:.1em;border-radius:.3em;white-space:normal}.token.cdata,.token.comment,.token.doctype,.token.prolog{color:#6272a4}.token.punctuation{color:#f8f8f2}.namespace{opacity:.7}.token.constant,.token.deleted,.token.property,.token.symbol,.token.tag{color:#ff79c6}.token.boolean,.token.number{color:#bd93f9}.token.attr-name,.token.builtin,.token.char,.token.inserted,.token.selector,.token.string{color:#50fa7b}.language-css .token.string,.style .token.string,.token.entity,.token.operator,.token.url,.token.variable{color:#f8f8f2}.token.atrule,.token.attr-value,.token.class-name,.token.function{color:#f1fa8c}.token.keyword{color:#8be9fd}.token.important,.token.regex{color:#ffb86c}.token.bold,.token.important{font-weight:700}.token.italic{font-style:italic}.token.entity{cursor:help}`;
function findStylesDir() {
  let dir = dirname(fileURLToPath(import.meta.url));
  const root = resolve("/");
  while (dir !== root) {
    const candidate = join(dir, "styles");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`Could not find styles/ directory relative to ${dirname(fileURLToPath(import.meta.url))}`);
}
var _stylesDir = null;
function getStylesDir() {
  if (!_stylesDir) _stylesDir = findStylesDir();
  return _stylesDir;
}
function getBuiltInStyles() {
  const dir = getStylesDir();
  return readdirSync(dir).filter((f) => f.endsWith(".css")).map((f) => f.replace(/\.css$/, "")).sort();
}
var _styleCssCache = /* @__PURE__ */ new Map();
function resolveStyleCss(style) {
  const name = style ?? "default";
  if (name.endsWith(".css")) {
    const cached = _styleCssCache.get(name);
    if (cached) return cached;
    const css = readFileSync(name, "utf-8");
    _styleCssCache.set(name, css);
    return css;
  }
  const cssPath = join(getStylesDir(), `${name}.css`);
  if (existsSync(cssPath)) {
    const cached = _styleCssCache.get(name);
    if (cached) return cached;
    const css = readFileSync(cssPath, "utf-8");
    _styleCssCache.set(name, css);
    return css;
  }
  throw new Error(
    `Unknown style "${name}". Built-in styles: ${getBuiltInStyles().join(", ")}. Or provide a path to a .css file.`
  );
}
var _katexCss = null;
function getKatexCss() {
  if (_katexCss) return _katexCss;
  const req = createRequire(import.meta.url);
  const katexCssPath = req.resolve("katex/dist/katex.min.css");
  _katexCss = readFileSync(katexCssPath, "utf-8");
  return _katexCss;
}

// src/template.ts
function wrapHtml(contentHtml, options) {
  const title = options?.title ?? "Document";
  let extraCss = "";
  if (contentHtml.includes('class="katex"')) {
    try {
      extraCss = `<style>${getKatexCss()}</style>`;
    } catch {
    }
  }
  return `<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${resolveStyleCss(options?.style)}</style>
    <style>${PRISM_DRACULA_CSS}</style>
    ${extraCss}
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;
}

// src/epub-template.ts
var EPUB_BASE_CSS = `
body {
  margin: 0;
  padding: 0;
  line-height: 1.5;
  font-size: 1em;
}
h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}
h1 { font-size: 1.8em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
p { margin: 0.6em 0; }
a { color: inherit; text-decoration: underline; }
img {
  max-width: 100%;
  height: auto;
}
blockquote {
  margin: 1em 0;
  padding: 0 1em;
  border-left: 4px solid #999;
  color: #555;
}
hr {
  border: none;
  border-top: 1px solid #999;
  margin: 1.5em 0;
}
ul, ol { margin: 0.6em 0; padding-left: 1.5em; }
li { margin: 0.2em 0; }
table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
}
th, td {
  border: 1px solid #999;
  padding: 0.4em 0.6em;
  text-align: left;
}
th { background-color: #eee; }
code {
  font-family: monospace;
  font-size: 0.95em;
  background-color: #f4f4f4;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
pre {
  font-family: monospace;
  font-size: 0.9em;
  background-color: #f4f4f4;
  padding: 0.8em 1em;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  page-break-inside: avoid;
}
pre code {
  background: none;
  padding: 0;
  border-radius: 0;
}
`.trim();
var PRISM_LIGHT_CSS = `
.token.comment, .token.prolog, .token.doctype, .token.cdata {
  color: #708090;
  font-style: italic;
}
.token.punctuation { color: #4a4a4a; }
.token.namespace { opacity: 0.7; }
.token.property, .token.tag, .token.boolean, .token.number,
.token.constant, .token.symbol, .token.deleted {
  color: #905;
}
.token.selector, .token.attr-name, .token.string, .token.char,
.token.builtin, .token.inserted {
  color: #690;
}
.token.operator, .token.entity, .token.url,
.language-css .token.string, .style .token.string {
  color: #9a6e3a;
}
.token.atrule, .token.attr-value, .token.keyword {
  color: #07a;
  font-weight: bold;
}
.token.function, .token.class-name { color: #dd4a68; }
.token.regex, .token.important, .token.variable { color: #e90; }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
`.trim();
function wrapHtmlForEpub(contentHtml, options) {
  const title = options?.title ?? "Document";
  return `<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>${EPUB_BASE_CSS}</style>
    <style>${PRISM_LIGHT_CSS}</style>
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;
}
var DEFAULT_MARGIN = { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" };
async function generatePdf(html, options) {
  const browser = await puppeteer.launch({
    headless: true,
    args: process.env.CI ? ["--no-sandbox", "--disable-setuid-sandbox"] : []
  });
  let tempDir;
  try {
    const page = await browser.newPage();
    if (options?.basePath) {
      tempDir = await mkdtemp(join(tmpdir(), "md-bookify-"));
      const tempHtmlPath = join(tempDir, "index.html");
      const baseUrl = pathToFileURL(options.basePath + "/").href;
      html = html.replace("<head>", `<head>
    <base href="${baseUrl}" />`);
      await writeFile(tempHtmlPath, html);
      await page.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: "networkidle0" });
    } else {
      await page.setContent(html, { waitUntil: "networkidle0" });
    }
    const pdfBuffer = await page.pdf({
      format: options?.format ?? "A4",
      landscape: options?.landscape ?? false,
      margin: options?.margin ?? DEFAULT_MARGIN,
      printBackground: options?.printBackground ?? true
    });
    const doc = await PDFDocument.load(pdfBuffer);
    const author = options?.author ?? "Unknown";
    doc.setAuthor(author);
    doc.setCreator(author);
    return Buffer.from(await doc.save());
  } finally {
    await browser.close();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}
async function generatePdfToFile(html, outputPath, options) {
  const buffer = await generatePdf(html, options);
  await writeFile(outputPath, buffer);
}
var MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
  "image/avif": "avif"
};
var EXT_TO_MIME = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);
EXT_TO_MIME["jpeg"] = "image/jpeg";
EXT_TO_MIME["tif"] = "image/tiff";
function detectMimeFromBytes(data) {
  if (data.length < 4) return null;
  if (data[0] === 137 && data[1] === 80 && data[2] === 78 && data[3] === 71) return "image/png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (data[0] === 71 && data[1] === 73 && data[2] === 70 && data[3] === 56) return "image/gif";
  if (data.length >= 12 && data[0] === 82 && data[1] === 73 && data[2] === 70 && data[3] === 70 && data[8] === 87 && data[9] === 69 && data[10] === 66 && data[11] === 80) return "image/webp";
  if (data[0] === 66 && data[1] === 77) return "image/bmp";
  const head = data.subarray(0, Math.min(1e3, data.length)).toString("utf-8");
  if (head.includes("<svg")) return "image/svg+xml";
  return null;
}
function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
var BOOLEAN_ATTRS = [
  "allowfullscreen",
  "async",
  "autofocus",
  "autoplay",
  "checked",
  "compact",
  "controls",
  "declare",
  "default",
  "defer",
  "disabled",
  "formnovalidate",
  "hidden",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "noresize",
  "noshade",
  "novalidate",
  "nowrap",
  "open",
  "readonly",
  "required",
  "reversed",
  "selected"
];
var BOOLEAN_ATTR_RE = new RegExp(
  `(\\s)(${BOOLEAN_ATTRS.join("|")})(?=\\s|/?>)(?!\\s*=)`,
  "gi"
);
function sanitizeForXhtml(html) {
  return html.replace(
    /<[a-zA-Z][^>]*>/g,
    (tag) => tag.replace(BOOLEAN_ATTR_RE, (_, ws, attr) => `${ws}${attr.toLowerCase()}="${attr.toLowerCase()}"`)
  );
}
var IMG_SRC_RE = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi;
function mimeFromExtension(filepath) {
  const ext = extname(filepath).slice(1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}
async function readImageUrl(src) {
  try {
    const data = await readFile(new URL(src));
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  } catch (err) {
    console.warn(`md-bookify: could not read image ${src}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
async function fetchImageUrl(src) {
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(3e4) });
    if (!response.ok) {
      console.warn(`md-bookify: could not fetch image ${src}: HTTP ${response.status}`);
      return null;
    }
    const data = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? null;
    return { data, contentType };
  } catch (err) {
    console.warn(`md-bookify: could not fetch image ${src}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
function detectMime(data, src, contentType) {
  if (contentType && MIME_TO_EXT[contentType]) return contentType;
  const detected = detectMimeFromBytes(data);
  if (detected) return detected;
  return mimeFromExtension(src);
}
async function convertSvgToPng(data) {
  return sharp(data).png().toBuffer();
}
async function extractAndEmbedImages(html) {
  const images = [];
  const replacements = [];
  const urlToPath = /* @__PURE__ */ new Map();
  IMG_SRC_RE.lastIndex = 0;
  let match;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
    const fullMatch = match[0];
    const before = match[1] ?? "";
    const quote = match[2] ?? '"';
    const src = match[3] ?? "";
    const after = match[4] ?? "";
    if (!src || src.startsWith("data:") || src.startsWith("#")) continue;
    const cached = urlToPath.get(src);
    if (cached) {
      const replacement2 = `<img${before}src=${quote}${cached}${quote}${after}>`;
      replacements.push({ start: match.index, end: match.index + fullMatch.length, replacement: replacement2 });
      continue;
    }
    let data = null;
    let contentType = null;
    if (src.startsWith("file://")) {
      data = await readImageUrl(src);
    } else if (src.startsWith("http://") || src.startsWith("https://")) {
      const result2 = await fetchImageUrl(src);
      if (result2) {
        data = result2.data;
        contentType = result2.contentType;
      }
    } else if (isAbsolute(src)) {
      data = await readImageUrl(pathToFileURL(src).href);
    } else {
      continue;
    }
    if (!data) continue;
    let mime = detectMime(data, src, contentType);
    if (!mime) {
      console.warn(`md-bookify: could not determine image type for ${src}`);
      continue;
    }
    if (mime === "image/svg+xml") {
      try {
        data = await convertSvgToPng(data);
        mime = "image/png";
      } catch (err) {
        console.warn(`md-bookify: could not convert SVG to PNG for ${src}: ${err instanceof Error ? err.message : err}`);
        continue;
      }
    }
    const ext = MIME_TO_EXT[mime];
    if (!ext) continue;
    const id = randomUUID();
    const relativePath = `images/${id}.${ext}`;
    images.push({ id, extension: ext, mediaType: mime, data });
    urlToPath.set(src, relativePath);
    const replacement = `<img${before}src=${quote}${relativePath}${quote}${after}>`;
    replacements.push({ start: match.index, end: match.index + fullMatch.length, replacement });
  }
  if (replacements.length === 0) return { html, images };
  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return { html: result, images };
}
async function loadCoverImage(cover) {
  let data = null;
  let contentType = null;
  if (cover.startsWith("http://") || cover.startsWith("https://")) {
    const result = await fetchImageUrl(cover);
    if (!result) return null;
    data = result.data;
    contentType = result.contentType;
  } else {
    const url = cover.startsWith("file://") ? cover : pathToFileURL(cover).href;
    data = await readImageUrl(url);
  }
  if (!data) return null;
  let mime = detectMime(data, cover, contentType);
  if (!mime) {
    console.warn(`md-bookify: could not determine cover image type for ${cover}`);
    return null;
  }
  if (mime === "image/svg+xml") {
    try {
      data = await convertSvgToPng(data);
      mime = "image/png";
    } catch (err) {
      console.warn(`md-bookify: could not convert SVG cover to PNG: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;
  return { data, mediaType: mime, extension: ext };
}
var CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
function generateContentOpf(d) {
  const creators = d.authors.map((a) => `    <dc:creator>${escapeXml(a)}</dc:creator>`).join("\n");
  const imageManifest = d.images.map((img) => `    <item id="image_${img.id}" href="images/${img.id}.${img.extension}" media-type="${img.mediaType}"/>`).join("\n");
  const coverItem = d.cover ? `
    <item id="image_cover" href="cover.${d.cover.extension}" media-type="${d.cover.mediaType}"/>` : "";
  const coverMeta = d.cover ? `
    <meta name="cover" content="image_cover"/>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${d.uuid}</dc:identifier>
    <dc:title>${escapeXml(d.title)}</dc:title>
    <dc:language>${escapeXml(d.language)}</dc:language>
${creators}${d.publisher ? `
    <dc:publisher>${escapeXml(d.publisher)}</dc:publisher>` : ""}${d.description ? `
    <dc:description>${escapeXml(d.description)}</dc:description>` : ""}
    <meta property="dcterms:modified">${d.modified}</meta>${coverMeta}
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="style.css" media-type="text/css"/>
    <item id="chapter_0" href="chapter_0.xhtml" media-type="application/xhtml+xml"/>${coverItem}
${imageManifest}
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter_0"/>
  </spine>
</package>`;
}
function generateTocNcx(uuid, title, author) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${uuid}"/>
    <meta name="dtb:generator" content="md-bookify"/>
    <meta name="dtb:depth" content="1"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <docAuthor><text>${escapeXml(author)}</text></docAuthor>
  <navMap>
    <navPoint id="chapter_0" playOrder="1" class="chapter">
      <navLabel><text>${escapeXml(title)}</text></navLabel>
      <content src="chapter_0.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;
}
function generateTocXhtml(title, language) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8"/>
  <title>Table of Contents</title>
</head>
<body>
  <nav id="toc" epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
      <li><a href="chapter_0.xhtml">${escapeXml(title)}</a></li>
    </ol>
  </nav>
</body>
</html>`;
}
function generateChapterXhtml(title, language, content) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"
      xml:lang="${escapeXml(language)}" lang="${escapeXml(language)}">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${content}
</body>
</html>`;
}
async function packageEpub(options) {
  const uuid = randomUUID();
  const authors = Array.isArray(options.author) ? options.author : [options.author];
  const authorString = authors.join(", ");
  const modified = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const { html: rawContent, images } = await extractAndEmbedImages(options.content);
  const processedContent = sanitizeForXhtml(rawContent);
  let coverData = null;
  if (options.cover) {
    coverData = await loadCoverImage(options.cover);
  }
  const contentOpf = generateContentOpf({
    uuid,
    title: options.title,
    authors,
    language: options.language,
    publisher: options.publisher,
    description: options.description,
    modified,
    images,
    cover: coverData ? { mediaType: coverData.mediaType, extension: coverData.extension } : void 0
  });
  const tocNcx = generateTocNcx(uuid, options.title, authorString);
  const tocXhtml = generateTocXhtml(options.title, options.language);
  const chapterXhtml = generateChapterXhtml(options.title, options.language, processedContent);
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", CONTAINER_XML);
  zip.file("OEBPS/content.opf", contentOpf);
  zip.file("OEBPS/toc.ncx", tocNcx);
  zip.file("OEBPS/toc.xhtml", tocXhtml);
  zip.file("OEBPS/chapter_0.xhtml", chapterXhtml);
  zip.file("OEBPS/style.css", options.css || "");
  if (coverData) {
    zip.file(`OEBPS/cover.${coverData.extension}`, coverData.data);
  }
  for (const img of images) {
    zip.file(`OEBPS/images/${img.id}.${img.extension}`, img.data);
  }
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 }
  });
  return buffer;
}

// src/epub.ts
var ZWSP = "\u200B";
function insertWordBreaks(html, maxLen = 20) {
  return html.split(/(<[^>]+>)/).map((segment) => {
    if (segment.startsWith("<")) return segment;
    return segment.replace(/\S{21,}/g, (word) => {
      let result = "";
      for (let i = 0; i < word.length; i++) {
        if (i > 0 && i % maxLen === 0) result += ZWSP;
        result += word[i];
      }
      return result;
    });
  }).join("");
}
var STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
var TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
var BODY_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;
var IMG_SRC_RE2 = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi;
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "webp",
  "bmp",
  "ico",
  "tiff",
  "tif",
  "avif"
]);
function urlHasImageExtension(url) {
  try {
    const pathname = new URL(url).pathname;
    const dotIndex = pathname.lastIndexOf(".");
    if (dotIndex === -1) return false;
    const ext = pathname.slice(dotIndex + 1).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}
function extractStyleAndBody(html) {
  const cssChunks = [];
  let match;
  STYLE_RE.lastIndex = 0;
  while ((match = STYLE_RE.exec(html)) !== null) {
    if (match[1]) cssChunks.push(match[1].trim());
  }
  const css = cssChunks.join("\n\n");
  const bodyMatch = html.match(BODY_RE);
  const body = bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : html;
  const titleMatch = html.match(TITLE_RE);
  const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : void 0;
  return { css, body, title };
}
async function embedLocalImages(html, basePath) {
  const replacements = [];
  IMG_SRC_RE2.lastIndex = 0;
  let match;
  while ((match = IMG_SRC_RE2.exec(html)) !== null) {
    const fullMatch = match[0];
    const before = match[1] ?? "";
    const quote = match[2] ?? '"';
    const src = match[3] ?? "";
    const after = match[4] ?? "";
    if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:") || src.startsWith("file://") || src.startsWith("#")) {
      continue;
    }
    const absolutePath = isAbsolute(src) ? src : resolve(basePath, src);
    try {
      await stat(absolutePath);
    } catch (err) {
      console.warn(
        `md-bookify: could not read image ${absolutePath}: ${err instanceof Error ? err.message : err}`
      );
      continue;
    }
    const fileUrl = pathToFileURL(absolutePath).href;
    const replacement = `<img${before}src=${quote}${fileUrl}${quote}${after}>`;
    replacements.push({ start: match.index, end: match.index + fullMatch.length, replacement });
  }
  if (replacements.length === 0) return html;
  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return result;
}
async function fetchRemoteImages(html) {
  const candidates = [];
  IMG_SRC_RE2.lastIndex = 0;
  let match;
  while ((match = IMG_SRC_RE2.exec(html)) !== null) {
    const src = match[3] ?? "";
    if (!src.startsWith("http://") && !src.startsWith("https://")) continue;
    if (urlHasImageExtension(src)) continue;
    candidates.push({
      start: match.index,
      end: match.index + match[0].length,
      before: match[1] ?? "",
      quote: match[2] ?? '"',
      src,
      after: match[4] ?? "",
      fullLength: match[0].length
    });
  }
  if (candidates.length === 0) return { html, tempDir: null };
  const tempDir = await mkdtemp(join(tmpdir(), "md-bookify-remote-"));
  const downloaded = /* @__PURE__ */ new Map();
  const replacements = [];
  for (const item of candidates) {
    const cached = downloaded.get(item.src);
    if (cached) {
      const replacement = `<img${item.before}src=${item.quote}${cached}${item.quote}${item.after}>`;
      replacements.push({ start: item.start, end: item.end, replacement });
      continue;
    }
    try {
      const response = await fetch(item.src, { signal: AbortSignal.timeout(3e4) });
      if (!response.ok) {
        console.warn(`md-bookify: could not fetch image ${item.src}: HTTP ${response.status}`);
        continue;
      }
      const data = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
      let ext;
      if (contentType) ext = MIME_TO_EXT[contentType];
      if (!ext) {
        const detected = detectMimeFromBytes(data);
        if (detected) ext = MIME_TO_EXT[detected];
      }
      if (!ext) {
        console.warn(`md-bookify: could not determine image type for ${item.src}`);
        continue;
      }
      const filename = `${randomUUID()}.${ext}`;
      const filePath = join(tempDir, filename);
      await writeFile(filePath, data);
      const fileUrl = pathToFileURL(filePath).href;
      downloaded.set(item.src, fileUrl);
      const replacement = `<img${item.before}src=${item.quote}${fileUrl}${item.quote}${item.after}>`;
      replacements.push({ start: item.start, end: item.end, replacement });
    } catch (err) {
      console.warn(
        `md-bookify: could not fetch image ${item.src}: ${err instanceof Error ? err.message : err}`
      );
    }
  }
  if (replacements.length === 0) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {
    });
    return { html, tempDir: null };
  }
  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return { html: result, tempDir };
}
async function generateEpub(html, options) {
  const { css, body, title: extractedTitle } = extractStyleAndBody(html);
  let processedBody = options?.basePath ? await embedLocalImages(body, options.basePath) : body;
  const { html: fetchedBody, tempDir } = await fetchRemoteImages(processedBody);
  processedBody = fetchedBody;
  processedBody = insertWordBreaks(processedBody);
  const title = options?.title ?? extractedTitle ?? "Document";
  const author = options?.author ?? "Unknown";
  const language = options?.language ?? "en";
  try {
    return await packageEpub({
      title,
      author,
      language,
      publisher: options?.publisher,
      description: options?.description,
      cover: options?.cover,
      css,
      content: processedBody
    });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {
      });
    }
  }
}
async function generateEpubToFile(html, outputPath, options) {
  const buffer = await generateEpub(html, options);
  await writeFile(outputPath, buffer);
}

// src/index.ts
async function convertMdToPdf(inputPath, options) {
  const html = await parseMarkdownFile(inputPath);
  const filename = basename(inputPath, inputPath.endsWith(".markdown") ? ".markdown" : ".md");
  const title = options?.title ?? filename;
  const fullHtml = wrapHtml(html, { title, style: options?.style });
  const outputPath = options?.output ?? join(dirname(inputPath), `${filename}.pdf`);
  await generatePdfToFile(fullHtml, outputPath, {
    format: options?.format,
    landscape: options?.landscape,
    margin: options?.margin,
    author: options?.author,
    basePath: resolve(dirname(inputPath))
  });
  return outputPath;
}
async function convertMarkdownToPdfBuffer(markdown, options) {
  const html = parseMarkdown(markdown);
  const title = options?.title ?? "Document";
  const fullHtml = wrapHtml(html, { title, style: options?.style });
  return generatePdf(fullHtml, {
    format: options?.format,
    landscape: options?.landscape,
    margin: options?.margin,
    author: options?.author
  });
}
async function convertMdToEpub(inputPath, options) {
  const html = await parseMarkdownFile(inputPath, { mathOutput: "mathml" });
  const filename = basename(inputPath, inputPath.endsWith(".markdown") ? ".markdown" : ".md");
  const title = options?.title ?? filename;
  const fullHtml = wrapHtmlForEpub(html, { title });
  const outputPath = options?.output ?? join(dirname(inputPath), `${filename}.epub`);
  await generateEpubToFile(fullHtml, outputPath, {
    title,
    author: options?.author,
    language: options?.language,
    publisher: options?.publisher,
    description: options?.description,
    cover: options?.cover,
    basePath: resolve(dirname(inputPath))
  });
  return outputPath;
}
async function convertMarkdownToEpubBuffer(markdown, options) {
  const html = parseMarkdown(markdown, { mathOutput: "mathml" });
  const title = options?.title ?? "Document";
  const fullHtml = wrapHtmlForEpub(html, { title });
  return generateEpub(fullHtml, {
    title,
    author: options?.author,
    language: options?.language,
    publisher: options?.publisher,
    description: options?.description,
    cover: options?.cover
  });
}

// src/mcp-server.ts
function getVersion() {
  try {
    return "2.2.1";
  } catch {
    return "0.0.0-dev";
  }
}
function resolvePath(p) {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}
async function ensureDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}
async function fileSize(filePath) {
  const s = await stat(filePath);
  return s.size;
}
var server = new McpServer({
  name: "md-bookify",
  version: getVersion()
});
server.tool(
  "convert_markdown_to_pdf",
  "Convert a markdown string to a PDF file on disk. Supports GitHub Flavored Markdown (tables, task lists, strikethrough), Prism.js syntax highlighting (TypeScript, Python, Go, Rust, Java, and more), and KaTeX math ($inline$ and $$block$$). Use this when you have markdown content in memory. For converting an existing .md file, prefer convert_file_to_pdf which also resolves relative image paths. Available styles: default, serif, elegant, eink, eink-serif.",
  {
    markdown: z.string().describe("Full markdown content to convert. Supports GFM (tables, task lists), fenced code blocks with language tags for syntax highlighting, and KaTeX math ($inline$ and $$block$$)."),
    output_path: z.string().describe("Absolute or relative path for the output PDF file. Parent directories are created automatically."),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe("Author name for PDF metadata"),
    style: z.string().optional().describe("Built-in style name (default, eink, eink-serif, elegant, serif) or absolute path to a .css file. Styles only affect PDF output."),
    format: z.enum(["A4", "Letter", "Legal"]).optional().describe("Page format (default: A4). Use Letter for US standard, Legal for legal documents."),
    landscape: z.boolean().optional().describe("Use landscape orientation (good for wide tables or code)")
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  async ({ markdown, output_path, title, author, style, format, landscape }) => {
    try {
      const outputPath = resolvePath(output_path);
      await ensureDir(outputPath);
      const buffer = await convertMarkdownToPdfBuffer(markdown, {
        title,
        author,
        style,
        format,
        landscape
      });
      await writeFile(outputPath, buffer);
      return { content: [{ type: "text", text: `PDF saved to ${outputPath} (${buffer.length} bytes)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);
server.tool(
  "convert_markdown_to_pdf_buffer",
  "Convert a markdown string to PDF and return the result as base64-encoded data instead of writing to disk. Use this when you need the PDF content directly (e.g., to pass to another tool or embed in a response) rather than saving to a file. Supports the same markdown features as convert_markdown_to_pdf. For large documents, prefer convert_markdown_to_pdf to write directly to disk.",
  {
    markdown: z.string().describe("Full markdown content to convert. Supports GFM, syntax highlighting, and KaTeX math."),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe("Author name for PDF metadata"),
    style: z.string().optional().describe("Built-in style name (default, eink, eink-serif, elegant, serif) or path to a .css file."),
    format: z.enum(["A4", "Letter", "Legal"]).optional().describe("Page format (default: A4). Use Letter for US standard, Legal for legal documents."),
    landscape: z.boolean().optional().describe("Use landscape orientation")
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  async ({ markdown, title, author, style, format, landscape }) => {
    try {
      const buffer = await convertMarkdownToPdfBuffer(markdown, {
        title,
        author,
        style,
        format,
        landscape
      });
      return {
        content: [{
          type: "resource",
          resource: {
            uri: `data:application/pdf;base64,${buffer.toString("base64")}`,
            mimeType: "application/pdf",
            blob: buffer.toString("base64")
          }
        }]
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);
server.tool(
  "convert_markdown_to_epub",
  "Convert a markdown string to an EPUB ebook file on disk. Math is rendered as MathML for broad e-reader compatibility. EPUB output uses a built-in e-reader-friendly stylesheet \u2014 the style parameter is not available for EPUB. Use this when generating EPUB from a string. For converting an existing .md file with relative images, prefer convert_file_to_epub.",
  {
    markdown: z.string().describe("Full markdown content to convert. Supports GFM (tables, task lists), fenced code blocks with syntax highlighting, and KaTeX math (rendered as MathML)."),
    output_path: z.string().describe("Absolute or relative path for the output EPUB file. Parent directories are created automatically."),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe("Author name for EPUB metadata"),
    language: z.string().optional().describe('Language code, e.g. "en" (default: "en")'),
    publisher: z.string().optional().describe("Publisher name for EPUB metadata"),
    description: z.string().optional().describe("Book description for EPUB metadata")
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  async ({ markdown, output_path, title, author, language, publisher, description }) => {
    try {
      const outputPath = resolvePath(output_path);
      await ensureDir(outputPath);
      const buffer = await convertMarkdownToEpubBuffer(markdown, {
        title,
        author,
        language,
        publisher,
        description
      });
      await writeFile(outputPath, buffer);
      return { content: [{ type: "text", text: `EPUB saved to ${outputPath} (${buffer.length} bytes)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);
server.tool(
  "convert_file_to_pdf",
  "Convert a .md or .markdown file on disk to PDF. This is the preferred tool when the markdown file already exists, because it automatically resolves relative image paths (e.g., ![](./images/photo.png)) from the source file's directory. If output_path is omitted, the PDF is written alongside the source file with a .pdf extension. Available styles: default, serif, elegant, eink, eink-serif.",
  {
    input_path: z.string().describe("Path to the input .md or .markdown file"),
    output_path: z.string().optional().describe("Path for the output PDF (default: same name with .pdf extension)"),
    title: z.string().optional().describe("Document title (default: filename)"),
    author: z.string().optional().describe("Author name for PDF metadata"),
    style: z.string().optional().describe("Built-in style name (default, eink, eink-serif, elegant, serif) or absolute path to a .css file. Styles only affect PDF output."),
    format: z.enum(["A4", "Letter", "Legal"]).optional().describe("Page format (default: A4). Use Letter for US standard, Legal for legal documents."),
    landscape: z.boolean().optional().describe("Use landscape orientation (good for wide tables or code)")
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  async ({ input_path, output_path, title, author, style, format, landscape }) => {
    try {
      const inputPath = resolvePath(input_path);
      const result = await convertMdToPdf(inputPath, {
        output: output_path ? resolvePath(output_path) : void 0,
        title,
        author,
        style,
        format,
        landscape
      });
      const size = await fileSize(result);
      return { content: [{ type: "text", text: `PDF saved to ${result} (${size} bytes)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);
server.tool(
  "convert_file_to_epub",
  "Convert a .md or .markdown file on disk to an EPUB ebook. This is the preferred tool when the markdown file already exists, because it automatically resolves relative image paths from the source file's directory. If output_path is omitted, the EPUB is written alongside the source file with an .epub extension. Supports optional cover image. Math is rendered as MathML for e-reader compatibility.",
  {
    input_path: z.string().describe("Path to the input .md or .markdown file"),
    output_path: z.string().optional().describe("Path for the output EPUB (default: same name with .epub extension)"),
    title: z.string().optional().describe("Document title (default: filename)"),
    author: z.string().optional().describe("Author name for EPUB metadata"),
    language: z.string().optional().describe('Language code, e.g. "en" (default: "en")'),
    publisher: z.string().optional().describe("Publisher name for EPUB metadata"),
    description: z.string().optional().describe("Book description for EPUB metadata"),
    cover: z.string().optional().describe("Path to cover image file (JPG or PNG recommended)")
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  async ({ input_path, output_path, title, author, language, publisher, description, cover }) => {
    try {
      const inputPath = resolvePath(input_path);
      const result = await convertMdToEpub(inputPath, {
        output: output_path ? resolvePath(output_path) : void 0,
        title,
        author,
        language,
        publisher,
        description,
        cover: cover ? resolvePath(cover) : void 0
      });
      const size = await fileSize(result);
      return { content: [{ type: "text", text: `EPUB saved to ${result} (${size} bytes)` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);
server.tool(
  "list_styles",
  "List available built-in PDF styles. Returns: default (clean sans-serif), serif, elegant, eink, eink-serif. Styles only apply to PDF output \u2014 EPUB uses its own e-reader-friendly stylesheet. You can also pass a path to any .css file as a custom style.",
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  },
  async () => {
    try {
      const styles = getBuiltInStyles();
      return { content: [{ type: "text", text: `Available styles: ${styles.join(", ")}` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }
);
var transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=mcp-server.js.map
//# sourceMappingURL=mcp-server.js.map