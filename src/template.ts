import { PRISM_DRACULA_CSS, getKatexCss, resolveStyleCss } from './styles.js';

export interface WrapHtmlOptions {
  title?: string;
  style?: string;
}

export function wrapHtml(contentHtml: string, options?: WrapHtmlOptions): string {
  const title = options?.title ?? 'Document';

  let extraCss = '';
  if (contentHtml.includes('class="katex"')) {
    try {
      extraCss = `<style>${getKatexCss()}</style>`;
    } catch {
      // katex not installed, skip
    }
  }

  return `<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${resolveStyleCss(options?.style)}</style>
    <style>${PRISM_DRACULA_CSS}</style>
    ${extraCss}
  </head>
  <body>
    ${contentHtml}
  </body>
</html>`;
}
