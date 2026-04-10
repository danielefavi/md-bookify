import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { packageEpub, detectMimeFromBytes, MIME_TO_EXT } from './epub-packager.js';

export { detectMimeFromBytes } from './epub-packager.js';

export interface EpubOptions {
  title?: string;
  author?: string | string[];
  language?: string;
  publisher?: string;
  description?: string;
  cover?: string;
  basePath?: string;
}

interface SplitHtml {
  css: string;
  body: string;
  title?: string;
}

const STYLE_RE = /<style[^>]*>([\s\S]*?)<\/style>/gi;
const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const BODY_RE = /<body[^>]*>([\s\S]*?)<\/body>/i;
const IMG_SRC_RE = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi;

/** Image file extensions recognised by URL-based extension detection. */
const IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'tiff', 'tif', 'avif',
]);

function urlHasImageExtension(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    const dotIndex = pathname.lastIndexOf('.');
    if (dotIndex === -1) return false;
    const ext = pathname.slice(dotIndex + 1).toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

/**
 * Pull inline `<style>` blocks and the `<body>` contents out of a full HTML
 * document so they can be passed separately to an EPUB packager (which wants
 * the body fragment plus a single `css` string, not a full doc).
 */
export function extractStyleAndBody(html: string): SplitHtml {
  const cssChunks: string[] = [];
  let match: RegExpExecArray | null;
  STYLE_RE.lastIndex = 0;
  while ((match = STYLE_RE.exec(html)) !== null) {
    if (match[1]) cssChunks.push(match[1].trim());
  }
  const css = cssChunks.join('\n\n');

  const bodyMatch = html.match(BODY_RE);
  const body = bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : html;

  const titleMatch = html.match(TITLE_RE);
  const title = titleMatch && titleMatch[1] ? titleMatch[1].trim() : undefined;

  return { css, body, title };
}

/**
 * Walk the HTML for `<img src>` references that point at local files and
 * rewrite them to absolute `file://` URLs. the EPUB packager's image fetcher
 * reads `file://` URLs natively via `fs.readFile` and packages them as
 * separate manifest entries inside the EPUB ZIP — that's smaller and faster
 * than data URIs.
 *
 * Remote URLs (`http(s)://`), existing `data:` URIs, `file://` URLs, and
 * fragment refs (`#`) are left untouched. Missing files are warned about but
 * do not fail the conversion — the original `src` is preserved so the
 * e-reader can show its broken-image icon instead of the whole build aborting.
 */
export async function embedLocalImages(html: string, basePath: string): Promise<string> {
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  IMG_SRC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
    const fullMatch = match[0];
    const before = match[1] ?? '';
    const quote = match[2] ?? '"';
    const src = match[3] ?? '';
    const after = match[4] ?? '';

    if (
      !src ||
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('data:') ||
      src.startsWith('file://') ||
      src.startsWith('#')
    ) {
      continue;
    }

    const absolutePath = isAbsolute(src) ? src : resolve(basePath, src);

    try {
      await stat(absolutePath);
    } catch (err) {
      console.warn(
        `md-bookify: could not read image ${absolutePath}: ${err instanceof Error ? err.message : err}`,
      );
      continue;
    }

    const fileUrl = pathToFileURL(absolutePath).href;
    const replacement = `<img${before}src=${quote}${fileUrl}${quote}${after}>`;
    replacements.push({ start: match.index, end: match.index + fullMatch.length, replacement });
  }

  if (replacements.length === 0) return html;

  // Apply replacements in reverse so earlier indexes stay valid.
  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i]!;
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return result;
}

/**
 * Fetch remote images whose URLs lack a recognisable file extension.
 *
 * the EPUB packager determines each image's MIME type from the URL alone
 * (`mime.getType(url)`). When the URL has no extension (common with image
 * services like placehold.co, Unsplash, Gravatar, etc.), the type comes back
 * empty and the image is stored without an extension — EPUB readers then
 * cannot display it.
 *
 * This function downloads those images, detects their real type from the HTTP
 * `Content-Type` header (with a magic-bytes fallback), writes them to a temp
 * directory with the correct extension, and rewrites the `<img src>` to a
 * `file://` URL so the EPUB packager can pick up the type from the path.
 *
 * The caller **must** keep the returned `tempDir` alive until
 * `epub.genEpub()` has finished reading the files, then delete it.
 */
export async function fetchRemoteImages(
  html: string,
): Promise<{ html: string; tempDir: string | null }> {
  const candidates: Array<{
    start: number; end: number;
    before: string; quote: string; src: string; after: string;
    fullLength: number;
  }> = [];

  IMG_SRC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
    const src = match[3] ?? '';
    if (!src.startsWith('http://') && !src.startsWith('https://')) continue;
    if (urlHasImageExtension(src)) continue;

    candidates.push({
      start: match.index,
      end: match.index + match[0].length,
      before: match[1] ?? '',
      quote: match[2] ?? '"',
      src,
      after: match[4] ?? '',
      fullLength: match[0].length,
    });
  }

  if (candidates.length === 0) return { html, tempDir: null };

  const tempDir = await mkdtemp(join(tmpdir(), 'md-bookify-remote-'));
  const downloaded = new Map<string, string>(); // src → file:// URL
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  for (const item of candidates) {
    // Deduplicate: reuse previously downloaded file for the same URL.
    const cached = downloaded.get(item.src);
    if (cached) {
      const replacement = `<img${item.before}src=${item.quote}${cached}${item.quote}${item.after}>`;
      replacements.push({ start: item.start, end: item.end, replacement });
      continue;
    }

    try {
      const response = await fetch(item.src, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) {
        console.warn(`md-bookify: could not fetch image ${item.src}: HTTP ${response.status}`);
        continue;
      }

      const data = Buffer.from(await response.arrayBuffer());

      // Determine MIME → extension from Content-Type header, then magic bytes.
      const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
      let ext: string | undefined;
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
        `md-bookify: could not fetch image ${item.src}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  if (replacements.length === 0) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return { html, tempDir: null };
  }

  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i]!;
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return { html: result, tempDir };
}

/**
 * Generate an EPUB file as an in-memory Buffer.
 *
 * The input `html` is expected to be a full HTML document (e.g. produced by
 * `wrapHtmlForEpub`). We split out inline styles into the EPUB's CSS slot,
 * pull the `<body>` fragment as the chapter content, and embed any
 * locally-referenced images as data URIs (when `basePath` is provided).
 */
export async function generateEpub(html: string, options?: EpubOptions): Promise<Buffer> {
  const { css, body, title: extractedTitle } = extractStyleAndBody(html);

  let processedBody = options?.basePath
    ? await embedLocalImages(body, options.basePath)
    : body;

  // Pre-fetch remote images whose URLs lack a recognisable file extension so
  // that the EPUB packager can determine their MIME type from the local path.
  const { html: fetchedBody, tempDir } = await fetchRemoteImages(processedBody);
  processedBody = fetchedBody;

  const title = options?.title ?? extractedTitle ?? 'Document';
  const author = options?.author ?? 'Unknown';
  const language = options?.language ?? 'en';

  try {
    return await packageEpub({
      title,
      author,
      language,
      publisher: options?.publisher,
      description: options?.description,
      cover: options?.cover,
      css,
      content: processedBody,
    });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/**
 * Generate an EPUB and write it to disk. Thin wrapper around `generateEpub`.
 */
export async function generateEpubToFile(
  html: string,
  outputPath: string,
  options?: EpubOptions,
): Promise<void> {
  const buffer = await generateEpub(html, options);
  await writeFile(outputPath, buffer);
}
