import { basename, dirname, join, resolve } from 'node:path';
import { parseMarkdown, parseMarkdownFile } from './parser.js';
import { wrapHtml } from './template.js';
import { wrapHtmlForEpub } from './epub-template.js';
import { generatePdf, generatePdfToFile } from './pdf.js';
import { generateEpub, generateEpubToFile } from './epub.js';
import type { PdfOptions } from './pdf.js';

export { parseMarkdown, parseMarkdownFile } from './parser.js';
export { wrapHtml } from './template.js';
export { wrapHtmlForEpub } from './epub-template.js';
export { generatePdf, generatePdfToFile } from './pdf.js';
export { generateEpub, generateEpubToFile } from './epub.js';
export { extractStyleAndBody, embedLocalImages, fetchRemoteImages, detectMimeFromBytes, insertWordBreaks } from './epub.js';
export type { PdfOptions } from './pdf.js';
export type { EpubOptions } from './epub.js';
export type { ParseOptions, MathOutput } from './parser.js';
export type { WrapHtmlOptions } from './template.js';
export type { WrapEpubHtmlOptions } from './epub-template.js';

export interface ConvertOptions {
  output?: string;
  title?: string;
  style?: string;
  format?: PdfOptions['format'];
  landscape?: boolean;
  margin?: PdfOptions['margin'];
  author?: string;
  noSandbox?: boolean;
}

export async function convertMdToPdf(inputPath: string, options?: ConvertOptions): Promise<string> {
  const html = await parseMarkdownFile(inputPath);
  const filename = basename(inputPath, inputPath.endsWith('.markdown') ? '.markdown' : '.md');
  const title = options?.title ?? filename;
  const fullHtml = wrapHtml(html, { title, style: options?.style });
  const outputPath = options?.output ?? join(dirname(inputPath), `${filename}.pdf`);
  await generatePdfToFile(fullHtml, outputPath, {
    format: options?.format,
    landscape: options?.landscape,
    margin: options?.margin,
    author: options?.author,
    noSandbox: options?.noSandbox,
    basePath: resolve(dirname(inputPath)),
  });
  return outputPath;
}

export async function convertMarkdownToPdfBuffer(markdown: string, options?: ConvertOptions): Promise<Buffer> {
  const html = parseMarkdown(markdown);
  const title = options?.title ?? 'Document';
  const fullHtml = wrapHtml(html, { title, style: options?.style });
  return generatePdf(fullHtml, {
    format: options?.format,
    landscape: options?.landscape,
    margin: options?.margin,
    author: options?.author,
    noSandbox: options?.noSandbox,
  });
}

export interface ConvertEpubOptions {
  output?: string;
  title?: string;
  author?: string | string[];
  language?: string;
  publisher?: string;
  description?: string;
  cover?: string;
}

export async function convertMdToEpub(inputPath: string, options?: ConvertEpubOptions): Promise<string> {
  const html = await parseMarkdownFile(inputPath, { mathOutput: 'mathml' });
  const filename = basename(inputPath, inputPath.endsWith('.markdown') ? '.markdown' : '.md');
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
    basePath: resolve(dirname(inputPath)),
  });
  return outputPath;
}

export async function convertMarkdownToEpubBuffer(markdown: string, options?: ConvertEpubOptions): Promise<Buffer> {
  const html = parseMarkdown(markdown, { mathOutput: 'mathml' });
  const title = options?.title ?? 'Document';
  const fullHtml = wrapHtmlForEpub(html, { title });
  return generateEpub(fullHtml, {
    title,
    author: options?.author,
    language: options?.language,
    publisher: options?.publisher,
    description: options?.description,
    cover: options?.cover,
  });
}
