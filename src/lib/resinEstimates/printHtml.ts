// Renders ResinEstimateDocument to a full HTML string, shared by the PDF
// renderer (puppeteer setContent) and the /print page.
// react-dom/server is imported dynamically so it stays out of the static RSC
// module graph — only ever called from the Node.js send route at request time.
import { createElement } from 'react';
import ResinEstimateDocument from '@/components/ResinEstimateDocument';
import type { ResinEstimate, ResinEstimateLine } from './types';

export async function buildPrintHtml(
  est: ResinEstimate, lines: ResinEstimateLine[],
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const inner = renderToStaticMarkup(createElement(ResinEstimateDocument, { est, lines }));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `</head><body>${inner}</body></html>`;
}
