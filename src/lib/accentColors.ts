export interface AccentColor {
  name: string;
  hex: string;
}

/** TU DU accent palette — brand orange is always the default first swatch. */
export const ACCENT_COLORS: AccentColor[] = [
  { name: 'Orange', hex: '#ff6b00' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Red', hex: '#ef4444' },
];

export const DEFAULT_ACCENT = ACCENT_COLORS[0].hex;
