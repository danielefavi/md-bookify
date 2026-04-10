import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import JSZip from 'jszip';
import { packageEpub, detectMimeFromBytes, MIME_TO_EXT } from '../src/epub-packager.js';

const RED_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/** Helper: call packageEpub with defaults and return the unzipped archive. */
async function packAndUnzip(
  overrides: Partial<Parameters<typeof packageEpub>[0]> = {},
) {
  const buf = await packageEpub({
    title: 'Test Book',
    author: 'Test Author',
    language: 'en',
    css: 'body { color: black; }',
    content: '<p>Hello world</p>',
    ...overrides,
  });
  return JSZip.loadAsync(buf);
}

/** Read a text file from a JSZip instance. */
function readZipText(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) throw new Error(`Missing ZIP entry: ${path}`);
  return file.async('string');
}

// -------------------------------------------------------------------------
// ZIP structure
// -------------------------------------------------------------------------

describe('packageEpub ZIP structure', () => {
  it('produces a buffer with ZIP magic bytes', async () => {
    const buf = await packageEpub({
      title: 'T',
      author: 'A',
      language: 'en',
      css: '',
      content: '<p>x</p>',
    });
    expect(buf.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('contains mimetype as first entry with correct content', async () => {
    const zip = await packAndUnzip();
    const mimetype = await readZipText(zip, 'mimetype');
    expect(mimetype).toBe('application/epub+zip');
  });

  it('contains META-INF/container.xml pointing to content.opf', async () => {
    const zip = await packAndUnzip();
    const container = await readZipText(zip, 'META-INF/container.xml');
    expect(container).toContain('full-path="OEBPS/content.opf"');
    expect(container).toContain('application/oebps-package+xml');
  });

  it('contains all required OEBPS entries', async () => {
    const zip = await packAndUnzip();
    expect(zip.file('OEBPS/content.opf')).not.toBeNull();
    expect(zip.file('OEBPS/toc.ncx')).not.toBeNull();
    expect(zip.file('OEBPS/toc.xhtml')).not.toBeNull();
    expect(zip.file('OEBPS/chapter_0.xhtml')).not.toBeNull();
    expect(zip.file('OEBPS/style.css')).not.toBeNull();
  });

  it('writes the CSS into OEBPS/style.css', async () => {
    const zip = await packAndUnzip({ css: 'h1 { font-size: 2em; }' });
    const css = await readZipText(zip, 'OEBPS/style.css');
    expect(css).toBe('h1 { font-size: 2em; }');
  });

  it('writes empty string when css is empty', async () => {
    const zip = await packAndUnzip({ css: '' });
    const css = await readZipText(zip, 'OEBPS/style.css');
    expect(css).toBe('');
  });
});

// -------------------------------------------------------------------------
// content.opf (generateContentOpf)
// -------------------------------------------------------------------------

describe('content.opf structure', () => {
  it('starts with XML prologue and EPUB3 package element', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(opf).toContain('xmlns="http://www.idpf.org/2007/opf"');
    expect(opf).toContain('version="3.0"');
    expect(opf).toContain('unique-identifier="BookId"');
  });

  it('includes dc:identifier with UUID', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toMatch(/<dc:identifier id="BookId">urn:uuid:[0-9a-f-]{36}<\/dc:identifier>/);
  });

  it('includes title, language, and author', async () => {
    const zip = await packAndUnzip({
      title: 'My Book',
      author: 'Jane Doe',
      language: 'fr',
    });
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('<dc:title>My Book</dc:title>');
    expect(opf).toContain('<dc:language>fr</dc:language>');
    expect(opf).toContain('<dc:creator>Jane Doe</dc:creator>');
  });

  it('includes dcterms:modified meta', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toMatch(/<meta property="dcterms:modified">\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z<\/meta>/);
  });

  it('includes publisher and description when provided', async () => {
    const zip = await packAndUnzip({
      publisher: 'Acme Press',
      description: 'A test book',
    });
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('<dc:publisher>Acme Press</dc:publisher>');
    expect(opf).toContain('<dc:description>A test book</dc:description>');
  });

  it('omits publisher and description when not provided', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).not.toContain('<dc:publisher');
    expect(opf).not.toContain('<dc:description');
  });

  it('creates multiple dc:creator elements for multiple authors', async () => {
    const zip = await packAndUnzip({
      author: ['Alice', 'Bob', 'Charlie'],
    });
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('<dc:creator>Alice</dc:creator>');
    expect(opf).toContain('<dc:creator>Bob</dc:creator>');
    expect(opf).toContain('<dc:creator>Charlie</dc:creator>');
  });

  it('manifest includes ncx, nav, style, and chapter items', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('id="ncx"');
    expect(opf).toContain('href="toc.ncx"');
    expect(opf).toContain('id="nav"');
    expect(opf).toContain('href="toc.xhtml"');
    expect(opf).toContain('properties="nav"');
    expect(opf).toContain('id="style"');
    expect(opf).toContain('href="style.css"');
    expect(opf).toContain('id="chapter_0"');
    expect(opf).toContain('href="chapter_0.xhtml"');
  });

  it('spine references chapter_0 with ncx toc', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('<spine toc="ncx">');
    expect(opf).toContain('<itemref idref="chapter_0"/>');
  });
});

// -------------------------------------------------------------------------
// toc.ncx (generateTocNcx)
// -------------------------------------------------------------------------

describe('toc.ncx structure', () => {
  it('starts with XML prologue and NCX namespace', async () => {
    const zip = await packAndUnzip();
    const ncx = await readZipText(zip, 'OEBPS/toc.ncx');
    expect(ncx).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(ncx).toContain('xmlns="http://www.daisy.org/z3986/2005/ncx/"');
  });

  it('includes UUID, generator, and depth meta', async () => {
    const zip = await packAndUnzip();
    const ncx = await readZipText(zip, 'OEBPS/toc.ncx');
    expect(ncx).toMatch(/<meta name="dtb:uid" content="urn:uuid:[0-9a-f-]{36}"\/>/);
    expect(ncx).toContain('<meta name="dtb:generator" content="md-bookify"/>');
    expect(ncx).toContain('<meta name="dtb:depth" content="1"/>');
  });

  it('includes docTitle and docAuthor', async () => {
    const zip = await packAndUnzip({ title: 'NCX Book', author: 'NCX Author' });
    const ncx = await readZipText(zip, 'OEBPS/toc.ncx');
    expect(ncx).toContain('<docTitle><text>NCX Book</text></docTitle>');
    expect(ncx).toContain('<docAuthor><text>NCX Author</text></docAuthor>');
  });

  it('joins multiple authors with comma in docAuthor', async () => {
    const zip = await packAndUnzip({ author: ['Alice', 'Bob'] });
    const ncx = await readZipText(zip, 'OEBPS/toc.ncx');
    expect(ncx).toContain('<docAuthor><text>Alice, Bob</text></docAuthor>');
  });

  it('includes navMap with navPoint linking to chapter_0.xhtml', async () => {
    const zip = await packAndUnzip({ title: 'Nav Test' });
    const ncx = await readZipText(zip, 'OEBPS/toc.ncx');
    expect(ncx).toContain('<navPoint id="chapter_0" playOrder="1" class="chapter">');
    expect(ncx).toContain('<navLabel><text>Nav Test</text></navLabel>');
    expect(ncx).toContain('<content src="chapter_0.xhtml"/>');
  });
});

// -------------------------------------------------------------------------
// toc.xhtml (generateTocXhtml)
// -------------------------------------------------------------------------

describe('toc.xhtml structure', () => {
  it('is valid XHTML with epub namespace and language attributes', async () => {
    const zip = await packAndUnzip({ language: 'de' });
    const toc = await readZipText(zip, 'OEBPS/toc.xhtml');
    expect(toc).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(toc).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(toc).toContain('xmlns:epub="http://www.idpf.org/2007/ops"');
    expect(toc).toContain('xml:lang="de"');
    expect(toc).toContain('lang="de"');
  });

  it('contains nav with epub:type="toc"', async () => {
    const zip = await packAndUnzip();
    const toc = await readZipText(zip, 'OEBPS/toc.xhtml');
    expect(toc).toContain('<nav id="toc" epub:type="toc">');
  });

  it('links to chapter_0.xhtml with the book title', async () => {
    const zip = await packAndUnzip({ title: 'TOC Link Test' });
    const toc = await readZipText(zip, 'OEBPS/toc.xhtml');
    expect(toc).toContain('<a href="chapter_0.xhtml">TOC Link Test</a>');
  });
});

// -------------------------------------------------------------------------
// chapter_0.xhtml (generateChapterXhtml)
// -------------------------------------------------------------------------

describe('chapter_0.xhtml structure', () => {
  it('is valid XHTML with language attributes', async () => {
    const zip = await packAndUnzip({ language: 'es' });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(chapter).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(chapter).toContain('xml:lang="es"');
    expect(chapter).toContain('lang="es"');
  });

  it('links to style.css stylesheet', async () => {
    const zip = await packAndUnzip();
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('<link rel="stylesheet" type="text/css" href="style.css"/>');
  });

  it('includes the content in the body', async () => {
    const zip = await packAndUnzip({ content: '<h1>My Chapter</h1><p>Paragraph text.</p>' });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('<h1>My Chapter</h1>');
    expect(chapter).toContain('<p>Paragraph text.</p>');
  });

  it('sets the title in <title> tag', async () => {
    const zip = await packAndUnzip({ title: 'Chapter Title' });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('<title>Chapter Title</title>');
  });
});

// -------------------------------------------------------------------------
// escapeXml — tested through metadata fields
// -------------------------------------------------------------------------

describe('XML escaping in metadata', () => {
  it('escapes & < > " \' in the title across all XML files', async () => {
    const title = 'Tom & Jerry <"friends"> & \'enemies\'';
    const zip = await packAndUnzip({ title });

    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain(
      '<dc:title>Tom &amp; Jerry &lt;&quot;friends&quot;&gt; &amp; &apos;enemies&apos;</dc:title>',
    );

    const ncx = await readZipText(zip, 'OEBPS/toc.ncx');
    expect(ncx).toContain('Tom &amp; Jerry &lt;&quot;friends&quot;&gt; &amp; &apos;enemies&apos;');

    const toc = await readZipText(zip, 'OEBPS/toc.xhtml');
    expect(toc).toContain('Tom &amp; Jerry &lt;&quot;friends&quot;&gt; &amp; &apos;enemies&apos;');

    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain(
      '<title>Tom &amp; Jerry &lt;&quot;friends&quot;&gt; &amp; &apos;enemies&apos;</title>',
    );
  });

  it('escapes special chars in author name', async () => {
    const zip = await packAndUnzip({ author: 'O\'Brien & "Mac"' });
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('<dc:creator>O&apos;Brien &amp; &quot;Mac&quot;</dc:creator>');
  });

  it('escapes special chars in publisher', async () => {
    const zip = await packAndUnzip({ publisher: 'A & B <Publishing>' });
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain(
      '<dc:publisher>A &amp; B &lt;Publishing&gt;</dc:publisher>',
    );
  });

  it('escapes special chars in description', async () => {
    const zip = await packAndUnzip({ description: 'x > y & z < w' });
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain(
      '<dc:description>x &gt; y &amp; z &lt; w</dc:description>',
    );
  });

  it('escapes special chars in language in toc.xhtml attributes', async () => {
    const zip = await packAndUnzip({ language: 'en&test' });
    const toc = await readZipText(zip, 'OEBPS/toc.xhtml');
    expect(toc).toContain('xml:lang="en&amp;test"');
    expect(toc).toContain('lang="en&amp;test"');
  });
});

// -------------------------------------------------------------------------
// sanitizeForXhtml — boolean attribute normalisation
// -------------------------------------------------------------------------

describe('XHTML boolean attribute sanitisation', () => {
  it('converts <details open> to <details open="open">', async () => {
    const zip = await packAndUnzip({
      content: '<details open><summary>S</summary><p>C</p></details>',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('open="open"');
    expect(chapter).not.toMatch(/<details\s+open[\s>](?!.*=)/);
  });

  it('converts multiple boolean attrs in one tag', async () => {
    const zip = await packAndUnzip({
      content: '<input checked disabled required readonly />',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('checked="checked"');
    expect(chapter).toContain('disabled="disabled"');
    expect(chapter).toContain('required="required"');
    expect(chapter).toContain('readonly="readonly"');
  });

  it('leaves already-valid attr="attr" unchanged', async () => {
    const zip = await packAndUnzip({
      content: '<details open="open"><summary>S</summary></details>',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('open="open"');
    expect(chapter).not.toContain('open="open"="open"');
  });

  it('handles hidden, muted, loop, autoplay attrs', async () => {
    const zip = await packAndUnzip({
      content: '<div hidden><video autoplay muted loop></video></div>',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('hidden="hidden"');
    expect(chapter).toContain('autoplay="autoplay"');
    expect(chapter).toContain('muted="muted"');
    expect(chapter).toContain('loop="loop"');
  });

  it('does not affect non-boolean attributes', async () => {
    const zip = await packAndUnzip({
      content: '<a href="link" class="btn">click</a>',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('href="link"');
    expect(chapter).toContain('class="btn"');
  });

  it('does not break text content that happens to contain boolean attr names', async () => {
    const zip = await packAndUnzip({
      content: '<p>The input is checked and disabled by default</p>',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('The input is checked and disabled by default');
  });
});

// -------------------------------------------------------------------------
// Cover image
// -------------------------------------------------------------------------

describe('cover image handling', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-cover-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('embeds a local PNG cover into the EPUB', async () => {
    const coverPath = join(tmpDir, 'cover.png');
    await writeFile(coverPath, Buffer.from(RED_PNG_BASE64, 'base64'));

    const zip = await packAndUnzip({ cover: coverPath });

    // Cover file exists in ZIP
    const coverFile = zip.file('OEBPS/cover.png');
    expect(coverFile).not.toBeNull();

    // OPF has cover manifest item and meta
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('id="image_cover"');
    expect(opf).toContain('href="cover.png"');
    expect(opf).toContain('media-type="image/png"');
    expect(opf).toContain('<meta name="cover" content="image_cover"/>');
  });

  it('does not include cover entries when no cover is provided', async () => {
    const zip = await packAndUnzip();
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).not.toContain('image_cover');
    expect(opf).not.toContain('<meta name="cover"');

    const coverFiles = Object.keys(zip.files).filter((f) => f.includes('cover'));
    expect(coverFiles.length).toBe(0);
  });
});

// -------------------------------------------------------------------------
// Image embedding via file:// URLs in content
// -------------------------------------------------------------------------

describe('image embedding in content', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-img-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('embeds a file:// image into OEBPS/images/ and adds manifest entry', async () => {
    const imgPath = join(tmpDir, 'test.png');
    await writeFile(imgPath, Buffer.from(RED_PNG_BASE64, 'base64'));

    const { pathToFileURL } = await import('node:url');
    const fileUrl = pathToFileURL(imgPath).href;

    const zip = await packAndUnzip({
      content: `<p><img src="${fileUrl}" alt="test" /></p>`,
    });

    // Image file in ZIP
    const imageFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith('OEBPS/images/') && !f.endsWith('/'),
    );
    expect(imageFiles.length).toBe(1);
    expect(imageFiles[0]).toMatch(/\.png$/);

    // Manifest references the image
    const opf = await readZipText(zip, 'OEBPS/content.opf');
    expect(opf).toContain('media-type="image/png"');

    // Chapter XHTML references the embedded path
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toMatch(/src="images\/[^"]+\.png"/);
    expect(chapter).not.toContain('file://');
  });

  it('deduplicates the same file:// URL used twice', async () => {
    const imgPath = join(tmpDir, 'dup.png');
    await writeFile(imgPath, Buffer.from(RED_PNG_BASE64, 'base64'));

    const { pathToFileURL } = await import('node:url');
    const fileUrl = pathToFileURL(imgPath).href;

    const zip = await packAndUnzip({
      content: `<img src="${fileUrl}" /><img src="${fileUrl}" />`,
    });

    const imageFiles = Object.keys(zip.files).filter(
      (f) => f.startsWith('OEBPS/images/') && !f.endsWith('/'),
    );
    expect(imageFiles.length).toBe(1);
  });

  it('leaves data: URIs and fragment refs untouched', async () => {
    const zip = await packAndUnzip({
      content: '<img src="data:image/png;base64,abc" /><img src="#ref" />',
    });
    const chapter = await readZipText(zip, 'OEBPS/chapter_0.xhtml');
    expect(chapter).toContain('src="data:image/png;base64,abc"');
    expect(chapter).toContain('src="#ref"');
  });
});

// -------------------------------------------------------------------------
// MIME_TO_EXT constant
// -------------------------------------------------------------------------

describe('MIME_TO_EXT', () => {
  it('maps common image MIME types to extensions', () => {
    expect(MIME_TO_EXT['image/png']).toBe('png');
    expect(MIME_TO_EXT['image/jpeg']).toBe('jpg');
    expect(MIME_TO_EXT['image/gif']).toBe('gif');
    expect(MIME_TO_EXT['image/svg+xml']).toBe('svg');
    expect(MIME_TO_EXT['image/webp']).toBe('webp');
    expect(MIME_TO_EXT['image/bmp']).toBe('bmp');
    expect(MIME_TO_EXT['image/tiff']).toBe('tiff');
    expect(MIME_TO_EXT['image/avif']).toBe('avif');
  });
});

// -------------------------------------------------------------------------
// detectMimeFromBytes — BMP (not tested in epub.test.ts)
// -------------------------------------------------------------------------

describe('detectMimeFromBytes additional cases', () => {
  it('detects BMP from magic bytes', () => {
    const bmp = Buffer.from([0x42, 0x4d, 0x00, 0x00]);
    expect(detectMimeFromBytes(bmp)).toBe('image/bmp');
  });

  it('returns null for a buffer shorter than 4 bytes', () => {
    expect(detectMimeFromBytes(Buffer.from([0x89, 0x50]))).toBeNull();
  });
});
