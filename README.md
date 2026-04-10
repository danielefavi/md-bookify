# md-bookify

[![npm version](https://img.shields.io/npm/v/md-bookify)](https://www.npmjs.com/package/md-bookify)
[![CI](https://github.com/danielefavi/md-bookify/actions/workflows/ci.yml/badge.svg)](https://github.com/danielefavi/md-bookify/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A fast Node.js **MCP server and CLI tool** to convert **Markdown to PDF** or **EPUB ebooks** — with Prism syntax highlighting, KaTeX math rendering, and GitHub Flavored Markdown (GFM) support. Also usable as a programmatic Node.js library.

**Built for AI agents** — works out of the box with Claude Code, Claude Desktop, Cursor, Windsurf, and any [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) client. Give your LLM or AI coding assistant the ability to generate styled PDFs and EPUB ebooks from Markdown. See the [Technical Reference for AI Agents](#technical-reference-for-ai-agents) section for structured integration details.

## Install

```bash
# Global install — makes md-bookify available everywhere
npm install -g md-bookify

# Or as a project dependency
npm install md-bookify
```

Requires Node.js >= 20. Puppeteer downloads a bundled Chromium automatically.

## Quick Start

```bash
# Convert a Markdown file to PDF (outputs document.pdf alongside the source)
md-bookify document.md

# Custom output path and title
md-bookify notes.md -o ~/Desktop/notes.pdf -t "Meeting Notes"

# US Letter, landscape orientation
md-bookify report.md -f Letter --landscape

# Custom margins
md-bookify slides.md --margin-top 10mm --margin-bottom 10mm --margin-left 10mm --margin-right 10mm

# Use a built-in style or your own CSS
md-bookify notes.md -s serif
md-bookify notes.md -s elegant
md-bookify notes.md -s ./custom-theme.css

# Convert to EPUB instead of PDF
md-bookify epub document.md
md-bookify epub book.md -o ~/Books/book.epub --author "Jane Doe" --cover ./cover.jpg
```

If installed locally (not globally), prefix commands with `npx`:

```bash
npx md-bookify document.md
```

### As an MCP Server (AI Agent Tool)

Add to your Claude Code, Claude Desktop, Cursor, Windsurf, or any MCP-compatible AI assistant config:

```json
{
  "mcpServers": {
    "md-bookify": {
      "command": "npx",
      "args": ["-y", "md-bookify-mcp"]
    }
  }
}
```

Then ask your AI agent to convert Markdown to PDF or EPUB — it will have access to 6 document generation tools. See [MCP Server](#mcp-server-ai-agent-integration) for full details.

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output PDF path | `<input>.pdf` |
| `-t, --title <title>` | PDF metadata title | Filename |
| `-f, --format <format>` | `A4`, `Letter`, or `Legal` | `A4` |
| `-s, --style <name\|path>` | Built-in style name or path to `.css` file | `default` |
| `--landscape` | Landscape orientation | `false` |
| `--margin-top <margin>` | Top margin (CSS units) | `20mm` |
| `--margin-right <margin>` | Right margin (CSS units) | `20mm` |
| `--margin-bottom <margin>` | Bottom margin (CSS units) | `20mm` |
| `--margin-left <margin>` | Left margin (CSS units) | `20mm` |
| `--author <name>` | Author metadata | `Unknown` |
| `-l, --list-styles` | List available built-in styles | |

### EPUB subcommand

`md-bookify epub <input>` converts a Markdown file to an EPUB ebook. EPUB output uses a slim, e-reader-friendly stylesheet (it does not honor `--style`, `--format`, `--landscape`, or `--margin-*`) and renders math as MathML for better support on e-readers.

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output EPUB path | `<input>.epub` |
| `-t, --title <title>` | EPUB title | Filename |
| `--author <name>` | Author metadata | `Unknown` |
| `--language <code>` | Language code (e.g. `en`, `fr`) | `en` |
| `--publisher <name>` | Publisher metadata | |
| `--description <text>` | Description metadata | |
| `--cover <path>` | Path to a cover image file | |

## Built-in Styles

| Style | Description |
|-------|-------------|
| `default` | Clean sans-serif theme (used when no style is specified) |
| `serif` | Serif font theme |
| `elegant` | Elegant typography |
| `eink` | Optimized for e-ink screens |
| `eink-serif` | Serif font optimized for e-ink screens |

```bash
md-bookify report.md -s serif
md-bookify report.md -s eink
md-bookify report.md -s ./my-theme.css
```

## Features

- **MCP server for AI agents** — 6 tools for Markdown-to-PDF and Markdown-to-EPUB conversion, compatible with Claude Code, Claude Desktop, Cursor, Windsurf, and any MCP client. Lets LLMs and AI coding assistants generate documents as part of agentic workflows
- **GitHub Flavored Markdown** — tables, task lists, fenced code blocks, autolinks, strikethrough
- **Syntax highlighting** — Prism.js with Dracula theme for PDF / a light theme for EPUB. Supports TypeScript, JavaScript, Python, Go, Rust, Java, Bash, JSON, CSS, HTML/XML, YAML, SQL, and Diff
- **Math** — inline (`$E = mc^2$`) and display (`$$...$$`) via KaTeX. PDFs use KaTeX HTML rendering; EPUBs use MathML for better e-reader compatibility
- **Images** — relative paths resolved from the source file's directory. PDFs embed via Chromium's local file resolution. EPUBs rewrite local images to `file://` URLs (epub-gen-memory packages them as separate manifest entries). Remote images without file extensions are fetched and type-detected via magic bytes
- **EPUB output** — slim e-reader-friendly stylesheet, MathML math, embedded images, customizable metadata (author, language, publisher, description, cover)

## Programmatic API

Each step of the conversion pipeline is independently importable:

```typescript
import {
  // PDF
  convertMdToPdf,                // file path → PDF file (end-to-end)
  convertMarkdownToPdfBuffer,    // markdown string → PDF buffer
  generatePdf,                   // full HTML → PDF buffer
  generatePdfToFile,             // full HTML → PDF file
  wrapHtml,                      // HTML fragment → full HTML document with styles
  // EPUB
  convertMdToEpub,               // file path → EPUB file
  convertMarkdownToEpubBuffer,   // markdown string → EPUB buffer
  generateEpub,                  // full HTML → EPUB buffer
  generateEpubToFile,            // full HTML → EPUB file
  wrapHtmlForEpub,               // HTML fragment → minimal HTML document for EPUB
  // Shared
  parseMarkdown,                 // markdown string → HTML string
  parseMarkdownFile,             // file path → HTML string
  // Image & HTML helpers
  extractStyleAndBody,           // full HTML → { css, body, title }
  embedLocalImages,              // rewrite local img src to file:// URLs
  fetchRemoteImages,             // fetch remote images lacking extensions, save with correct ext
  detectMimeFromBytes,           // detect image MIME from magic bytes
} from 'md-bookify';
```

### End-to-end conversion

```typescript
// File to PDF file — returns the output path
const outputPath = await convertMdToPdf('README.md', {
  output: 'readme.pdf',
  format: 'A4',
  style: 'serif',
});

// String to PDF buffer — useful for HTTP responses or streaming
const buffer = await convertMarkdownToPdfBuffer('# Hello\n\nWorld.', {
  title: 'My Doc',
  format: 'Letter',
  landscape: true,
});

// Markdown file to EPUB file
const epubPath = await convertMdToEpub('book.md', {
  output: 'book.epub',
  title: 'My Book',
  author: 'Jane Doe',
  language: 'en',
  cover: './cover.jpg',
});

// Markdown string to EPUB buffer
const epubBuffer = await convertMarkdownToEpubBuffer('# Chapter 1\n\nText.', {
  title: 'Sample',
  author: 'Anonymous',
});
```

### Step-by-step usage

```typescript
// 1. Parse Markdown to HTML
const html = parseMarkdown('# Hello\n\nSome **bold** text.');

// 2. Wrap in a full HTML document with styles
const doc = wrapHtml(html, { title: 'My Doc', style: 'serif' });

// 3. Generate PDF
const buffer = await generatePdf(doc, { format: 'Letter', landscape: true });
// or write directly to file:
await generatePdfToFile(doc, 'output.pdf', { format: 'A4' });
```

## MCP Server (AI Agent Integration)

md-bookify includes a built-in [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI agents — Claude Code, Claude Desktop, Cursor, Windsurf, or any MCP-compatible LLM client — the ability to convert Markdown to PDF or EPUB as a tool. Use it to add document generation capabilities to your AI coding assistant or agentic workflow.

### Setup

#### Claude Code

Add to your project's `.mcp.json` or global `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "md-bookify": {
      "command": "npx",
      "args": ["-y", "md-bookify-mcp"]
    }
  }
}
```

#### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "md-bookify": {
      "command": "npx",
      "args": ["-y", "md-bookify-mcp"]
    }
  }
}
```

#### Local development

If you have the repo cloned locally:

```json
{
  "mcpServers": {
    "md-bookify": {
      "command": "node",
      "args": ["/path/to/md-bookify/dist/mcp-server.js"]
    }
  }
}
```

### Available Tools

Once configured, the MCP server exposes 6 tools:

#### `convert_markdown_to_pdf`

Converts a markdown string to a PDF file on disk.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown content to convert |
| `output_path` | string | yes | Path for the output PDF file |
| `title` | string | no | Document title (default: "Document") |
| `author` | string | no | Author name |
| `style` | string | no | Style: `default`, `eink`, `eink-serif`, `elegant`, `serif`, or path to `.css` file |
| `format` | string | no | Page format: `A4`, `Letter`, or `Legal` (default: `A4`) |
| `landscape` | boolean | no | Use landscape orientation |

#### `convert_markdown_to_pdf_buffer`

Converts a markdown string to PDF and returns the result as base64-encoded data instead of writing to disk. Useful when you need the PDF content directly (e.g., to pass to another tool or embed in a response). For large documents, prefer `convert_markdown_to_pdf` to write directly to disk.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown content to convert |
| `title` | string | no | Document title (default: "Document") |
| `author` | string | no | Author name |
| `style` | string | no | Style: `default`, `eink`, `eink-serif`, `elegant`, `serif`, or path to `.css` file |
| `format` | string | no | Page format: `A4`, `Letter`, or `Legal` (default: `A4`) |
| `landscape` | boolean | no | Use landscape orientation |

Returns an `EmbeddedResource` with `mimeType: "application/pdf"` and base64-encoded `blob`.

#### `convert_markdown_to_epub`

Converts a markdown string to an EPUB ebook file on disk. Math is rendered as MathML for e-reader compatibility.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `markdown` | string | yes | Markdown content to convert |
| `output_path` | string | yes | Path for the output EPUB file |
| `title` | string | no | Document title (default: "Document") |
| `author` | string | no | Author name |
| `language` | string | no | Language code, e.g. `en` (default: `en`) |
| `publisher` | string | no | Publisher name |
| `description` | string | no | Book description |

#### `convert_file_to_pdf`

Converts a markdown file on disk to PDF. Resolves relative image paths from the source file's directory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_path` | string | yes | Path to the input `.md` or `.markdown` file |
| `output_path` | string | no | Path for the output PDF (default: same name with `.pdf` extension) |
| `title` | string | no | Document title (default: filename) |
| `author` | string | no | Author name |
| `style` | string | no | Style name or path to `.css` file |
| `format` | string | no | Page format: `A4`, `Letter`, or `Legal` (default: `A4`) |
| `landscape` | boolean | no | Use landscape orientation |

#### `convert_file_to_epub`

Converts a markdown file on disk to an EPUB ebook. Resolves relative image paths from the source file's directory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input_path` | string | yes | Path to the input `.md` or `.markdown` file |
| `output_path` | string | no | Path for the output EPUB (default: same name with `.epub` extension) |
| `title` | string | no | Document title (default: filename) |
| `author` | string | no | Author name |
| `language` | string | no | Language code (default: `en`) |
| `publisher` | string | no | Publisher name |
| `description` | string | no | Book description |
| `cover` | string | no | Path to cover image file |

#### `list_styles`

Lists available built-in PDF styles. Takes no parameters.

### Tips

- **File-based tools vs string-based tools**: Use `convert_file_to_pdf` / `convert_file_to_epub` when the markdown already exists on disk — they resolve relative image paths automatically. Use the string-based tools (`convert_markdown_to_*`) when generating markdown content on the fly.
- **Output directories**: Parent directories are created automatically if they don't exist.
- **Relative paths**: Paths are resolved relative to the MCP server's working directory.

## Development

```bash
npm install
npm test             # run tests
npm run test:watch   # watch mode
npm run build        # production build
npm run dev          # build in watch mode
```

## License

MIT

---

<!-- AI-AGENT REFERENCE — structured technical specification below -->

## Technical Reference for AI Agents

> This section provides structured, precise technical details optimized for LLM and AI agent consumption. For human-readable docs, see sections above.

### Project Metadata

- **Package**: `md-bookify`
- **Module system**: ESM (`"type": "module"`)
- **Node.js**: >= 20
- **npm**: `npm install md-bookify`
- **License**: MIT
- **Entry point**: `dist/index.js`
- **Types**: `dist/index.d.ts`
- **CLI binary**: `dist/bin/md-bookify.js` (registered as `md-bookify`)
- **MCP server binary**: `dist/mcp-server.js` (registered as `md-bookify-mcp`)

### Conversion Pipeline

The tool converts Markdown through a forked pipeline — the parser is shared, but PDF and EPUB output use different wrappers and renderers:

```
Markdown string/file
  → [parseMarkdown / parseMarkdownFile] → HTML fragment
  ├─ [wrapHtml]          → Full HTML document (Prism Dracula + KaTeX HTML CSS)
  │     → [generatePdf]  → PDF buffer/file
  │
  └─ [wrapHtmlForEpub]   → Minimal HTML document (light Prism theme, no max-width)
        → [generateEpub] → EPUB buffer/file (ZIP with mimetype, OPF manifest, XHTML chapters)
```

For the EPUB path, `parseMarkdown` is invoked with `mathOutput: 'mathml'` so KaTeX emits MathML rather than HTML+CSS — better semantic rendering on e-readers.

Orchestrators that run the full pipeline:
- `convertMdToPdf(inputPath, options?)` — file → PDF file
- `convertMarkdownToPdfBuffer(markdown, options?)` — string → PDF buffer
- `convertMdToEpub(inputPath, options?)` — file → EPUB file
- `convertMarkdownToEpubBuffer(markdown, options?)` — string → EPUB buffer

### Exported Functions and Types

```typescript
// --- Parser (src/parser.ts) ---
function parseMarkdown(markdown: string, options?: ParseOptions): string
// Synchronous. Uses marked with async:false, GFM enabled by default.
// Applies Prism.js syntax highlighting via custom renderer.
// KaTeX math via marked-katex-extension.

function parseMarkdownFile(filePath: string, options?: ParseOptions): Promise<string>
// Reads file, validates extension (.md or .markdown), calls parseMarkdown.

interface ParseOptions {
  gfm?: boolean                       // default: true
  mathOutput?: 'html' | 'mathml'      // default: 'html'. Use 'mathml' for EPUB output.
}

// --- Template (src/template.ts) ---
function wrapHtml(contentHtml: string, options?: WrapHtmlOptions): string
// Wraps HTML fragment in <!DOCTYPE html> with:
//   - Base CSS or named/custom style CSS (via resolveStyleCss)
//   - Prism Dracula theme CSS
//   - KaTeX CSS (only if class="katex" found in content)

interface WrapHtmlOptions {
  title?: string   // default: "Document"
  style?: string   // "default" | "serif" | "elegant" | "eink" | "eink-serif" | path to .css file
}

// --- PDF Generation (src/pdf.ts) ---
function generatePdf(html: string, options?: PdfOptions): Promise<Buffer>
// Launches headless Chromium via Puppeteer.
// If basePath is set: writes HTML to temp file with <base href> for relative image resolution.
// Otherwise: uses page.setContent.
// Adds --no-sandbox flags when process.env.CI is set.

function generatePdfToFile(html: string, outputPath: string, options?: PdfOptions): Promise<void>
// Calls generatePdf, writes buffer to outputPath.

interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal'           // default: 'A4'
  landscape?: boolean                            // default: false
  margin?: { top?: string; right?: string; bottom?: string; left?: string }  // default: 20mm all
  printBackground?: boolean                      // default: true
  basePath?: string                              // directory for resolving relative image paths
  author?: string                                // default: 'Unknown'. Sets PDF Author + Creator via pdf-lib.
}

// --- EPUB template (src/epub-template.ts) ---
function wrapHtmlForEpub(contentHtml: string, options?: WrapEpubHtmlOptions): string
// Wraps HTML fragment in a minimal <!DOCTYPE html> doc with:
//   - EPUB_BASE_CSS (small reflow-friendly defaults — no max-width, no web fonts)
//   - PRISM_LIGHT_CSS (light syntax-highlighting theme suitable for e-ink)
// No KaTeX HTML CSS — math is expected to be rendered as MathML.

interface WrapEpubHtmlOptions {
  title?: string   // default: "Document"
}

// --- EPUB Generation (src/epub.ts) ---
function generateEpub(html: string, options?: EpubOptions): Promise<Buffer>
// Splits inline <style> blocks and <body> fragment from the input HTML, rewrites
// local <img src> to absolute file:// URLs (when basePath is set) so epub-gen-memory
// packages them as separate manifest entries. Fetches remote images lacking
// extensions, detects type via magic bytes, and saves to temp dir. Packages via epub-gen-memory.

function generateEpubToFile(html: string, outputPath: string, options?: EpubOptions): Promise<void>

// Helpers (also exported)
function extractStyleAndBody(html: string): { css: string; body: string; title?: string }
function embedLocalImages(html: string, basePath: string): Promise<string>
function fetchRemoteImages(html: string): Promise<{ html: string; tempDir: string | null }>
// Downloads remote images whose URLs lack a recognisable file extension,
// detects MIME via Content-Type header (magic-bytes fallback via detectMimeFromBytes),
// saves to temp dir with correct extension, rewrites <img src> to file:// URLs.
// Returns null tempDir when no images needed fetching.

function detectMimeFromBytes(data: Buffer): string | null
// Detects image MIME type from file magic bytes.
// Supports: PNG, JPEG, GIF, WebP, BMP, SVG. Returns null for unknown formats.

interface EpubOptions {
  title?: string                                 // default: extracted from <title> or "Document"
  author?: string | string[]                     // default: 'Unknown'
  language?: string                              // default: 'en'
  publisher?: string
  description?: string
  cover?: string                                 // path / URL / data URI
  basePath?: string                              // root for resolving relative <img src>
}

// --- Orchestrators (src/index.ts) ---
function convertMdToPdf(inputPath: string, options?: ConvertOptions): Promise<string>
// Returns the output file path.

function convertMarkdownToPdfBuffer(markdown: string, options?: ConvertOptions): Promise<Buffer>

interface ConvertOptions {
  output?: string                                // output path; default: <input>.pdf
  title?: string                                 // default: filename (convertMdToPdf) or "Document" (buffer)
  style?: string                                 // style name or .css path
  format?: 'A4' | 'Letter' | 'Legal'
  landscape?: boolean
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
  author?: string                                // default: 'Unknown'
}

function convertMdToEpub(inputPath: string, options?: ConvertEpubOptions): Promise<string>
// Parses with mathOutput='mathml', wraps via wrapHtmlForEpub, calls generateEpubToFile.
// Default output path: <input>.epub. basePath is set to the input file's directory.

function convertMarkdownToEpubBuffer(markdown: string, options?: ConvertEpubOptions): Promise<Buffer>

interface ConvertEpubOptions {
  output?: string                                // output path; default: <input>.epub
  title?: string                                 // default: filename or "Document"
  author?: string | string[]                     // default: 'Unknown'
  language?: string                              // default: 'en'
  publisher?: string
  description?: string
  cover?: string
}
```

### Styles System

- **Default style**: `src/styles/default.css` — loaded via `resolveStyleCss()` when no style is specified
- **Built-in styles**: `.css` files in `src/styles/` (copied to `dist/styles/` at build): `default`, `eink`, `eink-serif`, `elegant`, `serif`
- **Custom styles**: pass any `.css` file path
- **Resolution**: `resolveStyleCss(style?)` in `src/styles.ts` — returns CSS string, cached in a `Map` after first load
- **Prism theme**: Dracula, inlined as `PRISM_DRACULA_CSS` constant
- **KaTeX CSS**: loaded on-demand from `katex/dist/katex.min.css` via `createRequire`, only injected when `class="katex"` is detected in content

### Supported Syntax Highlighting Languages

TypeScript, JavaScript, Python, Go, Rust, Java, Bash, JSON, CSS, HTML/XML (markup), YAML, SQL, Diff. Unknown languages render as escaped plain monospace.

### File Structure

```
src/
  index.ts          — orchestrators + re-exports
  parser.ts         — Markdown → HTML (marked + Prism.js + KaTeX, html or mathml math)
  template.ts       — HTML fragment → full HTML document (PDF)
  epub-template.ts  — HTML fragment → minimal HTML document (EPUB)
  pdf.ts            — HTML → PDF (Puppeteer)
  epub.ts           — HTML → EPUB (epub-gen-memory) + local image file:// rewriting + remote image fetching
  styles.ts         — CSS constants, style resolution, KaTeX CSS loader
  styles/           — built-in .css theme files (PDF only)
  mcp-server.ts     — MCP server (6 tools: convert/list, with ToolAnnotations)
bin/
  md-bookify.ts     — CLI entry point (Commander, with `epub` subcommand)
tests/              — Vitest test files
```

### Build System

- **Bundler**: tsup (ESM only, target node18)
- **Entry points**: `src/index.ts` → `dist/index.js`, `bin/md-bookify.ts` → `dist/bin/md-bookify.js`, `src/mcp-server.ts` → `dist/mcp-server.js`
- **Post-build**: `cp -r src/styles dist/` (styles not handled by tsup)
- **TypeScript**: strict mode with `noUncheckedIndexedAccess`

### Dependencies

| Package | Role |
|---------|------|
| `marked` | Markdown parser (GFM) |
| `marked-katex-extension` | KaTeX math rendering in marked |
| `prismjs` | Syntax highlighting |
| `katex` | Math typesetting |
| `puppeteer` | Headless Chromium for PDF generation |
| `epub-gen-memory` | EPUB packaging (returns Buffer; uses jszip internally) |
| `pdf-lib` | PDF metadata (author, creator) post-processing |
| `commander` | CLI argument parsing |
| `@modelcontextprotocol/sdk` | MCP server for AI agent integration |
| `zod` | Schema validation for MCP tool inputs |

### CLI Invocation Pattern

```
md-bookify <input> [options]               # PDF output (default)
md-bookify epub <input> [options]          # EPUB output

Arguments:
  input                    Markdown file to convert (.md or .markdown)

PDF options (default command):
  -o, --output <path>      Output PDF file path (default: <input>.pdf)
  -t, --title <title>      Document title
  --author <name>          Author metadata (default: "Unknown")
  -f, --format <format>    Page format: A4 | Letter | Legal (default: A4)
  -s, --style <name|path>  Style: default | serif | elegant | eink | eink-serif | path/to/file.css
  --landscape              Landscape orientation
  --margin-top <margin>    Top margin, e.g. "20mm" (default: 20mm)
  --margin-right <margin>  Right margin (default: 20mm)
  --margin-bottom <margin> Bottom margin (default: 20mm)
  --margin-left <margin>   Left margin (default: 20mm)
  -l, --list-styles        List available built-in styles
  -V, --version            Output version number
  -h, --help               Display help

EPUB subcommand options (md-bookify epub <input>):
  -o, --output <path>      Output EPUB file path (default: <input>.epub)
  -t, --title <title>      Book title
  --author <name>          Author metadata (default: "Unknown")
  --language <code>        Language code (default: "en")
  --publisher <name>       Publisher metadata
  --description <text>     Description metadata
  --cover <path>           Path to cover image file
```

EPUB output uses an e-reader-friendly slim CSS and renders math as MathML; `--style`, `--format`, `--landscape`, and the margin flags are PDF-only.

### Common Integration Patterns

```typescript
// Generate PDF in an Express route
app.get('/pdf', async (req, res) => {
  const buffer = await convertMarkdownToPdfBuffer(markdownString, {
    format: 'A4',
    title: 'Report',
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.send(buffer);
});

// Batch convert multiple files
import { convertMdToPdf } from 'md-bookify';
const files = ['doc1.md', 'doc2.md', 'doc3.md'];
for (const file of files) {
  const output = await convertMdToPdf(file, { style: 'serif' });
  console.log(`Created: ${output}`);
}

// MCP server — configure in Claude Code, Claude Desktop, or any MCP client
// See the "MCP Server" section above for setup instructions
```
