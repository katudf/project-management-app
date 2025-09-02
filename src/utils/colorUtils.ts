// src/utils/colorUtils.ts

/**
 * Converts a hex color string to an RGB object.
 * @param hex The hex color string (e.g., "#RRGGBB" or "RRGGBB").
 * @returns An object with r, g, b properties, or null if invalid.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  hex = hex.replace(shorthandRegex, function(_, r, g, b) {
    return r + r + g + g + b + b;
  });

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Converts an RGB object to a hex color string.
 * @param r The red component (0-255).
 * @param g The green component (0-255).
 * @param b The blue component (0-255).
 * @returns The hex color string (e.g., "#RRGGBB").
 */
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/**
 * Calculates the complementary color for a given hex color string.
 * The complementary color is calculated based on the formula:
 * R' = (max + min) - R
 * G' = (max + min) - G
 * B' = (max + min) - B
 * where max and min are the maximum and minimum values among R, G, B.
 * @param hexColor The input hex color string (e.g., "#RRGGBB").
 * @returns The complementary color as a hex string, or the original color if input is invalid.
 */
export function getComplementaryColor(hexColor: string): string {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    console.warn(`Invalid hex color: ${hexColor}. Returning original color.`);
    return hexColor;
  }

  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sum = max + min;

  const rComp = sum - r;
  const gComp = sum - g;
  const bComp = sum - b;

  return rgbToHex(rComp, gComp, bComp);
}
