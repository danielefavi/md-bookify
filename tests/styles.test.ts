import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveStyleCss, getBuiltInStyles } from '../src/styles.js';

describe('resolveStyleCss', () => {
  it('returns default CSS when style is undefined', () => {
    expect(resolveStyleCss()).toContain('Open Sans');
  });

  it('returns default CSS when style is "default"', () => {
    expect(resolveStyleCss('default')).toContain('Open Sans');
  });

  it('returns eink CSS with Vollkorn font', () => {
    const css = resolveStyleCss('eink');
    expect(css).toContain('Vollkorn');
    expect(css).not.toContain('Open Sans');
  });

  it('returns elegant CSS with Playfair Display font', () => {
    const css = resolveStyleCss('elegant');
    expect(css).toContain('Playfair Display');
    expect(css).not.toContain('Open Sans');
  });

  it('resolves any .css file in the styles directory by name', () => {
    const css = resolveStyleCss('serif');
    expect(css).toBeTruthy();
    expect(css).not.toContain('Open Sans');
  });

  it('reads a custom .css file path', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'md-bookify-styles-'));
    const cssPath = join(tmpDir, 'my-theme.css');
    writeFileSync(cssPath, 'body { font-size: 42px; }');
    try {
      const css = resolveStyleCss(cssPath);
      expect(css).toBe('body { font-size: 42px; }');
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });

  it('throws for a non-existent .css file path', () => {
    expect(() => resolveStyleCss('/tmp/does-not-exist-12345.css')).toThrow('ENOENT');
  });

  it('throws for an unknown style name', () => {
    expect(() => resolveStyleCss('fancy')).toThrow(/Unknown style "fancy"/);
  });

  it('error message lists built-in styles', () => {
    expect(() => resolveStyleCss('fancy')).toThrow(/default/);
  });
});

describe('getKatexCss', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns CSS containing @font-face declarations', async () => {
    const { getKatexCss } = await import('../src/styles.js');
    const css = getKatexCss();
    expect(css).toBeTruthy();
    expect(css).toContain('@font-face');
  });

  it('caches the result on subsequent calls', async () => {
    const { getKatexCss } = await import('../src/styles.js');
    const first = getKatexCss();
    const second = getKatexCss();
    expect(first).toBe(second);
  });
});

describe('resolveStyleCss caching', () => {
  it('returns the same string for repeated custom .css file reads', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'md-bookify-cache-'));
    const cssPath = join(tmpDir, 'cached.css');
    writeFileSync(cssPath, 'body { color: red; }');
    try {
      const first = resolveStyleCss(cssPath);
      const second = resolveStyleCss(cssPath);
      expect(first).toBe(second);
    } finally {
      rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('getBuiltInStyles', () => {
  it('includes default and all .css files from styles directory', () => {
    const styles = getBuiltInStyles();
    expect(styles).toContain('default');
    expect(styles).toContain('eink');
    expect(styles).toContain('elegant');
    expect(styles).toContain('serif');
  });

  it('does not include .css extension in style names', () => {
    const styles = getBuiltInStyles();
    expect(styles.every(s => !s.endsWith('.css'))).toBe(true);
  });
});
