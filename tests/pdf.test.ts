import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument } from 'pdf-lib';

describe('generatePdf (unit, mocked puppeteer)', () => {
  let realPdfBuffer: Buffer;
  const mockPdf = vi.fn();
  const mockSetContent = vi.fn().mockResolvedValue(undefined);
  const mockNewPage = vi.fn().mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf });
  const mockClose = vi.fn().mockResolvedValue(undefined);
  const mockLaunch = vi.fn().mockResolvedValue({ newPage: mockNewPage, close: mockClose });

  beforeEach(async () => {
    vi.resetModules();
    vi.resetAllMocks();
    const doc = await PDFDocument.create();
    doc.addPage();
    realPdfBuffer = Buffer.from(await doc.save());
    mockPdf.mockResolvedValue(realPdfBuffer);
    mockSetContent.mockResolvedValue(undefined);
    mockNewPage.mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf });
    mockClose.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
    vi.doMock('puppeteer', () => ({ default: { launch: mockLaunch } }));
  });

  afterEach(() => {
    vi.doUnmock('puppeteer');
  });

  it('calls page.setContent with provided HTML', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>');
    expect(mockSetContent).toHaveBeenCalledWith('<p>test</p>', expect.any(Object));
  });

  it('uses format A4 by default', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>');
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'A4' }));
  });

  it('passes custom format option', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>', { format: 'Letter' });
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'Letter' }));
  });

  it('uses 20mm default margins', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>');
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
    }));
  });

  it('passes custom margins', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    const margin = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' };
    await generatePdf('<p>test</p>', { margin });
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ margin }));
  });

  it('enables printBackground by default', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>');
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ printBackground: true }));
  });

  it('closes browser even when page.pdf throws', async () => {
    mockPdf.mockRejectedValue(new Error('pdf failed'));
    mockNewPage.mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf });
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
    const { generatePdf } = await import('../src/pdf.js');
    await expect(generatePdf('<p>test</p>')).rejects.toThrow('pdf failed');
    expect(mockClose).toHaveBeenCalled();
  });

  it('uses page.goto instead of setContent when basePath is provided', async () => {
    const mockGoto = vi.fn().mockResolvedValue(undefined);
    mockNewPage.mockResolvedValue({ goto: mockGoto, setContent: mockSetContent, pdf: mockPdf });
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<html><head></head><body>test</body></html>', { basePath: '/tmp/test-dir' });
    expect(mockGoto).toHaveBeenCalledWith(expect.stringMatching(/^file:\/\//), expect.any(Object));
    expect(mockSetContent).not.toHaveBeenCalled();
  });

  it('defaults landscape to false', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>');
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ landscape: false }));
  });

  it('passes landscape: true option', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>', { landscape: true });
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ landscape: true }));
  });

  it('passes partial margin object as-is without filling defaults', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    const margin = { top: '10mm' } as any;
    await generatePdf('<p>test</p>', { margin });
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ margin: { top: '10mm' } }));
  });

  it('uses page.setContent when basePath is not provided', async () => {
    const mockGoto = vi.fn().mockResolvedValue(undefined);
    mockNewPage.mockResolvedValue({ goto: mockGoto, setContent: mockSetContent, pdf: mockPdf });
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
    const { generatePdf } = await import('../src/pdf.js');
    await generatePdf('<p>test</p>');
    expect(mockSetContent).toHaveBeenCalled();
    expect(mockGoto).not.toHaveBeenCalled();
  });

  it('defaults Author and Creator metadata to "Unknown"', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    const buffer = await generatePdf('<p>test</p>');
    const doc = await PDFDocument.load(buffer);
    expect(doc.getAuthor()).toBe('Unknown');
    expect(doc.getCreator()).toBe('Unknown');
  });

  it('sets Author and Creator metadata from author option', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    const buffer = await generatePdf('<p>test</p>', { author: 'Jane Doe' });
    const doc = await PDFDocument.load(buffer);
    expect(doc.getAuthor()).toBe('Jane Doe');
    expect(doc.getCreator()).toBe('Jane Doe');
  });
});

describe('generatePdf (integration, real puppeteer)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-pdf-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('generates a buffer starting with %PDF-', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    const buffer = await generatePdf('<html><body><p>Hello</p></body></html>');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('generatePdfToFile writes a valid PDF file', async () => {
    const { generatePdfToFile } = await import('../src/pdf.js');
    const outPath = join(tmpDir, 'out.pdf');
    await generatePdfToFile('<html><body><p>Hello</p></body></html>', outPath);
    const content = await readFile(outPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('produces a PDF with Author and Creator set to "Unknown" by default', async () => {
    const { generatePdf } = await import('../src/pdf.js');
    const buffer = await generatePdf('<html><body><p>Hello</p></body></html>');
    const doc = await PDFDocument.load(buffer);
    expect(doc.getAuthor()).toBe('Unknown');
    expect(doc.getCreator()).toBe('Unknown');
  }, 30000);

  it('resolves relative images when basePath is provided', async () => {
    // Create a 1x1 red PNG in the temp dir
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    await writeFile(join(tmpDir, 'img.png'), Buffer.from(pngBase64, 'base64'));

    const { generatePdf } = await import('../src/pdf.js');
    const html = '<html><head></head><body><img src="./img.png" /></body></html>';

    const withBase = await generatePdf(html, { basePath: tmpDir });
    const withoutBase = await generatePdf(html);

    // The PDF with basePath should be larger because the image was actually embedded
    expect(withBase.length).toBeGreaterThan(withoutBase.length);
  }, 30000);
});
