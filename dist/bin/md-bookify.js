#!/usr/bin/env node
import { Command } from 'commander';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { basename, join, dirname, resolve, extname, isAbsolute } from 'path';
import { readFile, writeFile, mkdtemp, rm, stat } from 'fs/promises';
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
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { EPub } from 'epub-gen-memory';

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
var STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
var TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
var BODY_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;
var IMG_SRC_RE = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi;
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
  IMG_SRC_RE.lastIndex = 0;
  let match;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
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
  IMG_SRC_RE.lastIndex = 0;
  let match;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
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
  const title = options?.title ?? extractedTitle ?? "Document";
  const author = options?.author ?? "Unknown";
  const language = options?.language ?? "en";
  try {
    const epub = new EPub(
      {
        title,
        author,
        lang: language,
        ...options?.publisher ? { publisher: options.publisher } : {},
        ...options?.description ? { description: options.description } : {},
        ...options?.cover ? { cover: options.cover } : {},
        ...css ? { css } : {},
        verbose: false
      },
      [{ title, content: processedBody }]
    );
    const buffer = await epub.genEpub();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
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

// bin/md-bookify.ts
function getVersion() {
  return "2.0.0";
}
var program = new Command();
program.enablePositionalOptions();
program.name("md-bookify").description("Convert Markdown files to styled PDF documents or EPUB ebooks").version(getVersion()).argument("[input]", "Markdown file to convert").option("-o, --output <path>", "Output PDF file path").option("-t, --title <title>", "Document title").option("--author <name>", "Author name").option("-f, --format <format>", "Page format (A4, Letter, Legal)", "A4").option("--landscape", "Use landscape orientation").option("--margin-top <margin>", "Top margin (e.g. 20mm)").option("--margin-right <margin>", "Right margin (e.g. 20mm)").option("--margin-bottom <margin>", "Bottom margin (e.g. 20mm)").option("--margin-left <margin>", "Left margin (e.g. 20mm)").option("-s, --style <name-or-path>", `Style name (${getBuiltInStyles().join(", ")}) or path to .css file`).option("-l, --list-styles", "List available styles").action(async (input, opts) => {
  try {
    if (opts.listStyles) {
      console.log("Available styles:\n");
      for (const style of getBuiltInStyles()) {
        console.log(`  ${style}`);
      }
      process.exit(0);
    }
    if (!input) {
      program.error("missing required argument: input");
      return;
    }
    const margin = opts.marginTop || opts.marginRight || opts.marginBottom || opts.marginLeft ? {
      top: opts.marginTop ?? "20mm",
      right: opts.marginRight ?? "20mm",
      bottom: opts.marginBottom ?? "20mm",
      left: opts.marginLeft ?? "20mm"
    } : void 0;
    const outputPath = await convertMdToPdf(input, {
      output: opts.output,
      title: opts.title,
      author: opts.author,
      style: opts.style,
      format: opts.format,
      landscape: opts.landscape,
      margin
    });
    console.log(`PDF saved to ${outputPath}`);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
});
program.command("epub").description("Convert a Markdown file to an EPUB ebook").argument("<input>", "Markdown file to convert").option("-o, --output <path>", "Output EPUB file path").option("-t, --title <title>", "Document title").option("--author <name>", "Author name").option("--language <code>", "Language code (e.g. en, fr)", "en").option("--publisher <name>", "Publisher metadata").option("--description <text>", "Description metadata").option("--cover <path>", "Path to cover image").action(async (input, opts) => {
  try {
    const outputPath = await convertMdToEpub(input, {
      output: opts.output,
      title: opts.title,
      author: opts.author,
      language: opts.language,
      publisher: opts.publisher,
      description: opts.description,
      cover: opts.cover
    });
    console.log(`EPUB saved to ${outputPath}`);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
});
program.parse();
//# sourceMappingURL=md-bookify.js.map
//# sourceMappingURL=md-bookify.js.map