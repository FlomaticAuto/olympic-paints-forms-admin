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
