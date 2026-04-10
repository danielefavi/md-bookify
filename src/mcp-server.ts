#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  convertMdToPdf,
  convertMdToEpub,
  convertMarkdownToPdfBuffer,
  convertMarkdownToEpubBuffer,
} from './index.js';
import { getBuiltInStyles } from './styles.js';

declare const PKG_VERSION: string;

function getVersion(): string {
  try {
    return PKG_VERSION;
  } catch {
    return '0.0.0-dev';
  }
}

function resolvePath(p: string): string {
  return isAbsolute(p) ? p : resolve(process.cwd(), p);
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

async function fileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

const server = new McpServer({
  name: 'md-bookify',
  version: getVersion(),
});

// --- convert_markdown_to_pdf ---

server.tool(
  'convert_markdown_to_pdf',
  'Convert markdown content to a PDF file. Supports syntax highlighting, math (KaTeX), and GitHub Flavored Markdown.',
  {
    markdown: z.string().describe('Markdown content to convert'),
    output_path: z.string().describe('Path for the output PDF file'),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe('Author name'),
    style: z.string().optional().describe('Style: default, eink, eink-serif, elegant, serif, or path to .css file'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4)'),
    landscape: z.boolean().optional().describe('Use landscape orientation'),
  },
  async ({ markdown, output_path, title, author, style, format, landscape }) => {
    try {
      const outputPath = resolvePath(output_path);
      await ensureDir(outputPath);
      const buffer = await convertMarkdownToPdfBuffer(markdown, {
        title,
        author,
        style,
        format,
        landscape,
      });
      await writeFile(outputPath, buffer);
      return { content: [{ type: 'text' as const, text: `PDF saved to ${outputPath} (${buffer.length} bytes)` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// --- convert_markdown_to_epub ---

server.tool(
  'convert_markdown_to_epub',
  'Convert markdown content to an EPUB ebook file. Math is rendered as MathML for e-reader compatibility.',
  {
    markdown: z.string().describe('Markdown content to convert'),
    output_path: z.string().describe('Path for the output EPUB file'),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe('Author name'),
    language: z.string().optional().describe('Language code, e.g. "en" (default: "en")'),
    publisher: z.string().optional().describe('Publisher name'),
    description: z.string().optional().describe('Book description'),
  },
  async ({ markdown, output_path, title, author, language, publisher, description }) => {
    try {
      const outputPath = resolvePath(output_path);
      await ensureDir(outputPath);
      const buffer = await convertMarkdownToEpubBuffer(markdown, {
        title,
        author,
        language,
        publisher,
        description,
      });
      await writeFile(outputPath, buffer);
      return { content: [{ type: 'text' as const, text: `EPUB saved to ${outputPath} (${buffer.length} bytes)` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// --- convert_file_to_pdf ---

server.tool(
  'convert_file_to_pdf',
  'Convert a markdown file on disk to PDF. Resolves relative image paths from the source directory.',
  {
    input_path: z.string().describe('Path to the input .md or .markdown file'),
    output_path: z.string().optional().describe('Path for the output PDF (default: same name with .pdf extension)'),
    title: z.string().optional().describe('Document title (default: filename)'),
    author: z.string().optional().describe('Author name'),
    style: z.string().optional().describe('Style: default, eink, eink-serif, elegant, serif, or path to .css file'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4)'),
    landscape: z.boolean().optional().describe('Use landscape orientation'),
  },
  async ({ input_path, output_path, title, author, style, format, landscape }) => {
    try {
      const inputPath = resolvePath(input_path);
      const result = await convertMdToPdf(inputPath, {
        output: output_path ? resolvePath(output_path) : undefined,
        title,
        author,
        style,
        format,
        landscape,
      });
      const size = await fileSize(result);
      return { content: [{ type: 'text' as const, text: `PDF saved to ${result} (${size} bytes)` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// --- convert_file_to_epub ---

server.tool(
  'convert_file_to_epub',
  'Convert a markdown file on disk to an EPUB ebook. Resolves relative image paths from the source directory.',
  {
    input_path: z.string().describe('Path to the input .md or .markdown file'),
    output_path: z.string().optional().describe('Path for the output EPUB (default: same name with .epub extension)'),
    title: z.string().optional().describe('Document title (default: filename)'),
    author: z.string().optional().describe('Author name'),
    language: z.string().optional().describe('Language code, e.g. "en" (default: "en")'),
    publisher: z.string().optional().describe('Publisher name'),
    description: z.string().optional().describe('Book description'),
    cover: z.string().optional().describe('Path to cover image file'),
  },
  async ({ input_path, output_path, title, author, language, publisher, description, cover }) => {
    try {
      const inputPath = resolvePath(input_path);
      const result = await convertMdToEpub(inputPath, {
        output: output_path ? resolvePath(output_path) : undefined,
        title,
        author,
        language,
        publisher,
        description,
        cover: cover ? resolvePath(cover) : undefined,
      });
      const size = await fileSize(result);
      return { content: [{ type: 'text' as const, text: `EPUB saved to ${result} (${size} bytes)` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// --- list_styles ---

server.tool(
  'list_styles',
  'List available built-in PDF styles.',
  {},
  async () => {
    try {
      const styles = getBuiltInStyles();
      return { content: [{ type: 'text' as const, text: `Available styles: ${styles.join(', ')}` }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// --- Start server ---

const transport = new StdioServerTransport();
await server.connect(transport);
