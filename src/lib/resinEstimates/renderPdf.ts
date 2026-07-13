// Render an HTML document string to a PDF buffer using headless Chromium.
// Works on Vercel via @sparticuz/chromium; locally falls back to a system
// Chrome if PUPPETEER_EXECUTABLE_PATH is set.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

// Vercel's file tracing does not reliably bundle @sparticuz/chromium's binary,
// so load the matching pack from a remote URL. Pack version MUST match the
// installed @sparticuz/chromium major.
const CHROMIUM_PACK_URL =
  process.env.CHROMIUM_PACK_URL ||
  'https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar';

export async function renderEstimatePdf(html: string): Promise<Buffer> {
  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath(CHROMIUM_PACK_URL));

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
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
