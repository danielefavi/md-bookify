import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);
const tsxPath = 'npx';
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

describe('CLI', () => {
  it('--help shows usage with md-bookify and [input]', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', '--help']);
    expect(stdout).toContain('md-bookify');
    expect(stdout).toContain('[input]');
  });

  it('--version shows package.json version', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', '--version']);
    expect(stdout.trim()).toBe(pkg.version);
  });

  it('--help shows --style option', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', '--help']);
    expect(stdout).toContain('--style');
    expect(stdout).toContain('.css');
  });

  it('--help shows all CLI options', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', '--help']);
    expect(stdout).toContain('--output');
    expect(stdout).toContain('--landscape');
    expect(stdout).toContain('--margin-top');
    expect(stdout).toContain('--format');
    expect(stdout).toContain('--list-styles');
  });

  it('--list-styles prints available styles', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', '--list-styles']);
    expect(stdout).toContain('default');
    expect(stdout).toContain('eink');
    expect(stdout).toContain('elegant');
    expect(stdout).toContain('serif');
  });

  it('exits with error when no input is provided', async () => {
    try {
      await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts']);
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.stderr || err.stdout).toContain('missing required argument');
    }
  });
});

describe('CLI epub subcommand', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'md-bookify-epub-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('--help shows the epub subcommand', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', '--help']);
    expect(stdout).toContain('epub');
  });

  it('epub --help shows EPUB-specific options', async () => {
    const { stdout } = await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', 'epub', '--help']);
    expect(stdout).toContain('--author');
    expect(stdout).toContain('--language');
    expect(stdout).toContain('--cover');
    expect(stdout).toContain('--publisher');
    expect(stdout).toContain('--description');
    expect(stdout).toContain('--output');
  });

  it('produces a real .epub file with ZIP magic bytes', async () => {
    const inputPath = join(tmpDir, 'doc.md');
    const outPath = join(tmpDir, 'doc.epub');
    await writeFile(inputPath, '# Hello\n\nSome text.');
    await execFileAsync(tsxPath, [
      'tsx',
      'bin/md-bookify.ts',
      'epub',
      inputPath,
      '-o',
      outPath,
      '--author',
      'Test Author',
    ]);
    const file = await readFile(outPath);
    expect(file.subarray(0, 4).toString('hex')).toBe('504b0304');
  });

  it('exits with error when epub subcommand has no input', async () => {
    try {
      await execFileAsync(tsxPath, ['tsx', 'bin/md-bookify.ts', 'epub']);
      expect.unreachable('should have thrown');
    } catch (err: any) {
      expect(err.stderr || err.stdout).toContain('missing required argument');
    }
  });
});
