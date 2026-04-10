/**
 * Slim, e-reader-friendly HTML wrapper for EPUB output.
 *
 * Unlike `wrapHtml` (which is tuned for PDF rendering with the Prism Dracula
 * theme, custom max-widths, and full KaTeX HTML CSS), this wrapper aims to be
 * minimal and to let the e-reader handle layout, font, and color choices.
 *
 * - No max-width / margin centering — e-readers reflow.
 * - No web fonts — system serif/sans is more reliable on e-ink.
 * - Light Prism theme so code blocks remain legible on e-ink screens.
 * - No KaTeX HTML CSS — math is expected to be rendered as MathML.
 */

export interface WrapEpubHtmlOptions {
  title?: string;
}

/**
 * Minimal base CSS for EPUB chapter content. Intentionally small and
 * declarative — most properties an e-reader will override anyway, but the
 * defaults below give a usable rendering on readers that respect publisher CSS.
 */
export const EPUB_BASE_CSS = `
body {
  margin: 0;
  padding: 0;
  line-height: 1.5;
  font-size: 1em;
}
h1, h2, h3, h4, h5, h6 {
  line-height: 1.2;
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  page-break-after: avoid;
}
h1 { font-size: 1.8em; }
h2 { font-size: 1.5em; }
h3 { font-size: 1.25em; }
p { margin: 0.6em 0; }
a { color: inherit; text-decoration: underline; }
img {
  max-width: 100%;
  height: auto;
}
blockquote {
  margin: 1em 0;
  padding: 0 1em;
  border-left: 4px solid #999;
  color: #555;
}
hr {
  border: none;
  border-top: 1px solid #999;
  margin: 1.5em 0;
}
ul, ol { margin: 0.6em 0; padding-left: 1.5em; }
li { margin: 0.2em 0; }
table {
  border-collapse: collapse;
  margin: 1em 0;
  width: 100%;
}
th, td {
  border: 1px solid #999;
  padding: 0.4em 0.6em;
  text-align: left;
}
th { background-color: #eee; }
code {
  font-family: monospace;
  font-size: 0.95em;
  background-color: #f4f4f4;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}
pre {
  font-family: monospace;
  font-size: 0.9em;
  background-color: #f4f4f4;
  padding: 0.8em 1em;
  border-radius: 4px;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: break-word;
  page-break-inside: avoid;
}
pre code {
  background: none;
  padding: 0;
  border-radius: 0;
}
`.trim();

/**
 * Lightweight Prism theme suitable for e-ink and reflowable EPUB readers.
 * Adapted from prism-coy / prism-tomorrow but simplified — only the token
 * classes that the parser actually emits are styled. Uses CSS3 properties
 * that EPUB3 readers support.
 */
export const PRISM_LIGHT_CSS = `
.token.comment, .token.prolog, .token.doctype, .token.cdata {
  color: #708090;
  font-style: italic;
}
.token.punctuation { color: #4a4a4a; }
.token.namespace { opacity: 0.7; }
.token.property, .token.tag, .token.boolean, .token.number,
.token.constant, .token.symbol, .token.deleted {
  color: #905;
}
.token.selector, .token.attr-name, .token.string, .token.char,
.token.builtin, .token.inserted {
  color: #690;
}
.token.operator, .token.entity, .token.url,
.language-css .token.string, .style .token.string {
  color: #9a6e3a;
}
.token.atrule, .token.attr-value, .token.keyword {
  color: #07a;
  font-weight: bold;
}
.token.function, .token.class-name { color: #dd4a68; }
.token.regex, .token.important, .token.variable { color: #e90; }
.token.important, .token.bold { font-weight: bold; }
.token.italic { font-style: italic; }
`.trim();

/**
 * Wrap an HTML body fragment in a minimal HTML document suitable for being
 * fed into an EPUB packager. The returned document is a full
 * `<!DOCTYPE html>` doc; `epub.ts` strips the head and extracts the inline
 * `<style>` blocks before passing the body to the EPUB library.
 */
export function wrapHtmlForEpub(contentHtml: string, options?: WrapEpubHtmlOptions): string {
  const title = options?.title ?? 'Document';
  return `<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>${EPUB_BASE_CSS}</style>
    <style>${PRISM_LIGHT_CSS}</style>
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;
}
