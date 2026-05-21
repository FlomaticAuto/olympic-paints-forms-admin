// Hex codes for paint colour names used in the Returns Intake form.
// Best-effort approximations — Quintus will supply authoritative values.
// Missing names fall back to FALLBACK_HEX (neutral grey).

export const FALLBACK_HEX = '#5C5B58';

export const COLOUR_HEX: Record<string, string> = {
  // Whites & creams
  'White': '#FFFFFF',
  'Rice White': '#F4EFE6',
  'White Whisper': '#F2EDE6',
  'Ivory': '#FFFFF0',
  'Cream': '#F4E9C9',
  'Vanilla': '#F3E5AB',
  'Hazelnut Cream': '#D6B98C',

  // Blacks & greys
  'Black': '#000000',
  'Grey': '#808080',
  'Dark Grey': '#3F3F3F',
  'Light Grey': '#C0C0C0',
  'Silver': '#C0C0C0',
  'Silver Mist': '#BFC3C7',
  'Silver Sand': '#BDBAA1',
  'Casper Grey': '#8E8E8E',
  'Stone Grey': '#928E85',
  'Pebble Stone': '#A39C8B',
  'Espresso Grey': '#4D453F',
  'Suede Grey': '#7D7268',
  'Charcoal': '#2E2E2E',
  'Misty Storm': '#5C5C5E',
  'Storm': '#4F5D6A',
  'Shiloh': '#9C8E7E',
  'Wisdom': '#6E7A7E',

  // Reds, burgundies, pinks
  'Red': '#C0392B',
  'Red Passion': '#C8364C',
  'Signal Red': '#C8364C',
  'Post Office Red': '#A6192E',
  'Burgundy': '#800020',
  'Cranberry': '#9F1D35',
  'Pink': '#FFC0CB',
  'Coral': '#FF7F50',
  'Maxi Peach': '#FFC09F',
  'Peach': '#FFCBA4',
  'Ceres Peach': '#FFB58A',
  'Apricot': '#FBCEB1',
  'Guava': '#E37383',
  'Tropical Sunset': '#E66B4F',

  // Oranges, yellows
  'Orange': '#FF8C00',
  'Sunset Yellow': '#F2B33A',
  'Sunshine Yellow': '#FFD93B',
  'Bright Yellow': '#FFD700',
  'CAT Yellow': '#F0B500',
  'Golden Yellow': '#D4A017',
  'Maize': '#F2C66D',
  'Yellow': '#FFE600',

  // Greens
  'Green': '#3FB54F',
  'Spring Green': '#7FBF60',
  'Brilliant Green': '#3FB54F',
  'Emu Green': '#5E7E3E',
  'Emu': '#5E7E3E',
  'JD Green': '#367C2B',
  'Kiwi': '#8EB44F',
  'Fossil Green': '#6C7B5A',

  // Blues
  'Blue': '#1E88E5',
  'Light Blue': '#ADD8E6',
  'Dark Blue': '#003366',
  'Summer Blue': '#7CB9E8',
  'French Blue': '#0072BB',
  'Royal Blue': '#1335A0',
  'Aqua Blue': '#4FBDC8',
  'Ocean Blue': '#1B6AA1',
  'Ocean': '#1B6AA1',
  'Ocean Foam': '#B5D6D0',
  'Night Sky': '#1B2A4E',

  // Browns & tans
  'Brown': '#8B5A2B',
  'Light Brown': '#9B7653',
  'Bushveld Brown': '#6B4D2E',
  'Golden Brown': '#996515',
  'PWD Brown': '#5C4033',
  'Chestnut': '#7A4A2E',
  'Bronze': '#8C7853',
  'Brazil Nut': '#6D4A29',
  'Desert Camel': '#C3A07A',
  'Umhlanga Tan': '#B98A65',
  'Toasted Cashew': '#A57F58',
  'Hazel': '#A07852',
  'Moroccan Tan': '#B07D52',
  'Sand': '#C2B280',
  'Sand Storm': '#D6BE94',
  'Tennessee': '#8C6E47',
  'African Kudu': '#7A5C3E',
  'Kalahari': '#C6A678',
  'Autumn Wheat': '#D9B97A',
  'Mushroom': '#A39B89',
  'Bush Elephant': '#776E60',
  'Rim Rock': '#7A6E5D',
  'Exotic Earth': '#7B4A2A',
  'Evening Glow': '#D8923C',
  'Terracotta': '#C9602E',
  'Albany': '#7C4C2A',

  // Purples / violets / pinks
  'Wild Orchid': '#A4538C',
  'Wild Iris': '#7E6BA0',
  'Touch of Venus': '#C49AA8',
  'Jaipur': '#9D4A6B',

  // Aluminium
  'Aluminium': '#A8A9AD',

  // Wood varnish stains
  'Copal': '#B97A57',
  'Dark Oak': '#5C3A21',
  'Ebony': '#3E2C23',
  'Light Oak': '#C8A572',
  'Mahogany': '#73362A',
  'Maple': '#D9A06B',
  'Oak': '#A07550',
  'Teak': '#9E6A3C',
  'Walnut': '#5C4030',

  // Red Oxide variants
  'Red Oxide': '#A6432A',
};

export function getColourHex(name: string): string {
  return COLOUR_HEX[name] ?? FALLBACK_HEX;
}

export function hasKnownHex(name: string): boolean {
  return name in COLOUR_HEX;
}
