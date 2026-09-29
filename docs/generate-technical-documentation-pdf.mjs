#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-globals, no-undef -- build-time CLI outside src/; page.evaluate bodies run in the browser */
/**
 * Documentation build tool. Renders Nexora_Backend_Technical_Documentation.md
 * to a print-ready A4 PDF with rendered Mermaid diagrams, a cover page,
 * a numbered table of contents, running footers and PDF bookmarks.
 *
 * Usage (from repo root):
 *   node docs/generate-technical-documentation-pdf.mjs
 *
 * Dependencies live in docs/package.json and are not part of the backend runtime.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import puppeteer from 'puppeteer-core';

const DOCS_DIR = dirname(fileURLToPath(import.meta.url));
const MD_PATH = join(DOCS_DIR, 'Nexora_Backend_Technical_Documentation.md');
const HTML_PATH = join(DOCS_DIR, 'Nexora_Backend_Technical_Documentation.html');
const PDF_PATH = join(DOCS_DIR, 'Nexora_Backend_Technical_Documentation.pdf');
const MERMAID_PATH = join(DOCS_DIR, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');

const CHROME_CANDIDATES = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const DOC_TITLE = 'Nexora Backend Technical Documentation';
const DOC_SUBTITLE = 'Architecture, APIs, Business Workflows & Integrations';
const DOC_HIGHLIGHT = 'ChannelEngine Compatibility for StockConnect';
const DOC_VERSION = '1.0';
const DOC_DATE = '29 September 2026';
const DOC_CLASSIFICATION = 'Internal engineering documentation';

function slugify(text, used) {
    const base = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-');
    let slug = base.length > 0 ? base : 'section';
    let n = 2;
    while (used.has(slug)) {
        slug = `${base}-${n}`;
        n += 1;
    }
    used.add(slug);
    return slug;
}

function stripInlineMarkdown(text) {
    return text
        .replace(/`([^`]*)`/g, '$1')
        .replace(/\*\*([^*]*)\*\*/g, '$1')
        .replace(/\*([^*]*)\*/g, '$1');
}

/** Extracts fenced mermaid blocks so marked does not escape them. */
function extractMermaid(markdown) {
    const diagrams = [];
    const replaced = markdown.replace(/```mermaid\n([\s\S]*?)```/g, (_match, body) => {
        const index = diagrams.length;
        diagrams.push(body.trim());
        return `\n@@MERMAID_${index}@@\n`;
    });
    return { markdown: replaced, diagrams };
}

/** Builds heading metadata and injects anchors + section numbers. */
function buildOutline(markdown) {
    const used = new Set();
    const outline = [];
    let chapter = 0;
    let section = 0;

    const lines = markdown.split('\n');
    let inCode = false;
    const out = lines.map((line) => {
        if (line.startsWith('```')) {
            inCode = !inCode;
            return line;
        }
        if (inCode) {
            return line;
        }
        const h2 = /^## (.+)$/.exec(line);
        if (h2) {
            chapter += 1;
            section = 0;
            const raw = h2[1].trim();
            const title = stripInlineMarkdown(raw);
            const id = slugify(title, used);
            outline.push({ level: 2, number: String(chapter), title, id });
            return `## <a id="${id}"></a><span class="secno">${chapter}</span> ${raw}`;
        }
        const h3 = /^### (.+)$/.exec(line);
        if (h3 && chapter > 0) {
            section += 1;
            const raw = h3[1].trim();
            const title = stripInlineMarkdown(raw);
            const id = slugify(title, used);
            const number = `${chapter}.${section}`;
            outline.push({ level: 3, number, title, id });
            return `### <a id="${id}"></a><span class="secno">${number}</span> ${raw}`;
        }
        return line;
    });

    return { markdown: out.join('\n'), outline };
}

function renderTocHtml(outline) {
    const rows = outline
        .map((entry) => {
            const cls = entry.level === 2 ? 'toc-l1' : 'toc-l2';
            return `<li class="${cls}"><a href="#${entry.id}"><span class="toc-no">${entry.number}</span><span class="toc-title">${escapeHtml(entry.title)}</span></a></li>`;
        })
        .join('\n');
    return `<ul class="toc">\n${rows}\n</ul>`;
}

function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildHtml(bodyHtml, tocHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${DOC_TITLE}</title>
<style>
  @page { size: A4; margin: 18mm 14mm 20mm 14mm; }
  * { box-sizing: border-box; }
  html { font-size: 10.5pt; }
  body {
    margin: 0;
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    color: #1f2937;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ---------- Cover ---------- */
  .cover {
    page-break-after: always;
    min-height: 245mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 6mm 2mm;
  }
  .cover-top { border-top: 4px solid #1d4ed8; padding-top: 8mm; }
  .cover-kicker {
    font-size: 8.5pt; letter-spacing: 0.18em; text-transform: uppercase;
    color: #64748b; margin-bottom: 26mm;
  }
  .cover h1 {
    font-size: 30pt; font-weight: 600; line-height: 1.15;
    margin: 0 0 6mm; color: #0f172a; max-width: 165mm;
  }
  .cover-sub { font-size: 13pt; color: #334155; max-width: 160mm; margin: 0 0 10mm; }
  .cover-highlight {
    display: inline-block; background: #eff6ff; border-left: 3px solid #1d4ed8;
    padding: 3mm 5mm; font-size: 10.5pt; color: #1e3a8a; max-width: 160mm;
  }
  .cover-meta {
    border-top: 1px solid #e2e8f0; padding-top: 6mm;
    font-size: 9.5pt; color: #475569;
    display: grid; grid-template-columns: 34mm 1fr; row-gap: 2mm; max-width: 150mm;
  }
  .cover-meta dt { color: #64748b; }
  .cover-meta dd { margin: 0; color: #0f172a; }

  /* ---------- Table of contents ---------- */
  .toc-page { page-break-after: always; }
  .toc-page h2 {
    font-size: 16pt; color: #0f172a; margin: 0 0 6mm;
    padding-bottom: 3mm; border-bottom: 2px solid #1d4ed8;
  }
  ul.toc { list-style: none; margin: 0; padding: 0; column-count: 1; }
  ul.toc li { margin: 0 0 1.4mm; }
  ul.toc a { color: #1f2937; text-decoration: none; display: flex; gap: 4mm; }
  .toc-no { color: #1d4ed8; min-width: 12mm; font-variant-numeric: tabular-nums; }
  li.toc-l1 > a { font-weight: 600; font-size: 10pt; }
  li.toc-l1 { margin-top: 3mm; }
  li.toc-l2 > a { font-size: 9pt; color: #475569; padding-left: 8mm; }

  /* ---------- Headings ---------- */
  h2 {
    font-size: 17pt; color: #0f172a; font-weight: 600;
    margin: 0 0 5mm; padding-bottom: 2.5mm;
    border-bottom: 2px solid #1d4ed8;
    page-break-before: always; page-break-after: avoid;
  }
  h3 {
    font-size: 12.5pt; color: #0f172a; font-weight: 600;
    margin: 7mm 0 2.5mm; page-break-after: avoid;
  }
  h4 { font-size: 10.5pt; color: #334155; margin: 5mm 0 2mm; page-break-after: avoid; }
  .secno { color: #1d4ed8; font-weight: 600; margin-right: 2.5mm; }
  h2 + p, h3 + p, h2 + table, h3 + table, h2 + ul, h3 + ul { page-break-before: avoid; }

  /* ---------- Body ---------- */
  p { margin: 0 0 3mm; orphans: 3; widows: 3; }
  ul, ol { margin: 0 0 3.5mm; padding-left: 6mm; }
  li { margin-bottom: 1.2mm; }
  strong { color: #0f172a; font-weight: 600; }
  a { color: #1d4ed8; text-decoration: none; }
  /* Chapters already start on a new page with a ruled heading, so the markdown
     separators add nothing and can strand a rule alone on an otherwise empty page. */
  hr { display: none; }
  blockquote {
    margin: 3mm 0; padding: 2.5mm 5mm;
    border-left: 3px solid #94a3b8; background: #f8fafc; color: #475569;
    page-break-inside: avoid;
  }

  /* ---------- Code ---------- */
  code {
    font-family: Consolas, "Courier New", monospace; font-size: 8.8pt;
    background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 3px;
    word-break: break-word;
  }
  pre {
    background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;
    padding: 3mm 4mm; font-size: 8.2pt; line-height: 1.45;
    white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere;
    page-break-inside: avoid; margin: 0 0 4mm;
  }
  pre code { background: none; padding: 0; font-size: inherit; }

  /* ---------- Tables ---------- */
  table {
    width: 100%; max-width: 100%; border-collapse: collapse;
    margin: 2.5mm 0 5mm; font-size: 8.6pt; line-height: 1.4;
    table-layout: auto;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  th {
    background: #eff6ff; color: #0f172a; font-weight: 600; text-align: left;
    padding: 2.2mm 2mm; border: 1px solid #bfdbfe; vertical-align: top;
  }
  td {
    padding: 2.2mm 2mm; border: 1px solid #e2e8f0; vertical-align: top;
    overflow-wrap: anywhere; word-break: normal;
  }
  td code, th code { font-size: 8pt; background: #f1f5f9; }
  tbody tr:nth-child(even) td { background: #fafafa; }

  /* ---------- Diagrams ---------- */
  .diagram {
    margin: 4mm 0 6mm; text-align: center;
    page-break-inside: avoid; break-inside: avoid;
  }
  /* Mermaid sets an inline max-width equal to the diagram's natural width.
     It is preserved and combined with the container width in JS, so narrow
     top-down diagrams are never stretched to full width. */
  .diagram svg { height: auto; }
  .diagram-error {
    border: 1px solid #fca5a5; background: #fef2f2; color: #991b1b;
    padding: 3mm; font-size: 8.5pt; text-align: left; white-space: pre-wrap;
  }
</style>
</head>
<body>
  <section class="cover">
    <div class="cover-top">
      <div class="cover-kicker">Nexora &middot; Backend Engineering</div>
      <h1>${DOC_TITLE}</h1>
      <p class="cover-sub">${DOC_SUBTITLE}</p>
      <div class="cover-highlight"><strong>Priority section:</strong> ${DOC_HIGHLIGHT}</div>
    </div>
    <dl class="cover-meta">
      <dt>Version</dt><dd>${DOC_VERSION}</dd>
      <dt>Date</dt><dd>${DOC_DATE}</dd>
      <dt>Repository</dt><dd>nexora-backend</dd>
      <dt>Runtime</dt><dd>Node.js 24+, Fastify 5, PostgreSQL, Redis, BullMQ</dd>
      <dt>Classification</dt><dd>${DOC_CLASSIFICATION}</dd>
      <dt>Audience</dt><dd>Backend engineers, architects, QA, DevOps, technical leads</dd>
    </dl>
  </section>

  <section class="toc-page">
    <h2>Table of contents</h2>
    ${tocHtml}
  </section>

  <main class="content">
    ${bodyHtml}
  </main>
</body>
</html>`;
}

async function main() {
    if (!existsSync(MD_PATH)) {
        throw new Error(`Missing source document: ${MD_PATH}`);
    }
    if (!existsSync(MERMAID_PATH)) {
        throw new Error(`Missing mermaid bundle. Run "npm install" inside docs/.`);
    }
    const executablePath = CHROME_CANDIDATES.find((candidate) => existsSync(candidate));
    if (executablePath === undefined) {
        throw new Error('Chrome or Edge not found. Set PUPPETEER_EXECUTABLE_PATH.');
    }

    const source = readFileSync(MD_PATH, 'utf8')
        .replace(/\r\n/g, '\n')
        .replace(/<!--[\s\S]*?-->/g, '');
    const { markdown: withoutMermaid, diagrams } = extractMermaid(source);
    const { markdown: numbered, outline } = buildOutline(withoutMermaid);

    marked.setOptions({ gfm: true, breaks: false });
    let bodyHtml = marked.parse(numbered);

    // Re-insert diagram placeholders as mermaid containers.
    bodyHtml = bodyHtml.replace(/<p>@@MERMAID_(\d+)@@<\/p>/g, (_m, index) => {
        const definition = diagrams[Number(index)];
        const label = definition.split('\n')[0].trim();
        return `<div class="diagram"><div class="mermaid" data-definition="${escapeHtml(label)}">${escapeHtml(definition)}</div></div>`;
    });

    const html = buildHtml(bodyHtml, renderTocHtml(outline));
    writeFileSync(HTML_PATH, html, 'utf8');

    const browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'load', timeout: 180_000 });
        await page.addScriptTag({ path: MERMAID_PATH });

        const diagnostics = await page.evaluate(async () => {
            const mermaid = window.mermaid;
            mermaid.initialize({
                startOnLoad: false,
                theme: 'base',
                securityLevel: 'loose',
                fontFamily: 'Segoe UI, Calibri, Arial, sans-serif',
                themeVariables: {
                    primaryColor: '#eff6ff',
                    primaryTextColor: '#0f172a',
                    primaryBorderColor: '#1d4ed8',
                    lineColor: '#475569',
                    secondaryColor: '#f1f5f9',
                    tertiaryColor: '#f8fafc',
                    fontSize: '13px',
                },
                flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
                // wrap:false keeps participant labels such as "/api/v2/ce/products"
                // on one line instead of hyphenating them mid-path.
                sequence: { useMaxWidth: true, wrap: false, actorMargin: 38, boxMargin: 8 },
                er: { useMaxWidth: true },
                state: { useMaxWidth: true },
            });

            const nodes = Array.from(document.querySelectorAll('.mermaid'));
            const failures = [];
            for (let i = 0; i < nodes.length; i += 1) {
                const node = nodes[i];
                const definition = node.textContent ?? '';
                try {
                    const { svg } = await mermaid.render(`mmd-${i}`, definition);
                    node.innerHTML = svg;
                } catch (error) {
                    failures.push({ index: i, message: String(error && error.message ? error.message : error) });
                    node.classList.add('diagram-error');
                    node.textContent = `Diagram failed to render:\n${definition}`;
                }
            }

            // Constrain diagram SVGs to the printable area. Width is handled by
            // max-width; height must be scaled explicitly, otherwise a tall diagram
            // cannot fit on one page and leaves a large gap on the preceding page.
            const MAX_DIAGRAM_HEIGHT_PX = 760;
            // Never shrink a diagram past the point of legibility. Anything that
            // would need a smaller factor is reported so the source can be split.
            const MIN_LEGIBLE_SCALE = 0.55;
            const scaled = [];
            const tooTall = [];
            const svgs = Array.from(document.querySelectorAll('.diagram svg'));
            for (let i = 0; i < svgs.length; i += 1) {
                const svg = svgs[i];
                svg.removeAttribute('height');
                svg.style.height = 'auto';
                // Keep the diagram's natural width as an upper bound so a narrow
                // top-down flowchart is not stretched across the page.
                const natural = svg.style.maxWidth;
                svg.style.maxWidth = natural ? `min(100%, ${natural})` : '100%';
                const rect = svg.getBoundingClientRect();
                if (rect.height <= MAX_DIAGRAM_HEIGHT_PX || rect.height === 0) {
                    continue;
                }
                const ratio = MAX_DIAGRAM_HEIGHT_PX / rect.height;
                const label = (nodes[i]?.getAttribute('data-definition') ?? '').slice(0, 40);
                if (ratio < MIN_LEGIBLE_SCALE) {
                    tooTall.push({ index: i, height: Math.round(rect.height), ratio: Number(ratio.toFixed(2)), label });
                    svg.closest('.diagram').style.breakInside = 'auto';
                    continue;
                }
                svg.style.width = `${Math.floor(rect.width * ratio)}px`;
                svg.style.maxWidth = '100%';
                scaled.push({ index: i, height: Math.round(rect.height), ratio: Number(ratio.toFixed(2)), label });
            }

            return { total: nodes.length, failures, scaled, tooTall };
        });

        console.log(`Diagrams rendered: ${diagnostics.total - diagnostics.failures.length}/${diagnostics.total}`);
        if (diagnostics.scaled.length > 0) {
            console.log(`Diagrams scaled to fit one page: ${diagnostics.scaled.length}`);
        }
        if (diagnostics.tooTall.length > 0) {
            console.log(`Diagrams too tall to fit legibly (left unscaled, may span pages): ${diagnostics.tooTall.length}`);
            for (const entry of diagnostics.tooTall) {
                console.log(`  #${entry.index} height ${entry.height}px would need x${entry.ratio} — "${entry.label}"`);
            }
        }
        for (const failure of diagnostics.failures) {
            console.error(`  Diagram ${failure.index} failed: ${failure.message}`);
        }

        await page.emulateMediaType('print');
        writeFileSync(HTML_PATH, await page.content(), 'utf8');

        await page.pdf({
            path: PDF_PATH,
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            displayHeaderFooter: true,
            tagged: true,
            outline: true,
            headerTemplate: `
              <div style="box-sizing:border-box;width:100%;padding:0 14mm;font-size:7pt;color:#94a3b8;
                          font-family:Segoe UI,Arial,sans-serif;display:flex;justify-content:space-between;">
                <span>${DOC_TITLE}</span>
                <span>${DOC_CLASSIFICATION}</span>
              </div>`,
            footerTemplate: `
              <div style="box-sizing:border-box;width:100%;padding:0 14mm;font-size:7.5pt;color:#64748b;
                          font-family:Segoe UI,Arial,sans-serif;display:flex;justify-content:space-between;">
                <span>Nexora Backend &middot; v${DOC_VERSION} &middot; ${DOC_DATE}</span>
                <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
              </div>`,
            margin: { top: '16mm', bottom: '16mm', left: '0', right: '0' },
        });

        if (diagnostics.failures.length > 0) {
            process.exitCode = 1;
        }
    } finally {
        await browser.close();
    }

    console.log(`Wrote ${PDF_PATH}`);
    console.log(`Wrote ${HTML_PATH}`);
}

await main();
