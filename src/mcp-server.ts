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
  'Convert a markdown string to a PDF file on disk. Supports GitHub Flavored Markdown (tables, task lists, strikethrough), Prism.js syntax highlighting (TypeScript, Python, Go, Rust, Java, and more), and KaTeX math ($inline$ and $$block$$). Use this when you have markdown content in memory. For converting an existing .md file, prefer convert_file_to_pdf which also resolves relative image paths. Available styles: default, serif, elegant, eink, eink-serif.',
  {
    markdown: z.string().describe('Full markdown content to convert. Supports GFM (tables, task lists), fenced code blocks with language tags for syntax highlighting, and KaTeX math ($inline$ and $$block$$).'),
    output_path: z.string().describe('Absolute or relative path for the output PDF file. Parent directories are created automatically.'),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe('Author name for PDF metadata'),
    style: z.string().optional().describe('Built-in style name (default, eink, eink-serif, elegant, serif) or absolute path to a .css file. Styles only affect PDF output.'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4). Use Letter for US standard, Legal for legal documents.'),
    landscape: z.boolean().optional().describe('Use landscape orientation (good for wide tables or code)'),
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
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

// --- convert_markdown_to_pdf_buffer ---

server.tool(
  'convert_markdown_to_pdf_buffer',
  'Convert a markdown string to PDF and return the result as base64-encoded data instead of writing to disk. Use this when you need the PDF content directly (e.g., to pass to another tool or embed in a response) rather than saving to a file. Supports the same markdown features as convert_markdown_to_pdf. For large documents, prefer convert_markdown_to_pdf to write directly to disk.',
  {
    markdown: z.string().describe('Full markdown content to convert. Supports GFM, syntax highlighting, and KaTeX math.'),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe('Author name for PDF metadata'),
    style: z.string().optional().describe('Built-in style name (default, eink, eink-serif, elegant, serif) or path to a .css file.'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4). Use Letter for US standard, Legal for legal documents.'),
    landscape: z.boolean().optional().describe('Use landscape orientation'),
  },
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  async ({ markdown, title, author, style, format, landscape }) => {
    try {
      const buffer = await convertMarkdownToPdfBuffer(markdown, {
        title,
        author,
        style,
        format,
        landscape,
      });
      return {
        content: [{
          type: 'resource' as const,
          resource: {
            uri: `data:application/pdf;base64,${buffer.toString('base64')}`,
            mimeType: 'application/pdf',
            blob: buffer.toString('base64'),
          },
        }],
      };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
    }
  },
);

// --- convert_markdown_to_epub ---

server.tool(
  'convert_markdown_to_epub',
  'Convert a markdown string to an EPUB ebook file on disk. Math is rendered as MathML for broad e-reader compatibility. EPUB output uses a built-in e-reader-friendly stylesheet — the style parameter is not available for EPUB. Use this when generating EPUB from a string. For converting an existing .md file with relative images, prefer convert_file_to_epub.',
  {
    markdown: z.string().describe('Full markdown content to convert. Supports GFM (tables, task lists), fenced code blocks with syntax highlighting, and KaTeX math (rendered as MathML).'),
    output_path: z.string().describe('Absolute or relative path for the output EPUB file. Parent directories are created automatically.'),
    title: z.string().optional().describe('Document title (default: "Document")'),
    author: z.string().optional().describe('Author name for EPUB metadata'),
    language: z.string().optional().describe('Language code, e.g. "en" (default: "en")'),
    publisher: z.string().optional().describe('Publisher name for EPUB metadata'),
    description: z.string().optional().describe('Book description for EPUB metadata'),
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
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
  'Convert a .md or .markdown file on disk to PDF. This is the preferred tool when the markdown file already exists, because it automatically resolves relative image paths (e.g., ![](./images/photo.png)) from the source file\'s directory. If output_path is omitted, the PDF is written alongside the source file with a .pdf extension. Available styles: default, serif, elegant, eink, eink-serif.',
  {
    input_path: z.string().describe('Path to the input .md or .markdown file'),
    output_path: z.string().optional().describe('Path for the output PDF (default: same name with .pdf extension)'),
    title: z.string().optional().describe('Document title (default: filename)'),
    author: z.string().optional().describe('Author name for PDF metadata'),
    style: z.string().optional().describe('Built-in style name (default, eink, eink-serif, elegant, serif) or absolute path to a .css file. Styles only affect PDF output.'),
    format: z.enum(['A4', 'Letter', 'Legal']).optional().describe('Page format (default: A4). Use Letter for US standard, Legal for legal documents.'),
    landscape: z.boolean().optional().describe('Use landscape orientation (good for wide tables or code)'),
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
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
  'Convert a .md or .markdown file on disk to an EPUB ebook. This is the preferred tool when the markdown file already exists, because it automatically resolves relative image paths from the source file\'s directory. If output_path is omitted, the EPUB is written alongside the source file with an .epub extension. Supports optional cover image. Math is rendered as MathML for e-reader compatibility.',
  {
    input_path: z.string().describe('Path to the input .md or .markdown file'),
    output_path: z.string().optional().describe('Path for the output EPUB (default: same name with .epub extension)'),
    title: z.string().optional().describe('Document title (default: filename)'),
    author: z.string().optional().describe('Author name for EPUB metadata'),
    language: z.string().optional().describe('Language code, e.g. "en" (default: "en")'),
    publisher: z.string().optional().describe('Publisher name for EPUB metadata'),
    description: z.string().optional().describe('Book description for EPUB metadata'),
    cover: z.string().optional().describe('Path to cover image file (JPG or PNG recommended)'),
  },
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
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
  'List available built-in PDF styles. Returns: default (clean sans-serif), serif, elegant, eink, eink-serif. Styles only apply to PDF output — EPUB uses its own e-reader-friendly stylesheet. You can also pass a path to any .css file as a custom style.',
  {},
  {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
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
