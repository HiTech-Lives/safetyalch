function lum(hex: string) {
  const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export const contrastOnWhite = (hex: string) => 1.05 / (lum(hex) + 0.05);

// White text on the accent must pass WCAG AA (4.5:1). Darken until it does.
export function guardAccent(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#4b2454';
  let [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  let out = hex;
  for (let i = 0; i < 20 && contrastOnWhite(out) < 4.5; i++) {
    r = Math.round(r * 0.92); g = Math.round(g * 0.92); b = Math.round(b * 0.92);
    out = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  return out;
}
