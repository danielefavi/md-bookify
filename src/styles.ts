import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

export const PRISM_DRACULA_CSS = `code[class*=language-],pre[class*=language-]{color:#f8f8f2;background:0 0;text-shadow:0 1px rgba(0,0,0,.3);font-family:Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace;text-align:left;white-space:pre;word-spacing:normal;word-break:normal;word-wrap:normal;line-height:1.5;-moz-tab-size:4;-o-tab-size:4;tab-size:4;-webkit-hyphens:none;-moz-hyphens:none;-ms-hyphens:none;hyphens:none}pre[class*=language-]{padding:1em;margin:.5em 0;overflow:auto;border-radius:.3em}:not(pre)>code[class*=language-],pre[class*=language-]{background:#282a36}:not(pre)>code[class*=language-]{padding:.1em;border-radius:.3em;white-space:normal}.token.cdata,.token.comment,.token.doctype,.token.prolog{color:#6272a4}.token.punctuation{color:#f8f8f2}.namespace{opacity:.7}.token.constant,.token.deleted,.token.property,.token.symbol,.token.tag{color:#ff79c6}.token.boolean,.token.number{color:#bd93f9}.token.attr-name,.token.builtin,.token.char,.token.inserted,.token.selector,.token.string{color:#50fa7b}.language-css .token.string,.style .token.string,.token.entity,.token.operator,.token.url,.token.variable{color:#f8f8f2}.token.atrule,.token.attr-value,.token.class-name,.token.function{color:#f1fa8c}.token.keyword{color:#8be9fd}.token.important,.token.regex{color:#ffb86c}.token.bold,.token.important{font-weight:700}.token.italic{font-style:italic}.token.entity{cursor:help}`;

function findStylesDir(): string {
  // Walk up from the current module's directory to find the styles/ folder.
  // Needed because tsup bundles this code into multiple entry points at
  // different directory depths (e.g. dist/index.js vs dist/bin/md-bookify.js).
  let dir = dirname(fileURLToPath(import.meta.url));
  const root = resolve('/');
  while (dir !== root) {
    const candidate = join(dir, 'styles');
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  throw new Error(`Could not find styles/ directory relative to ${dirname(fileURLToPath(import.meta.url))}`);
}

let _stylesDir: string | null = null;
function getStylesDir(): string {
  if (!_stylesDir) _stylesDir = findStylesDir();
  return _stylesDir;
}

export function getBuiltInStyles(): string[] {
  const dir = getStylesDir();
  return readdirSync(dir)
    .filter(f => f.endsWith('.css'))
    .map(f => f.replace(/\.css$/, ''))
    .sort();
}

const _styleCssCache = new Map<string, string>();

export function resolveStyleCss(style?: string): string {
  const name = style ?? 'default';

  if (name.endsWith('.css')) {
    const cached = _styleCssCache.get(name);
    if (cached) return cached;
    const css = readFileSync(name, 'utf-8');
    _styleCssCache.set(name, css);
    return css;
  }

  // Try to find as a built-in style in the styles/ directory
  const cssPath = join(getStylesDir(), `${name}.css`);
  if (existsSync(cssPath)) {
    const cached = _styleCssCache.get(name);
    if (cached) return cached;
    const css = readFileSync(cssPath, 'utf-8');
    _styleCssCache.set(name, css);
    return css;
  }

  throw new Error(
    `Unknown style "${name}". Built-in styles: ${getBuiltInStyles().join(', ')}. Or provide a path to a .css file.`
  );
}

let _katexCss: string | null = null;

export function getKatexCss(): string {
  if (_katexCss) return _katexCss;
  const req = createRequire(import.meta.url);
  const katexCssPath = req.resolve('katex/dist/katex.min.css');
  _katexCss = readFileSync(katexCssPath, 'utf-8');
  return _katexCss;
}
