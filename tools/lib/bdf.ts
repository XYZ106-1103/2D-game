// BDF bitmap font parser + text rasteriser (used by font baking and sign art).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Glyph {
  code: number;
  dw: number;
  w: number;
  h: number;
  xo: number;
  yo: number;
  rows: number[][]; // 0/1 pixels
}

export interface BDF {
  ascent: number;
  descent: number;
  glyphs: Map<number, Glyph>;
}

export function parseBDF(text: string): BDF {
  const lines = text.split(/\r?\n/);
  let ascent = 0;
  let descent = 0;
  const glyphs = new Map<number, Glyph>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('FONT_ASCENT ')) ascent = parseInt(line.slice(12), 10);
    else if (line.startsWith('FONT_DESCENT ')) descent = parseInt(line.slice(13), 10);
    else if (line.startsWith('STARTCHAR')) {
      let code = -1;
      let dw = 0;
      let w = 0;
      let h = 0;
      let xo = 0;
      let yo = 0;
      const rows: number[][] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('ENDCHAR')) {
        const l = lines[i];
        if (l.startsWith('ENCODING ')) code = parseInt(l.slice(9), 10);
        else if (l.startsWith('DWIDTH ')) dw = parseInt(l.split(' ')[1], 10);
        else if (l.startsWith('BBX ')) {
          const p = l.split(' ').map(Number);
          w = p[1];
          h = p[2];
          xo = p[3];
          yo = p[4];
        } else if (l === 'BITMAP') {
          for (let r = 0; r < h; r++) {
            i++;
            const hex = lines[i].trim();
            const row: number[] = [];
            for (let x = 0; x < w; x++) {
              const byte = parseInt(hex.substr((x >> 3) * 2, 2), 16) || 0;
              row.push((byte >> (7 - (x & 7))) & 1);
            }
            rows.push(row);
          }
        }
        i++;
      }
      if (code >= 0) glyphs.set(code, { code, dw, w, h, xo, yo, rows });
    }
    i++;
  }
  return { ascent, descent, glyphs };
}


const cache = new Map<string, BDF>();
export function loadGalmuri(name: string): BDF {
  let f = cache.get(name);
  if (!f) {
    const root = new URL('../..', import.meta.url).pathname;
    f = parseBDF(readFileSync(join(root, 'node_modules/galmuri/dist', name + '.bdf'), 'utf8'));
    cache.set(name, f);
  }
  return f;
}

/** Rasterise text; calls plot for each set pixel. Returns advance width. */
export function rasterText(font: BDF, text: string, x: number, y: number, plot: (x: number, y: number) => void, spacing = 0): number {
  let cx = x;
  for (const ch of text) {
    const g = font.glyphs.get(ch.codePointAt(0)!);
    if (!g) continue;
    const top = y + font.ascent - (g.yo + g.h);
    for (let r = 0; r < g.h; r++) for (let c = 0; c < g.w; c++) if (g.rows[r][c]) plot(cx + g.xo + c, top + r);
    cx += g.dw + spacing;
  }
  return cx - x;
}

export function measureText(font: BDF, text: string, spacing = 0): number {
  let w = 0;
  for (const ch of text) {
    const g = font.glyphs.get(ch.codePointAt(0)!);
    if (g) w += g.dw + spacing;
  }
  return w;
}
