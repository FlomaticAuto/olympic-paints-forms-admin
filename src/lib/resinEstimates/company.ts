// Olympic Resins company details for the estimate/quote document + email.
// Registered details sourced from the official "Resins-banking details" letter
// (2.Areas/1. Sales/8. Resin/Master data/Resins-banking details.pdf).
// Trading name: Olympic Resins · Registered entity: Olymbos Resins cc.

export const RESIN_COMPANY = {
  name:       'Olympic Resins',
  parent:     'Prop. Olymbos Resins cc',
  tagline:    'B2B Resin & Solvent Supply',
  reg:        'CK 1994/031999/23',
  vat:        '4870145432',
  phone:      '+27 11 857 1045',
  fax:        '+27 11 857 1059',
  email:      'resins@olympicpaints.co.za',
  preparedBy: 'Kim Williams',
  address:    'Mecca Road, Anchorville Industrial Township, Lawley, Johannesburg · P.O. Box 680, Lenasia 1820',
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
