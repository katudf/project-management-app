// src/utils/colorUtils.ts

/**
 * Converts a hex color string to an RGB object.
 *
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
 * 【NEW!】色の相対輝度を計算する関数
 * 人間の目が感じる明るさを数値化するための計算だ！
 * @param rgb RGBオブジェクト { r, g, b }
 * @returns 相対輝度 (0〜1)
 */
function calculateLuminance(rgb: { r: number; g: number; b: number }): number {
  const srgb = [rgb.r / 255, rgb.g / 255, rgb.b / 255];

  const linearRgb = srgb.map(val => {
    if (val <= 0.03928) {
      return val / 12.92;
    }
    return Math.pow((val + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * linearRgb[0] + 0.7152 * linearRgb[1] + 0.0722 * linearRgb[2];
}

/**
 * 【NEW!】2つの色のコントラスト比を計算する関数
 * @param hexColor1 １つ目の色のHEXコード
 * @param hexColor2 ２つ目の色のHEXコード
 * @returns コントラスト比 (1〜21)
 */
export function getContrastRatio(hexColor1: string, hexColor2: string): number {
  const rgb1 = hexToRgb(hexColor1);
  const rgb2 = hexToRgb(hexColor2);

  if (!rgb1 || !rgb2) {
    console.warn('無効な色が指定されたため、最小コントラスト比を返します。');
    return 1;
  }

  const luminance1 = calculateLuminance(rgb1);
  const luminance2 = calculateLuminance(rgb2);

  const brighterLuminance = Math.max(luminance1, luminance2);
  const darkerLuminance = Math.min(luminance1, luminance2);

  const contrastRatio = (brighterLuminance + 0.05) / (darkerLuminance + 0.05);

  // 小数点第2位までで四捨五入して返す
  return Math.round(contrastRatio * 100) / 100;
}

/**
 * Calculates the best contrasting text color (black or white) for a given background color.
 * @param backgroundColor The background color in hex format (e.g., "#RRGGBB").
 * @returns Either "#000000" (black) or "#FFFFFF" (white) for optimal contrast.
 */
export function getContrastTextColor(backgroundColor: string): string {
  const black = "#000000";
  const white = "#FFFFFF";

  const contrastWithBlack = getContrastRatio(backgroundColor, black);
  const contrastWithWhite = getContrastRatio(backgroundColor, white);

  // Choose the color with higher contrast. If equal, prefer white for dark backgrounds.
  if (contrastWithWhite >= contrastWithBlack) {
    return white;
  } else {
    return black;
  }
}