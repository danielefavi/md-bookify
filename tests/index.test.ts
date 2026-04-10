import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  convertMdToPdf,
  convertMarkdownToPdfBuffer,
  convertMdToEpub,
  convertMarkdownToEpubBuffer,
} from '../src/index.js';

describe('convertMdToPdf (integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-index-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('converts a .md file to PDF — output starts with %PDF-', async () => {
    const inputPath = join(tmpDir, 'test.md');
    await writeFile(inputPath, '# Hello\n\nSome **bold** text');
    const outputPath = await convertMdToPdf(inputPath);
    const content = await readFile(outputPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('default output path replaces .md with .pdf', async () => {
    const inputPath = join(tmpDir, 'input.md');
    await writeFile(inputPath, '# Test');
    const outputPath = await convertMdToPdf(inputPath);
    expect(outputPath).toBe(join(tmpDir, 'input.pdf'));
  }, 30000);

  it('respects custom output path', async () => {
    const inputPath = join(tmpDir, 'input.md');
    const customOut = join(tmpDir, 'custom.pdf');
    await writeFile(inputPath, '# Test');
    const outputPath = await convertMdToPdf(inputPath, { output: customOut });
    expect(outputPath).toBe(customOut);
    const content = await readFile(customOut);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('throws for non-existent input file', async () => {
    await expect(convertMdToPdf(join(tmpDir, 'nope.md'))).rejects.toThrow();
  }, 30000);

  it('embeds local images referenced in markdown', async () => {
    // Create a 1x1 red PNG
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    await writeFile(join(tmpDir, 'img.png'), Buffer.from(pngBase64, 'base64'));

    const inputPath = join(tmpDir, 'test.md');
    await writeFile(inputPath, '![alt](./img.png)');
    const outputPath = await convertMdToPdf(inputPath);
    const content = await readFile(outputPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
    // The PDF should contain an embedded image stream (XObject)
    expect(content.toString('binary')).toContain('/Image');
  }, 30000);

  it('default output path replaces .markdown with .pdf', async () => {
    const inputPath = join(tmpDir, 'notes.markdown');
    await writeFile(inputPath, '# Notes');
    const outputPath = await convertMdToPdf(inputPath);
    expect(outputPath).toBe(join(tmpDir, 'notes.pdf'));
    const content = await readFile(outputPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('passes style option through to PDF generation', async () => {
    const inputPath = join(tmpDir, 'styled.md');
    await writeFile(inputPath, '# Styled');
    const outputPath = await convertMdToPdf(inputPath, { style: 'elegant' });
    const content = await readFile(outputPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('convertMarkdownToPdfBuffer accepts style option', async () => {
    const buffer = await convertMarkdownToPdfBuffer('# Test', { style: 'eink' });
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);
});

describe('convertMdToEpub (integration)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-index-epub-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('converts a .md file to EPUB — output starts with PK ZIP magic', async () => {
    const inputPath = join(tmpDir, 'test.md');
    await writeFile(inputPath, '# Hello\n\nSome **bold** text');
    const outputPath = await convertMdToEpub(inputPath, { author: 'Tester' });
    const content = await readFile(outputPath);
    expect(content.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('default output path replaces .md with .epub', async () => {
    const inputPath = join(tmpDir, 'input.md');
    await writeFile(inputPath, '# Test');
    const outputPath = await convertMdToEpub(inputPath);
    expect(outputPath).toBe(join(tmpDir, 'input.epub'));
  });

  it('default output path replaces .markdown with .epub', async () => {
    const inputPath = join(tmpDir, 'notes.markdown');
    await writeFile(inputPath, '# Notes');
    const outputPath = await convertMdToEpub(inputPath);
    expect(outputPath).toBe(join(tmpDir, 'notes.epub'));
  });

  it('respects custom output path', async () => {
    const inputPath = join(tmpDir, 'input.md');
    const customOut = join(tmpDir, 'custom.epub');
    await writeFile(inputPath, '# Test');
    const outputPath = await convertMdToEpub(inputPath, { output: customOut });
    expect(outputPath).toBe(customOut);
    const content = await readFile(customOut);
    expect(content.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('throws for non-existent input file', async () => {
    await expect(convertMdToEpub(join(tmpDir, 'nope.md'))).rejects.toThrow();
  });

  it('embeds local images referenced in markdown as EPUB image entries', async () => {
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    await writeFile(join(tmpDir, 'img.png'), Buffer.from(pngBase64, 'base64'));

    const inputPath = join(tmpDir, 'test.md');
    await writeFile(inputPath, '![alt](./img.png)');
    const outputPath = await convertMdToEpub(inputPath);

    const JSZip = (await import('jszip')).default;
    const buf = await readFile(outputPath);
    const zip = await JSZip.loadAsync(buf);

    // epub-gen-memory packages local images into an `images/` directory
    // inside the EPUB OEBPS root. Verify at least one PNG entry exists.
    const imageEntries = Object.keys(zip.files).filter(
      (f) => f.includes('/images/') && f.endsWith('.png'),
    );
    expect(imageEntries.length).toBeGreaterThan(0);
  });

  it('convertMarkdownToEpubBuffer returns a buffer with ZIP magic', async () => {
    const buffer = await convertMarkdownToEpubBuffer('# Test', { author: 'Tester' });
    expect(buffer.subarray(0, 4).toString('hex')).toBe('504b0304');
  });
});
