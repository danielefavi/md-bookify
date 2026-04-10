interface PdfOptions {
    format?: 'A4' | 'Letter' | 'Legal';
    landscape?: boolean;
    margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
    printBackground?: boolean;
    basePath?: string;
    author?: string;
}
declare function generatePdf(html: string, options?: PdfOptions): Promise<Buffer>;
declare function generatePdfToFile(html: string, outputPath: string, options?: PdfOptions): Promise<void>;

type MathOutput = 'html' | 'mathml';
interface ParseOptions {
    gfm?: boolean;
    mathOutput?: MathOutput;
}
declare function parseMarkdown(markdown: string, options?: ParseOptions): string;
declare function parseMarkdownFile(filePath: string, options?: ParseOptions): Promise<string>;

interface WrapHtmlOptions {
    title?: string;
    style?: string;
}
declare function wrapHtml(contentHtml: string, options?: WrapHtmlOptions): string;

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
interface WrapEpubHtmlOptions {
    title?: string;
}
/**
 * Wrap an HTML body fragment in a minimal HTML document suitable for being
 * fed into an EPUB packager. The returned document is a full
 * `<!DOCTYPE html>` doc; `epub.ts` strips the head and extracts the inline
 * `<style>` blocks before passing the body to the EPUB library.
 */
declare function wrapHtmlForEpub(contentHtml: string, options?: WrapEpubHtmlOptions): string;

interface EpubOptions {
    title?: string;
    author?: string | string[];
    language?: string;
    publisher?: string;
    description?: string;
    cover?: string;
    basePath?: string;
}
interface SplitHtml {
    css: string;
    body: string;
    title?: string;
}
/**
 * Detect image MIME type from file magic bytes. Returns the MIME string or
 * `null` when the format is not recognised.
 */
declare function detectMimeFromBytes(data: Buffer): string | null;
/**
 * Pull inline `<style>` blocks and the `<body>` contents out of a full HTML
 * document so they can be passed separately to an EPUB packager (which wants
 * the body fragment plus a single `css` string, not a full doc).
 */
declare function extractStyleAndBody(html: string): SplitHtml;
/**
 * Walk the HTML for `<img src>` references that point at local files and
 * rewrite them to absolute `file://` URLs. epub-gen-memory's image fetcher
 * reads `file://` URLs natively via `fs.readFile` and packages them as
 * separate manifest entries inside the EPUB ZIP — that's smaller and faster
 * than data URIs.
 *
 * Remote URLs (`http(s)://`), existing `data:` URIs, `file://` URLs, and
 * fragment refs (`#`) are left untouched. Missing files are warned about but
 * do not fail the conversion — the original `src` is preserved so the
 * e-reader can show its broken-image icon instead of the whole build aborting.
 */
declare function embedLocalImages(html: string, basePath: string): Promise<string>;
/**
 * Fetch remote images whose URLs lack a recognisable file extension.
 *
 * epub-gen-memory determines each image's MIME type from the URL alone
 * (`mime.getType(url)`). When the URL has no extension (common with image
 * services like placehold.co, Unsplash, Gravatar, etc.), the type comes back
 * empty and the image is stored without an extension — EPUB readers then
 * cannot display it.
 *
 * This function downloads those images, detects their real type from the HTTP
 * `Content-Type` header (with a magic-bytes fallback), writes them to a temp
 * directory with the correct extension, and rewrites the `<img src>` to a
 * `file://` URL so epub-gen-memory can pick up the type from the path.
 *
 * The caller **must** keep the returned `tempDir` alive until
 * `epub.genEpub()` has finished reading the files, then delete it.
 */
declare function fetchRemoteImages(html: string): Promise<{
    html: string;
    tempDir: string | null;
}>;
/**
 * Generate an EPUB file as an in-memory Buffer.
 *
 * The input `html` is expected to be a full HTML document (e.g. produced by
 * `wrapHtmlForEpub`). We split out inline styles into the EPUB's CSS slot,
 * pull the `<body>` fragment as the chapter content, and embed any
 * locally-referenced images as data URIs (when `basePath` is provided).
 */
declare function generateEpub(html: string, options?: EpubOptions): Promise<Buffer>;
/**
 * Generate an EPUB and write it to disk. Thin wrapper around `generateEpub`.
 */
declare function generateEpubToFile(html: string, outputPath: string, options?: EpubOptions): Promise<void>;

interface ConvertOptions {
    output?: string;
    title?: string;
    style?: string;
    format?: PdfOptions['format'];
    landscape?: boolean;
    margin?: PdfOptions['margin'];
    author?: string;
}
declare function convertMdToPdf(inputPath: string, options?: ConvertOptions): Promise<string>;
declare function convertMarkdownToPdfBuffer(markdown: string, options?: ConvertOptions): Promise<Buffer>;
interface ConvertEpubOptions {
    output?: string;
    title?: string;
    author?: string | string[];
    language?: string;
    publisher?: string;
    description?: string;
    cover?: string;
}
declare function convertMdToEpub(inputPath: string, options?: ConvertEpubOptions): Promise<string>;
declare function convertMarkdownToEpubBuffer(markdown: string, options?: ConvertEpubOptions): Promise<Buffer>;

export { type ConvertEpubOptions, type ConvertOptions, type EpubOptions, type MathOutput, type ParseOptions, type PdfOptions, type WrapEpubHtmlOptions, type WrapHtmlOptions, convertMarkdownToEpubBuffer, convertMarkdownToPdfBuffer, convertMdToEpub, convertMdToPdf, detectMimeFromBytes, embedLocalImages, extractStyleAndBody, fetchRemoteImages, generateEpub, generateEpubToFile, generatePdf, generatePdfToFile, parseMarkdown, parseMarkdownFile, wrapHtml, wrapHtmlForEpub };
