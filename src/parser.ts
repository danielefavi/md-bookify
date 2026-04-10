import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { Marked, Renderer } from 'marked';
import markedKatex from 'marked-katex-extension';
import Prism from 'prismjs';

import 'prismjs/components/prism-typescript.js';
import 'prismjs/components/prism-javascript.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-markup.js';
import 'prismjs/components/prism-go.js';
import 'prismjs/components/prism-rust.js';
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-yaml.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-diff.js';

export type MathOutput = 'html' | 'mathml';

export interface ParseOptions {
  gfm?: boolean;
  mathOutput?: MathOutput;
}

const renderer = new Renderer();
renderer.code = function ({ text, lang }: { text: string; lang?: string; escaped?: boolean }) {
  const language = lang ?? '';
  const grammar = language ? Prism.languages[language] : undefined;
  if (grammar) {
    const highlighted = Prism.highlight(text, grammar, language);
    return `<pre class="language-${language}"><code class="language-${language}">${highlighted}</code></pre>\n`;
  }
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<pre><code${language ? ` class="language-${language}"` : ''}>${escaped}</code></pre>\n`;
};

const markedInstances = new Map<MathOutput, Marked>();

function getMarked(mathOutput: MathOutput): Marked {
  const cached = markedInstances.get(mathOutput);
  if (cached) return cached;
  const instance = new Marked();
  instance.use(markedKatex({ throwOnError: false, output: mathOutput }));
  markedInstances.set(mathOutput, instance);
  return instance;
}

export function parseMarkdown(markdown: string, options?: ParseOptions): string {
  const instance = getMarked(options?.mathOutput ?? 'html');
  const result = instance.parse(markdown, {
    gfm: options?.gfm ?? true,
    async: false,
    renderer,
  });
  if (typeof result !== 'string') {
    throw new Error('Unexpected async result from marked.parse');
  }
  return result;
}

export async function parseMarkdownFile(filePath: string, options?: ParseOptions): Promise<string> {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.markdown') {
    throw new Error(`Unsupported file extension "${ext}". Expected .md or .markdown`);
  }
  const content = await readFile(filePath, 'utf-8');
  return parseMarkdown(content, options);
}
