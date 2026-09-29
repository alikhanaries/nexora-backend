#!/usr/bin/env node
/* eslint-disable no-console, no-restricted-globals -- build-time CLI outside src/ */
/**
 * Documentation QA tool. Inspects the generated technical documentation PDF for
 * structural and layout defects, and rasterises pages for visual review.
 *
 * Usage (from repo root):
 *   node docs/validate-technical-documentation-pdf.mjs                 # report only
 *   node docs/validate-technical-documentation-pdf.mjs --render        # also write page PNGs
 *   node docs/validate-technical-documentation-pdf.mjs --contact-sheet # tiled page previews for review
 *
 * Checks performed:
 *   - file exists, non-empty, parses as PDF
 *   - page count and per-page text volume
 *   - text extending past the printable area (horizontal overflow / clipping)
 *   - blank or near-blank pages
 *   - presence of every expected chapter heading
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_DIR = dirname(fileURLToPath(import.meta.url));
const PDF_PATH = join(DOCS_DIR, 'Nexora_Backend_Technical_Documentation.pdf');
const MD_PATH = join(DOCS_DIR, 'Nexora_Backend_Technical_Documentation.md');
const RENDER_DIR = join(DOCS_DIR, '.pdf-pages');

const RENDER = process.argv.includes('--render');
const CONTACT_SHEET = process.argv.includes('--contact-sheet');
const SHEET_COLUMNS = 4;
const SHEET_ROWS = 3;
const SHEET_SCALE = 0.62;
/** A4 at 72dpi: 595.28 x 841.89pt. Right margin in the stylesheet is 14mm ~= 39.7pt. */
const RIGHT_EDGE_TOLERANCE_PT = 6;
const MIN_CHARS_FOR_NON_BLANK = 40;
/** Running header and footer sit in the page margins and must not count as content. */
const CONTENT_MARGIN_PT = 46;

function expectedChapters() {
    const md = readFileSync(MD_PATH, 'utf8').replace(/\r\n/g, '\n');
    const chapters = [];
    let inCode = false;
    for (const line of md.split('\n')) {
        if (line.startsWith('```')) {
            inCode = !inCode;
            continue;
        }
        if (inCode) {
            continue;
        }
        const match = /^## (.+)$/.exec(line);
        if (match) {
            chapters.push(
                match[1]
                    .replace(/`([^`]*)`/g, '$1')
                    .replace(/\*\*([^*]*)\*\*/g, '$1')
                    .trim(),
            );
        }
    }
    return chapters;
}

async function main() {
    if (!existsSync(PDF_PATH)) {
        throw new Error(`Missing PDF: ${PDF_PATH}`);
    }
    const bytes = readFileSync(PDF_PATH);
    if (bytes.length === 0) {
        throw new Error('PDF is empty');
    }
    if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
        throw new Error('File does not start with a PDF header');
    }

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({
        data: new Uint8Array(bytes),
        useSystemFonts: true,
        isEvalSupported: false,
    }).promise;

    const pageCount = doc.numPages;
    const overflow = [];
    const blank = [];
    const pageTexts = [];

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();

        let text = '';
        let bodyText = '';
        let worstRight = 0;
        let worstItem = '';
        for (const item of content.items) {
            if (typeof item.str !== 'string') {
                continue;
            }
            text += item.str;
            const y = item.transform[5];
            if (y > CONTENT_MARGIN_PT && y < viewport.height - CONTENT_MARGIN_PT) {
                bodyText += item.str;
            }
            // Whitespace-only runs carry no visible glyphs and routinely report
            // advance widths past the text box, so they are not clipping evidence.
            if (item.str.trim().length === 0) {
                continue;
            }
            const right = item.transform[4] + (item.width ?? 0);
            if (right > worstRight) {
                worstRight = right;
                worstItem = item.str.slice(0, 60);
            }
        }
        pageTexts.push(text);

        if (worstRight > viewport.width + RIGHT_EDGE_TOLERANCE_PT) {
            overflow.push({
                page: pageNumber,
                right: Number(worstRight.toFixed(1)),
                width: Number(viewport.width.toFixed(1)),
                text: worstItem,
            });
        }
        if (bodyText.replace(/\s/g, '').length < MIN_CHARS_FOR_NON_BLANK) {
            blank.push(pageNumber);
        }
    }

    const allText = pageTexts.join('\n');
    const chapters = expectedChapters();
    const missingChapters = chapters.filter((title) => !allText.includes(title.slice(0, 28)));

    console.log('PDF validation report');
    console.log('---------------------');
    console.log(`File            : ${PDF_PATH}`);
    console.log(`Size            : ${(bytes.length / 1024).toFixed(0)} KB`);
    console.log(`Pages           : ${pageCount}`);
    console.log(`Chapters in md  : ${chapters.length}`);
    console.log(`Chapters found  : ${chapters.length - missingChapters.length}`);
    console.log(`Overflow pages  : ${overflow.length}`);
    console.log(`Blank pages     : ${blank.length}${blank.length > 0 ? ` -> ${blank.join(', ')}` : ''}`);

    if (missingChapters.length > 0) {
        console.log('\nChapters not found in extracted text:');
        for (const title of missingChapters) {
            console.log(`  - ${title}`);
        }
    }
    if (overflow.length > 0) {
        console.log('\nPages with text past the page edge:');
        for (const entry of overflow) {
            console.log(`  - page ${entry.page}: rightmost ${entry.right}pt vs width ${entry.width}pt — "${entry.text}"`);
        }
    }

    if (RENDER) {
        const { createCanvas } = await import('@napi-rs/canvas');
        rmSync(RENDER_DIR, { recursive: true, force: true });
        mkdirSync(RENDER_DIR, { recursive: true });
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
            const page = await doc.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1.6 });
            const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
            const context = canvas.getContext('2d');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: context, viewport }).promise;
            const name = `page-${String(pageNumber).padStart(3, '0')}.png`;
            writeFileSync(join(RENDER_DIR, name), canvas.toBuffer('image/png'));
        }
        console.log(`\nRendered ${pageCount} page images to ${RENDER_DIR}`);
    }

    if (CONTACT_SHEET) {
        const { createCanvas } = await import('@napi-rs/canvas');
        mkdirSync(RENDER_DIR, { recursive: true });
        const perSheet = SHEET_COLUMNS * SHEET_ROWS;
        const sheetCount = Math.ceil(pageCount / perSheet);
        const probe = (await doc.getPage(1)).getViewport({ scale: SHEET_SCALE });
        const cellWidth = Math.ceil(probe.width);
        const cellHeight = Math.ceil(probe.height);
        const gap = 10;
        const labelHeight = 16;

        for (let sheet = 0; sheet < sheetCount; sheet += 1) {
            const canvas = createCanvas(
                SHEET_COLUMNS * cellWidth + (SHEET_COLUMNS + 1) * gap,
                SHEET_ROWS * (cellHeight + labelHeight) + (SHEET_ROWS + 1) * gap,
            );
            const context = canvas.getContext('2d');
            context.fillStyle = '#e2e8f0';
            context.fillRect(0, 0, canvas.width, canvas.height);

            for (let slot = 0; slot < perSheet; slot += 1) {
                const pageNumber = sheet * perSheet + slot + 1;
                if (pageNumber > pageCount) {
                    break;
                }
                const column = slot % SHEET_COLUMNS;
                const row = Math.floor(slot / SHEET_COLUMNS);
                const x = gap + column * (cellWidth + gap);
                const y = gap + row * (cellHeight + labelHeight + gap);

                const page = await doc.getPage(pageNumber);
                const viewport = page.getViewport({ scale: SHEET_SCALE });
                const cell = createCanvas(cellWidth, cellHeight);
                const cellContext = cell.getContext('2d');
                cellContext.fillStyle = '#ffffff';
                cellContext.fillRect(0, 0, cellWidth, cellHeight);
                await page.render({ canvasContext: cellContext, viewport }).promise;

                context.drawImage(cell, x, y);
                context.strokeStyle = '#94a3b8';
                context.strokeRect(x, y, cellWidth, cellHeight);
                context.fillStyle = '#0f172a';
                context.font = '12px sans-serif';
                context.fillText(`page ${pageNumber}`, x + 2, y + cellHeight + 12);
            }

            const name = `sheet-${String(sheet + 1).padStart(2, '0')}.png`;
            writeFileSync(join(RENDER_DIR, name), canvas.toBuffer('image/png'));
        }
        console.log(`\nWrote ${sheetCount} contact sheets to ${RENDER_DIR}`);
    }

    const failed = missingChapters.length > 0 || overflow.length > 0 || blank.length > 0;
    if (failed) {
        process.exitCode = 1;
    }
    console.log(`\nResult: ${failed ? 'ISSUES FOUND' : 'PASS'}`);
}

await main();
