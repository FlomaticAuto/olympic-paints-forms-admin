// CORS helper for API routes accessed by the GitHub Pages board.
// Only flomaticauto.github.io is allowed — add origins here if needed.
const ALLOWED_ORIGINS = [
  'https://flomaticauto.github.io',
];

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://flomaticauto.github.io',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'x-admin-secret, content-type',
  'Access-Control-Max-Age':       '86400',
};

export function corsHeaders(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin };
  }
  return CORS_HEADERS;
}
