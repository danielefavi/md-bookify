import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseMarkdown, parseMarkdownFile } from '../src/parser.js';

describe('parseMarkdown', () => {
  it('converts # Hello to <h1>', () => {
    const html = parseMarkdown('# Hello');
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('converts **bold** to <strong>', () => {
    const html = parseMarkdown('**bold**');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('converts - item to <ul><li>', () => {
    const html = parseMarkdown('- item');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>item</li>');
  });

  it('converts inline `code` to <code>', () => {
    const html = parseMarkdown('`code`');
    expect(html).toContain('<code>code</code>');
  });

  it('converts fenced code block to <pre><code>', () => {
    const html = parseMarkdown('```\nconsole.log("hi")\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('<code>');
  });

  it('converts GFM table to <table>', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |';
    const html = parseMarkdown(md);
    expect(html).toContain('<table>');
    expect(html).toContain('<th>');
    expect(html).toContain('<td>');
  });

  it('converts > quote to <blockquote>', () => {
    const html = parseMarkdown('> quote');
    expect(html).toContain('<blockquote>');
  });

  it('converts [text](url) to <a>', () => {
    const html = parseMarkdown('[text](url)');
    expect(html).toContain('<a href="url">text</a>');
  });

  it('returns empty string for empty input', () => {
    const html = parseMarkdown('');
    expect(html).toBe('');
  });
});

describe('parseMarkdownFile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads and parses a .md file', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '# Hello');
    const html = await parseMarkdownFile(filePath);
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('throws for non-existent file', async () => {
    await expect(parseMarkdownFile(join(tmpDir, 'nope.md'))).rejects.toThrow();
  });

  it('reads and parses a .markdown file', async () => {
    const filePath = join(tmpDir, 'test.markdown');
    await writeFile(filePath, '# Hello');
    const html = await parseMarkdownFile(filePath);
    expect(html).toContain('<h1>Hello</h1>');
  });

  it('throws for non-.md extension', async () => {
    const filePath = join(tmpDir, 'test.txt');
    await writeFile(filePath, '# Hello');
    await expect(parseMarkdownFile(filePath)).rejects.toThrow('Unsupported file extension');
  });
});

describe('parseMarkdown (Prism syntax highlighting)', () => {
  it('highlights TypeScript code with token spans', () => {
    const md = '```typescript\nconst x = 1;\n```';
    const html = parseMarkdown(md);
    expect(html).toContain('class="token keyword"');
  });

  it('highlights JavaScript code', () => {
    const md = '```javascript\nfunction foo() {}\n```';
    const html = parseMarkdown(md);
    expect(html).toContain('class="token keyword"');
  });

  it('does not crash on unknown language', () => {
    const md = '```unknownlang\nsome code\n```';
    const html = parseMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
    expect(html).not.toContain('class="token');
  });

  it('outputs plain text for code block without language', () => {
    const md = '```\nplain text\n```';
    const html = parseMarkdown(md);
    expect(html).toContain('<pre>');
    expect(html).not.toContain('class="token');
  });

  it('highlights Python code with token spans', () => {
    const md = '```python\ndef greet():\n    import os\n```';
    const html = parseMarkdown(md);
    expect(html).toContain('class="token keyword"');
  });
});

describe('parseMarkdown (KaTeX math rendering)', () => {
  it('renders inline math $E = mc^2$ with katex class', () => {
    const html = parseMarkdown('$E = mc^2$');
    expect(html).toContain('class="katex"');
  });

  it('renders display math $$...$$ with katex-display or display mode', () => {
    const html = parseMarkdown('$$\\int_0^1 x^2 dx$$');
    expect(html).toMatch(/katex-display|display/);
  });

  it('does not throw on invalid command with throwOnError: false', () => {
    expect(() => parseMarkdown('$\\invalidcommand$')).not.toThrow();
  });

  it('emits MathML when mathOutput is set to "mathml"', () => {
    const html = parseMarkdown('$x^2$', { mathOutput: 'mathml' });
    expect(html).toContain('<math');
    expect(html).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
  });

  it('default mathOutput remains HTML rendering', () => {
    const html = parseMarkdown('$x^2$');
    // HTML output mode produces katex-html spans, not <math> elements
    expect(html).toContain('katex-html');
    expect(html).not.toContain('<math');
  });
});
