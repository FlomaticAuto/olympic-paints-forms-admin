// Olympic Resins company details for the estimate/quote document + email.
// Banking / Reg / VAT are placeholders — update with the real registered
// details before sending to external customers.

export const RESIN_COMPANY = {
  name:       'Olympic Resins',
  parent:     'A division of Olympic Paints',
  tagline:    'B2B Resin & Solvent Supply',
  reg:        '—',            // TODO: registered company number
  vat:        '—',            // TODO: VAT number
  phone:      '+27 15 293 0000',
  email:      'kimw@olympicresins.co.za',
  preparedBy: 'Kim Williams',
  address:    'Polokwane, Limpopo, South Africa',
  bank: {
    accountName: 'Olympic Resins',   // TODO: confirm banking details
    bank:        '—',
    branchCode:  '—',
    accountNo:   '—',
  },
} as const;

// Placeholder brand mark (gold disc + wordmark) as a data URI so it renders in
// the puppeteer-generated PDF without needing a server origin. Swap for the
// supplied master artwork when available.
const LOGO_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 470" width="460" height="470">` +
  `<circle cx="230" cy="150" r="140" fill="#F6C324"/>` +
  `<g fill="#111111" font-family="Arial,sans-serif" font-weight="900" text-anchor="middle" letter-spacing="1">` +
  `<text x="230" y="378" font-size="96">OLYMPIC</text>` +
  `<text x="230" y="458" font-size="96">RESINS</text></g></svg>`;

export const LOGO_DATA_URI =
  'data:image/svg+xml;base64,' + Buffer.from(LOGO_SVG).toString('base64');
