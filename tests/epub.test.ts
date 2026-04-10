import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RED_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

describe('extractStyleAndBody', () => {
  it('pulls inline <style> blocks into a single css string', async () => {
    const { extractStyleAndBody } = await import('../src/epub.js');
    const html = `<!DOCTYPE html><html><head><style>body { color: red; }</style><style>p { margin: 0; }</style></head><body><p>Hi</p></body></html>`;
    const result = extractStyleAndBody(html);
    expect(result.css).toContain('body { color: red; }');
    expect(result.css).toContain('p { margin: 0; }');
  });

  it('extracts the body fragment without surrounding tags', async () => {
    const { extractStyleAndBody } = await import('../src/epub.js');
    const html = `<html><head></head><body><h1>Title</h1><p>Para</p></body></html>`;
    const result = extractStyleAndBody(html);
    expect(result.body).toBe('<h1>Title</h1><p>Para</p>');
  });

  it('extracts the document title from <title>', async () => {
    const { extractStyleAndBody } = await import('../src/epub.js');
    const html = `<html><head><title>My Book</title></head><body>Content</body></html>`;
    const result = extractStyleAndBody(html);
    expect(result.title).toBe('My Book');
  });

  it('returns the whole html as body when no <body> tag is present', async () => {
    const { extractStyleAndBody } = await import('../src/epub.js');
    const html = `<h1>raw fragment</h1>`;
    const result = extractStyleAndBody(html);
    expect(result.body).toBe(html);
  });

  it('returns empty css when there are no <style> blocks', async () => {
    const { extractStyleAndBody } = await import('../src/epub.js');
    const html = `<html><head></head><body><p>Hi</p></body></html>`;
    const result = extractStyleAndBody(html);
    expect(result.css).toBe('');
  });
});

describe('embedLocalImages', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-epub-img-'));
    await writeFile(join(tmpDir, 'pic.png'), Buffer.from(RED_PNG_BASE64, 'base64'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('rewrites a relative <img src> to an absolute file:// URL', async () => {
    const { embedLocalImages } = await import('../src/epub.js');
    const html = `<p><img src="./pic.png" alt="x" /></p>`;
    const result = await embedLocalImages(html, tmpDir);
    expect(result).toMatch(/src="file:\/\/.*pic\.png"/);
    expect(result).toContain('alt="x"');
    expect(result).not.toContain('./pic.png');
  });

  it('leaves http/https URLs untouched', async () => {
    const { embedLocalImages } = await import('../src/epub.js');
    const html = `<img src="https://example.com/img.png" />`;
    const result = await embedLocalImages(html, tmpDir);
    expect(result).toBe(html);
  });

  it('leaves data: URIs untouched', async () => {
    const { embedLocalImages } = await import('../src/epub.js');
    const html = `<img src="data:image/png;base64,abc" />`;
    const result = await embedLocalImages(html, tmpDir);
    expect(result).toBe(html);
  });

  it('warns and leaves the src untouched when the file cannot be read', async () => {
    const { embedLocalImages } = await import('../src/epub.js');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = `<img src="./missing.png" />`;
    const result = await embedLocalImages(html, tmpDir);
    expect(result).toContain('./missing.png');
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('rewrites multiple images in a single document', async () => {
    const { embedLocalImages } = await import('../src/epub.js');
    await writeFile(join(tmpDir, 'second.png'), Buffer.from(RED_PNG_BASE64, 'base64'));
    const html = `<p><img src="./pic.png" /></p><p><img src="./second.png" /></p>`;
    const result = await embedLocalImages(html, tmpDir);
    const matches = result.match(/file:\/\/[^"]+\.png/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

describe('generateEpub (unit)', () => {
  it('passes the body fragment (not the full HTML doc) as chapter content', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const html = `<html><head><title>T</title></head><body><h1>Chapter</h1></body></html>`;
    const buf = await generateEpub(html);
    const zip = await JSZip.loadAsync(buf);
    const chapterFiles = Object.keys(zip.files).filter((f) => f.includes('chapter'));
    expect(chapterFiles.length).toBeGreaterThan(0);
    const chapterContent = await zip.file(chapterFiles[0]!)!.async('string');
    expect(chapterContent).toContain('<h1>Chapter</h1>');
  });

  it('hoists inline <style> blocks into the EPUB CSS', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const html = `<html><head><style>body { color: red; }</style></head><body>x</body></html>`;
    const buf = await generateEpub(html);
    const zip = await JSZip.loadAsync(buf);
    const css = await zip.file('OEBPS/style.css')!.async('string');
    expect(css).toContain('body { color: red; }');
  });

  it('uses the <title> tag as default title when options.title is omitted', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const html = `<html><head><title>Extracted Title</title></head><body>x</body></html>`;
    const buf = await generateEpub(html);
    const zip = await JSZip.loadAsync(buf);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('Extracted Title');
  });

  it('options.title takes precedence over the extracted <title>', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const html = `<html><head><title>Extracted</title></head><body>x</body></html>`;
    const buf = await generateEpub(html, { title: 'Override' });
    const zip = await JSZip.loadAsync(buf);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:title>Override</dc:title>');
  });

  it('defaults author to "Unknown" when not supplied', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const buf = await generateEpub('<html><body>x</body></html>');
    const zip = await JSZip.loadAsync(buf);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:creator>Unknown</dc:creator>');
  });

  it('defaults language to "en" when not supplied', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const buf = await generateEpub('<html><body>x</body></html>');
    const zip = await JSZip.loadAsync(buf);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:language>en</dc:language>');
  });

  it('forwards publisher and description when supplied', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const buf = await generateEpub('<html><body>x</body></html>', {
      publisher: 'Acme',
      description: 'A book',
    });
    const zip = await JSZip.loadAsync(buf);
    const opf = await zip.file('OEBPS/content.opf')!.async('string');
    expect(opf).toContain('<dc:publisher>Acme</dc:publisher>');
    expect(opf).toContain('<dc:description>A book</dc:description>');
  });

  it('returns a Buffer (not a Uint8Array)', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const result = await generateEpub('<html><body>x</body></html>');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('embeds local images into the EPUB when basePath is provided', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'md-bookify-epub-unit-'));
    try {
      await writeFile(join(tmp, 'img.png'), Buffer.from(RED_PNG_BASE64, 'base64'));
      const { generateEpub } = await import('../src/epub.js');
      const JSZip = (await import('jszip')).default;
      const html = `<html><body><img src="./img.png" /></body></html>`;
      const buf = await generateEpub(html, { basePath: tmp });
      const zip = await JSZip.loadAsync(buf);
      const imageFiles = Object.keys(zip.files).filter((f) => f.startsWith('OEBPS/images/') && !f.endsWith('/'));
      expect(imageFiles.length).toBe(1);
      // The chapter content should reference the embedded image
      const chapterFiles = Object.keys(zip.files).filter((f) => f.includes('chapter'));
      const chapterContent = await zip.file(chapterFiles[0]!)!.async('string');
      expect(chapterContent).toMatch(/src="images\/[^"]+\.png"/);
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe('generateEpub (integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-epub-int-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('produces a buffer with ZIP magic bytes (PK\\x03\\x04)', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const buf = await generateEpub('<html><body><h1>Hi</h1></body></html>', {
      title: 'Test',
      author: 'Tester',
    });
    expect(buf.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('the produced ZIP contains an EPUB manifest and chapter XHTML', async () => {
    const { generateEpub } = await import('../src/epub.js');
    const JSZip = (await import('jszip')).default;
    const buf = await generateEpub(
      '<html><head><title>Book</title></head><body><h1>Hello</h1><p>Body text.</p></body></html>',
      { title: 'Book', author: 'Tester' },
    );
    const zip = await JSZip.loadAsync(buf);

    // EPUB-required entries
    expect(zip.file('mimetype')).not.toBeNull();
    expect(zip.file('META-INF/container.xml')).not.toBeNull();

    const mimetype = await zip.file('mimetype')!.async('string');
    expect(mimetype).toBe('application/epub+zip');

    // Look for any OPF (manifest) file
    const opfFiles = Object.keys(zip.files).filter((f) => f.endsWith('.opf'));
    expect(opfFiles.length).toBeGreaterThan(0);

    // Look for any chapter XHTML file
    const xhtmlFiles = Object.keys(zip.files).filter((f) => f.endsWith('.xhtml'));
    expect(xhtmlFiles.length).toBeGreaterThan(0);

    // Confirm the chapter content made it into one of the XHTML entries
    let foundContent = false;
    for (const path of xhtmlFiles) {
      const content = await zip.file(path)!.async('string');
      if (content.includes('Body text.')) {
        foundContent = true;
        break;
      }
    }
    expect(foundContent).toBe(true);
  });

  it('generateEpubToFile writes a valid .epub file to disk', async () => {
    const { generateEpubToFile } = await import('../src/epub.js');
    const outPath = join(tmpDir, 'book.epub');
    await generateEpubToFile('<html><body><h1>Hi</h1></body></html>', outPath, {
      title: 'Disk Book',
      author: 'Disk Author',
    });
    const file = await readFile(outPath);
    expect(file.subarray(0, 4).toString('hex')).toBe('504b0304');
  });
});

describe('detectMimeFromBytes', () => {
  it('detects PNG from magic bytes', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectMimeFromBytes(png)).toBe('image/png');
  });

  it('detects JPEG from magic bytes', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectMimeFromBytes(jpg)).toBe('image/jpeg');
  });

  it('detects GIF from magic bytes', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    const gif = Buffer.from('GIF89a', 'ascii');
    expect(detectMimeFromBytes(gif)).toBe('image/gif');
  });

  it('detects SVG from <svg tag', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
    expect(detectMimeFromBytes(svg)).toBe('image/svg+xml');
  });

  it('detects SVG with XML prologue', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    const svg = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectMimeFromBytes(svg)).toBe('image/svg+xml');
  });

  it('detects WebP from RIFF header', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    // RIFF....WEBP
    const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    expect(detectMimeFromBytes(webp)).toBe('image/webp');
  });

  it('returns null for unknown bytes', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    const unknown = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);
    expect(detectMimeFromBytes(unknown)).toBeNull();
  });

  it('returns null for empty buffer', async () => {
    const { detectMimeFromBytes } = await import('../src/epub.js');
    expect(detectMimeFromBytes(Buffer.alloc(0))).toBeNull();
  });
});

describe('fetchRemoteImages', () => {
  const originalFetch = globalThis.fetch;

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('leaves URLs with recognised extensions untouched', async () => {
    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="https://example.com/photo.png" alt="test" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);
    expect(result).toBe(html);
    expect(tempDir).toBeNull();
  });

  it('fetches extension-less URL and rewrites to file:// with correct ext', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/svg+xml' }),
      arrayBuffer: () => Promise.resolve(Buffer.from(svgContent)),
    } as unknown as Response);

    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="https://placehold.co/600x200/abc/fff" alt="placeholder" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);

    try {
      expect(result).toMatch(/src="file:\/\/.*\.svg"/);
      expect(result).toContain('alt="placeholder"');
      expect(result).not.toContain('placehold.co');
      expect(tempDir).not.toBeNull();
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('falls back to magic bytes when Content-Type is unhelpful', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/octet-stream' }),
      arrayBuffer: () => Promise.resolve(pngBytes),
    } as unknown as Response);

    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="https://api.example.com/avatar/123" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);

    try {
      expect(result).toMatch(/src="file:\/\/.*\.png"/);
      expect(tempDir).not.toBeNull();
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('handles fetch failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="https://broken.example.com/img" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);

    expect(result).toContain('broken.example.com/img');
    expect(warnSpy).toHaveBeenCalled();
    expect(tempDir).toBeNull();
    warnSpy.mockRestore();
  });

  it('handles HTTP 404 gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="https://example.com/missing" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);

    expect(result).toContain('example.com/missing');
    expect(warnSpy).toHaveBeenCalled();
    expect(tempDir).toBeNull();
    warnSpy.mockRestore();
  });

  it('deduplicates the same URL used multiple times', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/svg+xml' }),
      arrayBuffer: () => Promise.resolve(Buffer.from(svgContent)),
    } as unknown as Response);

    const { fetchRemoteImages } = await import('../src/epub.js');
    const url = 'https://placehold.co/100x100';
    const html = `<img src="${url}" /><img src="${url}" />`;
    const { html: result, tempDir } = await fetchRemoteImages(html);

    try {
      // Both should point to the same file
      const fileUrls = result.match(/file:\/\/[^"]+/g) ?? [];
      expect(fileUrls.length).toBe(2);
      expect(fileUrls[0]).toBe(fileUrls[1]);
      // fetch should only have been called once
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null tempDir when no remote images exist', async () => {
    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="./local.png" /><img src="data:image/png;base64,abc" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);
    expect(result).toBe(html);
    expect(tempDir).toBeNull();
  });

  it('only fetches extension-less URLs, leaves extension URLs untouched', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'image/svg+xml' }),
      arrayBuffer: () => Promise.resolve(Buffer.from(svgContent)),
    } as unknown as Response);

    const { fetchRemoteImages } = await import('../src/epub.js');
    const html = '<img src="https://example.com/photo.png" /><img src="https://placehold.co/100" />';
    const { html: result, tempDir } = await fetchRemoteImages(html);

    try {
      expect(result).toContain('https://example.com/photo.png');
      expect(result).not.toContain('placehold.co');
      expect(result).toMatch(/file:\/\/.*\.svg/);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    } finally {
      if (tempDir) await rm(tempDir, { recursive: true, force: true });
    }
  });
});
