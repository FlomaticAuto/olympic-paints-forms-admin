// Render an HTML document string to a PDF buffer using headless Chromium.
// Works on Vercel via @sparticuz/chromium; locally falls back to a system
// Chrome if PUPPETEER_EXECUTABLE_PATH is set.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Vercel's file tracing does not reliably bundle @sparticuz/chromium's binary,
// so load the matching pack from a remote URL. Pack version MUST match the
// installed @sparticuz/chromium major.
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar';

export async function renderEstimatePdf(html: string): Promise<Buffer> {
  // Local dev sets PUPPETEER_EXECUTABLE_PATH to a system Chrome; use plain args
  // there. On Vercel, use the @sparticuz/chromium binary + its serverless args
  // (which include --single-process and are incompatible with desktop Chrome).
  const localExe = process.env.PUPPETEER_EXECUTABLE_PATH;
  const executablePath = localExe || (await chromium.executablePath(CHROMIUM_PACK_URL));
  const args = localExe ? ['--no-sandbox', '--disable-setuid-sandbox'] : chromium.args;

  // Unique profile dir per render so concurrent invocations never clash on the
  // default userDataDir ("browser is already running for …").
  const userDataDir = await mkdtemp(join(tmpdir(), 'resin-pdf-'));

  const browser = await puppeteer.launch({
    args,
    executablePath,
    headless: true,
    userDataDir,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 400));
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
