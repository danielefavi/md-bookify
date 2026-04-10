import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { wrapHtml } from '../src/template.js';

describe('wrapHtml', () => {
  it('returns valid HTML5 structure', () => {
    const html = wrapHtml('<p>test</p>');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });

  it('places content inside <body>', () => {
    const html = wrapHtml('<p>hello world</p>');
    const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
    expect(bodyMatch).not.toBeNull();
    expect(bodyMatch![1]).toContain('<p>hello world</p>');
  });

  it('includes default style with Open Sans font-family', () => {
    const html = wrapHtml('<p>test</p>');
    expect(html).toContain('<style>');
    expect(html).toContain('Open Sans');
  });

  it('sets custom title when provided', () => {
    const html = wrapHtml('<p>test</p>', { title: 'My Doc' });
    expect(html).toContain('<title>My Doc</title>');
  });

  it('uses default title Document when no title', () => {
    const html = wrapHtml('<p>test</p>');
    expect(html).toContain('<title>Document</title>');
  });

  it('CSS includes border-collapse for tables', () => {
    const html = wrapHtml('<p>test</p>');
    expect(html).toContain('border-collapse: collapse');
  });

  it('CSS includes border-left for blockquotes', () => {
    const html = wrapHtml('<p>test</p>');
    expect(html).toContain('border-left');
  });

  it('CSS includes Hack or Consolas for code blocks', () => {
    const html = wrapHtml('<p>test</p>');
    expect(html).toMatch(/Hack|Consolas/);
  });

  it('handles empty content string', () => {
    const html = wrapHtml('');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });

  it('includes KaTeX CSS when content contains class="katex"', () => {
    const html = wrapHtml('<span class="katex">math</span>');
    expect(html).toMatch(/@font-face/);
  });

  it('does not include KaTeX CSS when content has no math', () => {
    const html = wrapHtml('<p>no math here</p>');
    // Count style tags - should be exactly 2 (main CSS + Prism)
    const styleCount = (html.match(/<style>/g) || []).length;
    expect(styleCount).toBe(2);
  });

  describe('style option', () => {
    it('uses default CSS when style is undefined', () => {
      const html = wrapHtml('<p>test</p>');
      expect(html).toContain('Open Sans');
    });

    it('uses default CSS when style is "default"', () => {
      const html = wrapHtml('<p>test</p>', { style: 'default' });
      expect(html).toContain('Open Sans');
    });

    it('uses eink theme CSS with Vollkorn font', () => {
      const html = wrapHtml('<p>test</p>', { style: 'eink' });
      expect(html).toContain('Vollkorn');
      expect(html).not.toContain('Open Sans');
    });

    it('uses elegant theme CSS with Playfair Display font', () => {
      const html = wrapHtml('<p>test</p>', { style: 'elegant' });
      expect(html).toContain('Playfair Display');
      expect(html).not.toContain('Open Sans');
    });

    it('reads custom CSS from a file path', () => {
      const tmpDir = mkdtempSync(join(tmpdir(), 'md-bookify-test-'));
      const cssPath = join(tmpDir, 'custom.css');
      writeFileSync(cssPath, 'body { color: hotpink; }');
      try {
        const html = wrapHtml('<p>test</p>', { style: cssPath });
        expect(html).toContain('color: hotpink');
      } finally {
        rmSync(tmpDir, { recursive: true });
      }
    });

    it('throws error for unknown style name', () => {
      expect(() => wrapHtml('<p>test</p>', { style: 'nonexistent' })).toThrow(
        /Unknown style "nonexistent"/
      );
    });
  });
});
