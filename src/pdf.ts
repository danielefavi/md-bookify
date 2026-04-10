import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal';
  landscape?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  printBackground?: boolean;
  basePath?: string;
  author?: string;
}

const DEFAULT_MARGIN = { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' };

export async function generatePdf(html: string, options?: PdfOptions): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  let tempDir: string | undefined;
  try {
    const page = await browser.newPage();
    if (options?.basePath) {
      tempDir = await mkdtemp(join(tmpdir(), 'md-bookify-'));
      const tempHtmlPath = join(tempDir, 'index.html');
      const baseUrl = pathToFileURL(options.basePath + '/').href;
      html = html.replace('<head>', `<head>\n    <base href="${baseUrl}" />`);
      await writeFile(tempHtmlPath, html);
      await page.goto(pathToFileURL(tempHtmlPath).href, { waitUntil: 'networkidle0' });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle0' });
    }
    const pdfBuffer = await page.pdf({
      format: options?.format ?? 'A4',
      landscape: options?.landscape ?? false,
      margin: options?.margin ?? DEFAULT_MARGIN,
      printBackground: options?.printBackground ?? true,
    });
    const doc = await PDFDocument.load(pdfBuffer);
    const author = options?.author ?? 'Unknown';
    doc.setAuthor(author);
    doc.setCreator(author);
    return Buffer.from(await doc.save());
  } finally {
    await browser.close();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  }
}

export async function generatePdfToFile(html: string, outputPath: string, options?: PdfOptions): Promise<void> {
  const buffer = await generatePdf(html, options);
  await writeFile(outputPath, buffer);
}
