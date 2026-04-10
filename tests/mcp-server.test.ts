import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { writeFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// We can't import the server file directly (it connects to stdio on import),
// so we re-create the server registration inline for testing.
// Instead, dynamically import after mocking StdioServerTransport.
let client: Client;
let server: McpServer;

async function createTestServer(): Promise<{ client: Client; server: McpServer }> {
  // Dynamically import to get the tool registrations on a fresh McpServer.
  // We build a thin wrapper that registers the same tools.
  const { z } = await import('zod');
  const { writeFile: wf, mkdir, stat } = await import('node:fs/promises');
  const { dirname, isAbsolute, resolve } = await import('node:path');
  const {
    convertMdToPdf,
    convertMdToEpub,
    convertMarkdownToPdfBuffer,
    convertMarkdownToEpubBuffer,
  } = await import('../src/index.js');
  const { getBuiltInStyles } = await import('../src/styles.js');

  function resolvePath(p: string): string {
    return isAbsolute(p) ? p : resolve(process.cwd(), p);
  }

  const server = new McpServer({ name: 'md-bookify-test', version: '0.0.0-test' });

  server.tool(
    'convert_markdown_to_pdf',
    'Convert markdown content to a PDF file.',
    {
      markdown: z.string(),
      output_path: z.string(),
      title: z.string().optional(),
      author: z.string().optional(),
      style: z.string().optional(),
      format: z.enum(['A4', 'Letter', 'Legal']).optional(),
      landscape: z.boolean().optional(),
    },
    async ({ markdown, output_path, title, author, style, format, landscape }) => {
      try {
        const outputPath = resolvePath(output_path);
        await mkdir(dirname(outputPath), { recursive: true });
        const buffer = await convertMarkdownToPdfBuffer(markdown, { title, author, style, format, landscape });
        await wf(outputPath, buffer);
        return { content: [{ type: 'text' as const, text: `PDF saved to ${outputPath} (${buffer.length} bytes)` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'convert_markdown_to_epub',
    'Convert markdown content to an EPUB ebook file.',
    {
      markdown: z.string(),
      output_path: z.string(),
      title: z.string().optional(),
      author: z.string().optional(),
      language: z.string().optional(),
      publisher: z.string().optional(),
      description: z.string().optional(),
    },
    async ({ markdown, output_path, title, author, language, publisher, description }) => {
      try {
        const outputPath = resolvePath(output_path);
        await mkdir(dirname(outputPath), { recursive: true });
        const buffer = await convertMarkdownToEpubBuffer(markdown, { title, author, language, publisher, description });
        await wf(outputPath, buffer);
        return { content: [{ type: 'text' as const, text: `EPUB saved to ${outputPath} (${buffer.length} bytes)` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'convert_file_to_pdf',
    'Convert a markdown file on disk to PDF.',
    {
      input_path: z.string(),
      output_path: z.string().optional(),
      title: z.string().optional(),
      author: z.string().optional(),
      style: z.string().optional(),
      format: z.enum(['A4', 'Letter', 'Legal']).optional(),
      landscape: z.boolean().optional(),
    },
    async ({ input_path, output_path, title, author, style, format, landscape }) => {
      try {
        const inputPath = resolvePath(input_path);
        const result = await convertMdToPdf(inputPath, {
          output: output_path ? resolvePath(output_path) : undefined,
          title, author, style, format, landscape,
        });
        const s = await stat(result);
        return { content: [{ type: 'text' as const, text: `PDF saved to ${result} (${s.size} bytes)` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool(
    'convert_file_to_epub',
    'Convert a markdown file on disk to an EPUB ebook.',
    {
      input_path: z.string(),
      output_path: z.string().optional(),
      title: z.string().optional(),
      author: z.string().optional(),
      language: z.string().optional(),
      publisher: z.string().optional(),
      description: z.string().optional(),
      cover: z.string().optional(),
    },
    async ({ input_path, output_path, title, author, language, publisher, description, cover }) => {
      try {
        const inputPath = resolvePath(input_path);
        const result = await convertMdToEpub(inputPath, {
          output: output_path ? resolvePath(output_path) : undefined,
          title, author, language, publisher, description,
          cover: cover ? resolvePath(cover) : undefined,
        });
        const s = await stat(result);
        return { content: [{ type: 'text' as const, text: `EPUB saved to ${result} (${s.size} bytes)` }] };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Error: ${(error as Error).message}` }], isError: true };
      }
    },
  );

  server.tool('list_styles', 'List available built-in PDF styles.', {}, async () => {
    const styles = getBuiltInStyles();
    return { content: [{ type: 'text' as const, text: `Available styles: ${styles.join(', ')}` }] };
  });

  const client = new Client({ name: 'test-client', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

describe('MCP Server', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-mcp-'));
    const result = await createTestServer();
    client = result.client;
    server = result.server;
  });

  afterEach(async () => {
    await client.close();
    await server.close();
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('lists all 5 tools', async () => {
    const { tools } = await client.listTools();
    const names = tools.map(t => t.name).sort();
    expect(names).toEqual([
      'convert_file_to_epub',
      'convert_file_to_pdf',
      'convert_markdown_to_epub',
      'convert_markdown_to_pdf',
      'list_styles',
    ]);
  });

  it('list_styles returns built-in styles', async () => {
    const result = await client.callTool({ name: 'list_styles', arguments: {} });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('default');
    expect(text).toContain('elegant');
    expect(text).toContain('serif');
  });

  it('convert_markdown_to_pdf produces a PDF file', async () => {
    const outputPath = join(tmpDir, 'output.pdf');
    const result = await client.callTool({
      name: 'convert_markdown_to_pdf',
      arguments: { markdown: '# Hello\n\nWorld', output_path: outputPath },
    });
    expect(result.isError).toBeFalsy();
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('PDF saved to');
    const content = await readFile(outputPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('convert_markdown_to_epub produces an EPUB file', async () => {
    const outputPath = join(tmpDir, 'output.epub');
    const result = await client.callTool({
      name: 'convert_markdown_to_epub',
      arguments: { markdown: '# Hello\n\nWorld', output_path: outputPath },
    });
    expect(result.isError).toBeFalsy();
    const content = await readFile(outputPath);
    // EPUB is a ZIP file — starts with PK magic bytes
    expect(content[0]).toBe(0x50);
    expect(content[1]).toBe(0x4b);
  });

  it('convert_file_to_pdf converts a .md file', async () => {
    const inputPath = join(tmpDir, 'test.md');
    await writeFile(inputPath, '# Test PDF\n\nSome content');
    const result = await client.callTool({
      name: 'convert_file_to_pdf',
      arguments: { input_path: inputPath },
    });
    expect(result.isError).toBeFalsy();
    const pdfPath = join(tmpDir, 'test.pdf');
    const content = await readFile(pdfPath);
    expect(content.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  it('convert_file_to_epub converts a .md file', async () => {
    const inputPath = join(tmpDir, 'test.md');
    await writeFile(inputPath, '# Test EPUB\n\nSome content');
    const result = await client.callTool({
      name: 'convert_file_to_epub',
      arguments: { input_path: inputPath },
    });
    expect(result.isError).toBeFalsy();
    const epubPath = join(tmpDir, 'test.epub');
    const content = await readFile(epubPath);
    expect(content[0]).toBe(0x50);
    expect(content[1]).toBe(0x4b);
  });

  it('returns isError for missing input file', async () => {
    const result = await client.callTool({
      name: 'convert_file_to_pdf',
      arguments: { input_path: join(tmpDir, 'nonexistent.md') },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Error:');
  });
});
