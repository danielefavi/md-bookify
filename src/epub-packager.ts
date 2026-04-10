import { readFile } from 'node:fs/promises';
import { isAbsolute, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import JSZip from 'jszip';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EpubPackagerOptions {
  title: string;
  author: string | string[];
  language: string;
  publisher?: string;
  description?: string;
  cover?: string; // file path or URL to cover image
  css: string;
  content: string; // HTML body fragment (single chapter)
}

// ---------------------------------------------------------------------------
// MIME helpers (moved here from epub.ts to avoid circular deps)
// ---------------------------------------------------------------------------

export const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
};

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime]),
);
// jpeg is an alias for jpg
EXT_TO_MIME['jpeg'] = 'image/jpeg';
EXT_TO_MIME['tif'] = 'image/tiff';

/**
 * Detect image MIME type from file magic bytes.
 */
export function detectMimeFromBytes(data: Buffer): string | null {
  if (data.length < 4) return null;
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) return 'image/gif';
  if (
    data.length >= 12 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50
  ) return 'image/webp';
  if (data[0] === 0x42 && data[1] === 0x4d) return 'image/bmp';
  const head = data.subarray(0, Math.min(1000, data.length)).toString('utf-8');
  if (head.includes('<svg')) return 'image/svg+xml';
  return null;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// HTML → XHTML sanitisation
// ---------------------------------------------------------------------------

/** HTML boolean attributes that must be written as `attr="attr"` in XHTML. */
const BOOLEAN_ATTRS = [
  'allowfullscreen', 'async', 'autofocus', 'autoplay', 'checked', 'compact',
  'controls', 'declare', 'default', 'defer', 'disabled', 'formnovalidate',
  'hidden', 'ismap', 'loop', 'multiple', 'muted', 'noresize', 'noshade',
  'novalidate', 'nowrap', 'open', 'readonly', 'required', 'reversed',
  'selected',
];

const BOOLEAN_ATTR_RE = new RegExp(
  `(\\s)(${BOOLEAN_ATTRS.join('|')})(?=\\s|/?>)(?!\\s*=)`,
  'gi',
);

/**
 * Convert HTML boolean attributes to XHTML-valid form.
 *
 * In HTML5, `<details open>` is valid. In XHTML (used by EPUB), boolean
 * attributes must have a value: `<details open="open">`. E-readers with
 * strict XML parsers reject the valueless form as malformed XML, reporting
 * the file as "damaged".
 */
function sanitizeForXhtml(html: string): string {
  return html.replace(/<[a-zA-Z][^>]*>/g, (tag) =>
    tag.replace(BOOLEAN_ATTR_RE, (_, ws, attr) => `${ws}${attr.toLowerCase()}="${attr.toLowerCase()}"`),
  );
}

// ---------------------------------------------------------------------------
// Image handling
// ---------------------------------------------------------------------------

interface ImageEntry {
  id: string;
  extension: string;
  mediaType: string;
  data: Buffer;
}

const IMG_SRC_RE = /<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi;

function mimeFromExtension(filepath: string): string | null {
  const ext = extname(filepath).slice(1).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

async function readImageUrl(src: string): Promise<Buffer | null> {
  try {
    const data = await readFile(new URL(src));
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  } catch (err) {
    console.warn(`md-bookify: could not read image ${src}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function fetchImageUrl(src: string): Promise<{ data: Buffer; contentType: string | null } | null> {
  try {
    const response = await fetch(src, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      console.warn(`md-bookify: could not fetch image ${src}: HTTP ${response.status}`);
      return null;
    }
    const data = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? null;
    return { data, contentType };
  } catch (err) {
    console.warn(`md-bookify: could not fetch image ${src}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

function detectMime(data: Buffer, src: string, contentType?: string | null): string | null {
  // Try content-type header first
  if (contentType && MIME_TO_EXT[contentType]) return contentType;
  // Try magic bytes
  const detected = detectMimeFromBytes(data);
  if (detected) return detected;
  // Try file extension
  return mimeFromExtension(src);
}

async function extractAndEmbedImages(
  html: string,
): Promise<{ html: string; images: ImageEntry[] }> {
  const images: ImageEntry[] = [];
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];
  // Track already-embedded URLs to deduplicate
  const urlToPath = new Map<string, string>();

  IMG_SRC_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
    const fullMatch = match[0];
    const before = match[1] ?? '';
    const quote = match[2] ?? '"';
    const src = match[3] ?? '';
    const after = match[4] ?? '';

    // Skip data URIs and fragment refs
    if (!src || src.startsWith('data:') || src.startsWith('#')) continue;

    // Check dedup cache
    const cached = urlToPath.get(src);
    if (cached) {
      const replacement = `<img${before}src=${quote}${cached}${quote}${after}>`;
      replacements.push({ start: match.index, end: match.index + fullMatch.length, replacement });
      continue;
    }

    let data: Buffer | null = null;
    let contentType: string | null = null;

    if (src.startsWith('file://')) {
      data = await readImageUrl(src);
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      const result = await fetchImageUrl(src);
      if (result) {
        data = result.data;
        contentType = result.contentType;
      }
    } else if (isAbsolute(src)) {
      // Absolute local path without file:// scheme
      data = await readImageUrl(pathToFileURL(src).href);
    } else {
      // Relative path or other — leave untouched
      continue;
    }

    if (!data) continue;

    const mime = detectMime(data, src, contentType);
    if (!mime) {
      console.warn(`md-bookify: could not determine image type for ${src}`);
      continue;
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
    const r = replacements[i]!;
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return { html: result, images };
}

async function loadCoverImage(
  cover: string,
): Promise<{ data: Buffer; mediaType: string; extension: string } | null> {
  let data: Buffer | null = null;
  let contentType: string | null = null;

  if (cover.startsWith('http://') || cover.startsWith('https://')) {
    const result = await fetchImageUrl(cover);
    if (!result) return null;
    data = result.data;
    contentType = result.contentType;
  } else {
    // Local file path or file:// URL
    const url = cover.startsWith('file://') ? cover : pathToFileURL(cover).href;
    data = await readImageUrl(url);
  }

  if (!data) return null;

  const mime = detectMime(data, cover, contentType);
  if (!mime) {
    console.warn(`md-bookify: could not determine cover image type for ${cover}`);
    return null;
  }

  const ext = MIME_TO_EXT[mime];
  if (!ext) return null;

  return { data, mediaType: mime, extension: ext };
}

// ---------------------------------------------------------------------------
// EPUB3 XML templates
// ---------------------------------------------------------------------------

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

interface OpfData {
  uuid: string;
  title: string;
  authors: string[];
  language: string;
  publisher?: string;
  description?: string;
  modified: string; // ISO datetime
  images: ImageEntry[];
  cover?: { mediaType: string; extension: string };
}

function generateContentOpf(d: OpfData): string {
  const creators = d.authors
    .map((a) => `    <dc:creator>${escapeXml(a)}</dc:creator>`)
    .join('\n');

  const imageManifest = d.images
    .map((img) => `    <item id="image_${img.id}" href="images/${img.id}.${img.extension}" media-type="${img.mediaType}"/>`)
    .join('\n');

  const coverItem = d.cover
    ? `\n    <item id="image_cover" href="cover.${d.cover.extension}" media-type="${d.cover.mediaType}"/>`
    : '';

  const coverMeta = d.cover
    ? `\n    <meta name="cover" content="image_cover"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${d.uuid}</dc:identifier>
    <dc:title>${escapeXml(d.title)}</dc:title>
    <dc:language>${escapeXml(d.language)}</dc:language>
${creators}${d.publisher ? `\n    <dc:publisher>${escapeXml(d.publisher)}</dc:publisher>` : ''}${d.description ? `\n    <dc:description>${escapeXml(d.description)}</dc:description>` : ''}
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

function generateTocNcx(uuid: string, title: string, author: string): string {
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

function generateTocXhtml(title: string, language: string): string {
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

function generateChapterXhtml(
  title: string,
  language: string,
  content: string,
): string {
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

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function packageEpub(options: EpubPackagerOptions): Promise<Buffer> {
  const uuid = randomUUID();
  const authors = Array.isArray(options.author) ? options.author : [options.author];
  const authorString = authors.join(', ');
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Extract and embed images from the chapter content
  const { html: rawContent, images } = await extractAndEmbedImages(options.content);

  // Normalise HTML boolean attributes to valid XHTML (e.g. `open` → `open="open"`)
  const processedContent = sanitizeForXhtml(rawContent);

  // Load cover image if provided
  let coverData: { data: Buffer; mediaType: string; extension: string } | null = null;
  if (options.cover) {
    coverData = await loadCoverImage(options.cover);
  }

  // Generate XML files
  const contentOpf = generateContentOpf({
    uuid,
    title: options.title,
    authors,
    language: options.language,
    publisher: options.publisher,
    description: options.description,
    modified,
    images,
    cover: coverData ? { mediaType: coverData.mediaType, extension: coverData.extension } : undefined,
  });

  const tocNcx = generateTocNcx(uuid, options.title, authorString);
  const tocXhtml = generateTocXhtml(options.title, options.language);
  const chapterXhtml = generateChapterXhtml(options.title, options.language, processedContent);

  // Assemble ZIP
  const zip = new JSZip();

  // mimetype MUST be first, uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // META-INF
  zip.file('META-INF/container.xml', CONTAINER_XML);

  // OEBPS content
  zip.file('OEBPS/content.opf', contentOpf);
  zip.file('OEBPS/toc.ncx', tocNcx);
  zip.file('OEBPS/toc.xhtml', tocXhtml);
  zip.file('OEBPS/chapter_0.xhtml', chapterXhtml);
  zip.file('OEBPS/style.css', options.css || '');

  // Cover image
  if (coverData) {
    zip.file(`OEBPS/cover.${coverData.extension}`, coverData.data);
  }

  // Embedded images
  for (const img of images) {
    zip.file(`OEBPS/images/${img.id}.${img.extension}`, img.data);
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return buffer;
}
