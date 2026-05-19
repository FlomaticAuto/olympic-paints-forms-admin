// Product catalogue for the Returns Intake form.
// Sourced from: 2.Areas/8. Marketing/Product Guide/Product Colors.xlsx (2026-05-19)
// Category → Product → { colours, sizes }

export interface ProductInfo {
  colours: string[];
  sizes: string[];
}

export interface CategoryEntry {
  label: string;
  products: string[];
}

// Sizes available per product type (enamel vs PVA vs roof etc.)
const ENAMEL_SIZES   = ['500ml', '1L', '5L', '20L'];
const PVA_SIZES      = ['5L', '20L'];
const ROOF_SIZES     = ['5L', '20L'];
const VARNISH_SIZES  = ['1L', '5L'];
const PRIMER_SIZES   = ['5L', '20L'];
const SMALL_SIZES    = ['500ml', '1L', '5L'];

export const CATEGORIES: CategoryEntry[] = [
  {
    label: 'Acrylic PVA — Platinum Range',
    products: ['Platinum Plus Natural Elegance', 'Platinum Plus Suburban Bliss', 'Platinum Plus Rugged Beauty'],
  },
  {
    label: 'Acrylic PVA — Standard Range',
    products: ['Master Decorators Acrylic PVA', 'Kalahari Contractors PVA', 'Decor Acrylic PVA', 'Hi-Hiding Super Acrylic Contractors PVA', 'Eclipse PVA', 'Liberty PVA', '7-IN-1 Multipurpose Plus'],
  },
  {
    label: 'Enamel — Premium',
    products: ['Platinum Plus Ultimate Shine'],
  },
  {
    label: 'Enamel — Mid Range',
    products: ['High Gloss Enamel', 'Quick Drying Enamel', '3-IN-1 Gripcoat Enamel'],
  },
  {
    label: 'Enamel — Budget',
    products: ['Pick \'n Save Econo Gloss Enamel', 'Flat White Enamel', 'Eggshell Enamel'],
  },
  {
    label: 'Roof & Floor Coatings',
    products: ['Universal Acrylic Roof & Paving Paint', 'Alkyd Roof Paint', 'Stoep Paint', 'Platinum Plus Plush Coat', '3-IN-1 Roof Paint'],
  },
  {
    label: 'Waterproofing',
    products: ['Acrylic Rain Proof', 'Fibre Restore'],
  },
  {
    label: 'Wood Care',
    products: ['Wood Varnish'],
  },
  {
    label: 'Primers & Undercoats',
    products: ['Platinum Plus All-In-One Protector', 'Water Based Red Oxide Primer', 'Pink Wood Primer', 'Universal Undercoat', 'QD Primer', 'Water Based Plaster Primer', 'Zinc Phosphate Primer'],
  },
  {
    label: 'Textured Finishes',
    products: ['Platinum Plus Rugged Beauty'],
  },
  {
    label: 'Other / Miscellaneous',
    products: ['Other'],
  },
];

export const PRODUCT_DATA: Record<string, ProductInfo> = {
  'Platinum Plus Natural Elegance': {
    colours: ['White', 'Rice White', 'Casper Grey', 'White Whisper', 'Hazelnut Cream', 'Cream', 'Wild Orchid', 'Red Passion', 'Misty Storm', 'Wild Iris', 'Exotic Earth', 'Evening Glow'],
    sizes: PVA_SIZES,
  },
  'Platinum Plus Suburban Bliss': {
    colours: ['Rice White', 'Silver Mist', 'Bush Elephant', 'Night Sky', 'Wild Iris', 'Touch of Venus', 'Espresso Grey', 'Suede Grey', 'Jaipur', 'Peach', 'Sunset Yellow', 'Toasted Cashew', 'Ocean Foam', 'Wisdom', 'Sand', 'Storm', 'Vanilla'],
    sizes: PVA_SIZES,
  },
  'Platinum Plus Rugged Beauty': {
    colours: ['Rice White', 'Silver Mist', 'Bush Elephant', 'Night Sky', 'Wild Iris', 'Touch of Venus', 'Espresso Grey', 'Suede Grey', 'Jaipur', 'Peach', 'Sunset Yellow', 'Rim Rock', 'Ocean Foam', 'Wisdom', 'Sand', 'Storm', 'Vanilla'],
    sizes: PVA_SIZES,
  },
  'Master Decorators Acrylic PVA': {
    colours: ['Rice White', 'Silver Sand', 'Brazil Nut', 'Desert Camel', 'Umhlanga Tan', 'Cream', 'Pebble Stone', 'Stone Grey', 'Shiloh', 'Night Sky', 'Fossil Green', 'Tennessee', 'African Kudu', 'Kalahari', 'Peach', 'Sunset Yellow', 'Autumn Wheat'],
    sizes: PVA_SIZES,
  },
  'Hi-Hiding Super Acrylic Contractors PVA': {
    colours: ['White'],
    sizes: PVA_SIZES,
  },
  'Kalahari Contractors PVA': {
    colours: ['White', 'Jaipur', 'Cream', 'Coral', 'Moroccan Tan', 'Ceres Peach', 'Hazel', 'Silver Mist', 'Peach', 'Maize', 'Night Sky', 'Stone Grey', 'Rim Rock', 'Cranberry', 'Kiwi'],
    sizes: PVA_SIZES,
  },
  'Decor Acrylic PVA': {
    colours: ['White', 'Cream', 'Kiwi', 'Chestnut', 'Guava', 'Peach', 'Maize', 'Mushroom', 'Cranberry', 'Night Sky', 'Silver Mist'],
    sizes: PVA_SIZES,
  },
  'Eclipse PVA': {
    colours: ['White', 'Cream', 'Peach', 'Pink', 'Blue', 'Green', 'Bushveld Brown', 'Sunshine Yellow', 'Aqua Blue', 'Tropical Sunset'],
    sizes: PVA_SIZES,
  },
  'Liberty PVA': {
    colours: ['White', 'Cream'],
    sizes: PVA_SIZES,
  },
  '7-IN-1 Multipurpose Plus': {
    colours: ['Sand Storm', 'Rim Rock', 'Stone Grey', 'Night Sky', 'Mushroom', 'Silver Mist', 'Pebble Stone', 'Espresso Grey'],
    sizes: PVA_SIZES,
  },
  'Platinum Plus Ultimate Shine': {
    colours: ['White', 'Black', 'Bright Yellow', 'Post Office Red', 'Golden Yellow', 'Light Brown', 'Light Blue', 'Dark Blue', 'Grey', 'Light Grey', 'Spring Green', 'Orange', 'Apricot', 'PWD Brown', 'Pink', 'Summer Blue', 'Ivory', 'Peach', 'Signal Red', 'Brilliant Green', 'Golden Brown', 'French Blue', 'Cream', 'Burgundy', 'Silver'],
    sizes: ENAMEL_SIZES,
  },
  'High Gloss Enamel': {
    colours: ['White', 'Black', 'Signal Red', 'Light Brown', 'Grey', 'Summer Blue', 'Spring Green', 'Ivory', 'Burgundy', 'Bright Yellow', 'Maxi Peach', 'Cream', 'Golden Brown', 'Peach', 'Brilliant Green', 'PWD Brown'],
    sizes: ENAMEL_SIZES,
  },
  'Quick Drying Enamel': {
    colours: ['White', 'Dark Grey', 'Green', 'Black', 'Royal Blue', 'CAT Yellow', 'Bronze', 'PWD Brown', 'JD Green', 'Burgundy', 'Signal Red', 'Golden Brown', 'Silver'],
    sizes: ENAMEL_SIZES,
  },
  '3-IN-1 Gripcoat Enamel': {
    colours: ['Black', 'White', 'Bronze'],
    sizes: ['5L'],
  },
  'Pick \'n Save Econo Gloss Enamel': {
    colours: ['White', 'Green', 'Cream', 'Yellow', 'Blue', 'Peach', 'Golden Brown', 'Black', 'Pink'],
    sizes: ['5L', '20L'],
  },
  'Flat White Enamel': {
    colours: ['White'],
    sizes: ENAMEL_SIZES,
  },
  'Eggshell Enamel': {
    colours: ['White', 'Cream'],
    sizes: ENAMEL_SIZES,
  },
  'Universal Acrylic Roof & Paving Paint': {
    colours: ['Red', 'Brown', 'Burgundy', 'Black', 'Grey', 'Charcoal', 'Terracotta', 'Green', 'Emu Green', 'Albany', 'Ocean Blue'],
    sizes: ROOF_SIZES,
  },
  'Alkyd Roof Paint': {
    colours: ['Red', 'Brown', 'Grey', 'Green', 'Burgundy', 'Aluminium', 'Black'],
    sizes: ROOF_SIZES,
  },
  'Stoep Paint': {
    colours: ['Red', 'Brown', 'Grey', 'Green', 'Burgundy', 'Aluminium', 'Black'],
    sizes: ROOF_SIZES,
  },
  'Platinum Plus Plush Coat': {
    colours: ['Black', 'Burgundy', 'Red', 'Terracotta', 'Brown', 'Emu', 'Albany', 'Grey', 'Charcoal', 'Ocean'],
    sizes: ROOF_SIZES,
  },
  '3-IN-1 Roof Paint': {
    colours: ['Black', 'Burgundy', 'Grey', 'Brown', 'Terracotta', 'Red', 'Green', 'Charcoal', 'Albany'],
    sizes: ROOF_SIZES,
  },
  'Acrylic Rain Proof': {
    colours: ['Black', 'Burgundy', 'Grey', 'Brown', 'Terracotta', 'Red', 'Green', 'Charcoal'],
    sizes: ROOF_SIZES,
  },
  'Fibre Restore': {
    colours: ['Black', 'Burgundy', 'Grey', 'Brown', 'Terracotta', 'Red', 'Green', 'Charcoal'],
    sizes: ROOF_SIZES,
  },
  'Wood Varnish': {
    colours: ['Copal', 'Dark Oak', 'Ebony', 'Light Oak', 'Mahogany', 'Maple', 'Oak', 'Teak', 'Walnut'],
    sizes: VARNISH_SIZES,
  },
  'Platinum Plus All-In-One Protector': {
    colours: ['White'],
    sizes: PRIMER_SIZES,
  },
  'Water Based Red Oxide Primer': {
    colours: ['Red'],
    sizes: PRIMER_SIZES,
  },
  'Pink Wood Primer': {
    colours: ['Pink'],
    sizes: SMALL_SIZES,
  },
  'Universal Undercoat': {
    colours: ['White'],
    sizes: PRIMER_SIZES,
  },
  'QD Primer': {
    colours: ['Red Oxide', 'Grey'],
    sizes: SMALL_SIZES,
  },
  'Water Based Plaster Primer': {
    colours: ['White'],
    sizes: PRIMER_SIZES,
  },
  'Zinc Phosphate Primer': {
    colours: ['Green'],
    sizes: SMALL_SIZES,
  },
  'Other': {
    colours: ['N/A'],
    sizes: ['500ml', '1L', '5L', '20L', 'Other'],
  },
};

export const SUPERVISORS = [
  'Piyush',
  'Mukesh',
  'Ravi',
  'Jagdish',
  'Masangita',
];
