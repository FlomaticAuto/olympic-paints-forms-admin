// Olympic Resins company details for the estimate/quote document + email.
// Invoicing identity per the Odoo company master ("Company Details" sheet,
// Company 2 = Olympic Resins) in 2.Areas/1. Sales/8. Resin/Master data/. This is
// the exact name Olympic Resins invoices under. Banking from the official
// "Resins-banking details" letter in the same folder.

export const RESIN_COMPANY = {
  name:       'Olympic Resins',
  parent:     '',                    // invoices as "Olympic Resins" — no separate entity line
  tagline:    'B2B Resin & Solvent Supply',
  reg:        'CK 1994/031999/23',
  vat:        '4870145432',
  phone:      '+27 11 857 1045',
  fax:        '+27 11 857 1059',
  email:      'accounts@olympicpaints.co.za',
  website:    'www.olympicpaints.co.za',
  preparedBy: 'Kim Williams',
  address:    '28 Mecca Road, Anchorville Industrial Township, Lawley, Lenasia, Gauteng, 1830',
  bank: {
    accountName: 'Olympic Resins',
    bank:        'ABSA',
    branchCode:  '630143',
    accountNo:   '4044631796',
  },
} as const;

// Official Olympic Resins master brand mark (registered artwork), embedded as a
// data URI so it renders in the puppeteer-generated PDF without a server origin.
export { RESIN_LOGO_DATA_URI as LOGO_DATA_URI } from './logo';

// Official Olympic brand palette (from the group Brand Design System).
// "Inspiration Yellow" #F5C400 is the master brand colour.
export const BRAND = {
  gold:      '#F5C400',   // Inspiration Yellow — master
  goldHover: '#FAE04D',
  goldTint:  '#FDF0A0',
  goldPale:  '#FEF9E0',
  goldDeep:  '#6A5000',   // deep gold for text on light
  ink:       '#0D0D0D',   // brand black
} as const;
